#!/usr/bin/env node
// Wikipedia → Chronicle of Light importer.
// Usage:
//   node scripts/wikipedia-import/index.mjs \
//     --page "Timeline_of_the_history_of_Islam" \
//     --max 20 \
//     --dry-run
//
// Output: draft events under src/data/events/imported/ with confidence=auto-imported.
// All hits to the Wikipedia REST API, MediaWiki API, and Wikidata Query Service
// are cached on disk under scripts/wikipedia-import/.cache/ so re-runs are cheap.
//
// Set the env var IMPORTER_USER_AGENT to identify yourself per Wikipedia policy:
//   export IMPORTER_USER_AGENT='YourProject/0.1 (https://github.com/you/repo; you@example.com)'

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchTimelineLinks, fetchSummary } from './wikipedia.mjs';
import { fetchWikidata } from './wikidata.mjs';
import { buildEvent } from './transform.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const eventsDir = path.join(repoRoot, 'src', 'data', 'events');
const outDir = path.join(eventsDir, 'imported');

function parseArgs(argv) {
  const args = {
    page: 'Timeline_of_the_history_of_Islam',
    max: 25,
    dryRun: false,
    ignoreExisting: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--page') args.page = argv[++i];
    else if (a === '--max') args.max = parseInt(argv[++i], 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--ignore-existing') args.ignoreExisting = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/wikipedia-import/index.mjs ' +
          '[--page <title>] [--max <n>] [--dry-run] [--ignore-existing]',
      );
      process.exit(0);
    }
  }
  return args;
}

function loadExistingState() {
  const ids = new Set();
  const qids = new Set();
  const titles = new Set();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        walk(p);
        continue;
      }
      if (!f.endsWith('.json')) continue;
      const event = JSON.parse(fs.readFileSync(p, 'utf8'));
      ids.add(event.id);
      titles.add(event.title);
      for (const s of event.sources ?? []) {
        if (s.wikidata) qids.add(s.wikidata);
      }
    }
  }

  walk(eventsDir);
  return { ids, qids, titles };
}

async function main() {
  const args = parseArgs(process.argv);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`page:     ${args.page}`);
  console.log(`max:      ${args.max}`);
  console.log(`dry-run:  ${args.dryRun}`);
  console.log(`out dir:  ${path.relative(repoRoot, outDir)}\n`);

  if (!process.env.IMPORTER_USER_AGENT) {
    console.warn(
      '⚠ IMPORTER_USER_AGENT is not set; using a generic UA.\n' +
        '  Please set it to identify your project per Wikipedia policy:\n' +
        "  export IMPORTER_USER_AGENT='YourProject/0.1 (https://github.com/you/repo; you@example.com)'\n",
    );
  }

  const state = loadExistingState();
  console.log(
    `existing: ${state.ids.size} event(s), ${state.qids.size} known Wikidata QID(s)` +
      (args.ignoreExisting ? '  (--ignore-existing: dedup disabled)' : '') +
      '\n',
  );

  console.log('1/3  fetching timeline article links …');
  const titles = await fetchTimelineLinks(args.page);
  // Oversample: the first N links in any Wikipedia article are usually concept/
  // disambiguation links, not events. Walk a wider pool and let Wikidata's
  // date-filter pick the real events.
  const OVERSAMPLE = 12;
  const candidates = titles
    .filter((t) => args.ignoreExisting || !state.titles.has(t))
    .slice(0, args.max * OVERSAMPLE);
  console.log(
    `     ${titles.length} link(s) found, ${candidates.length} candidate(s) to probe ` +
      `(target: ${args.max} event(s))`,
  );

  if (candidates.length === 0) {
    console.log('\nnothing new to import');
    return;
  }

  console.log(`\n2/3  fetching Wikipedia summaries (${candidates.length}) …`);
  const summaries = [];
  for (let i = 0; i < candidates.length; i++) {
    const title = candidates[i];
    try {
      const s = await fetchSummary(title);
      if (!s.qid) {
        console.log(`     [${i + 1}/${candidates.length}] ${title} — no Wikidata QID, skip`);
        continue;
      }
      if (!args.ignoreExisting && state.qids.has(s.qid)) {
        console.log(`     [${i + 1}/${candidates.length}] ${title} — QID already imported, skip`);
        continue;
      }
      summaries.push(s);
      console.log(`     [${i + 1}/${candidates.length}] ${title} → ${s.qid}`);
    } catch (e) {
      console.warn(`     [${i + 1}/${candidates.length}] ${title} — ${e.message}`);
    }
  }

  if (summaries.length === 0) {
    console.log('\nno usable summaries; done');
    return;
  }

  console.log(`\n3/3  querying Wikidata for ${summaries.length} QID(s) …`);
  const wd = await fetchWikidata(summaries.map((s) => s.qid));

  let written = 0;
  let skipped = 0;
  const writes = [];
  // Within a single run, never write two events with the same id. When
  // --ignore-existing is off, also avoid colliding with already-curated ids.
  const seenIds = args.ignoreExisting ? new Set() : new Set(state.ids);

  for (const summary of summaries) {
    if (written >= args.max) break;
    const out = buildEvent({
      summary,
      wd: wd.get(summary.qid),
      today,
    });

    if (out.skipped) {
      console.log(`     skip ${summary.title} — ${out.reason}`);
      skipped++;
      continue;
    }

    if (seenIds.has(out.event.id)) {
      console.log(
        `     skip ${summary.title} — derived id "${out.event.id}" collides with another event in this run`,
      );
      skipped++;
      continue;
    }
    seenIds.add(out.event.id);

    writes.push(out);
    written++;
  }

  if (args.dryRun) {
    console.log(`\n[dry-run] would write ${written} event(s); skipped ${skipped}.`);
    for (const w of writes) {
      console.log(`  • ${w.filename}  (${w.event.category}, ${w.event.startDate})`);
    }
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const w of writes) {
    const filepath = path.join(outDir, w.filename);
    fs.writeFileSync(filepath, JSON.stringify(w.event, null, 2) + '\n');
    console.log(`     wrote imported/${w.filename}`);
  }

  console.log(`\n✓ wrote ${written} event(s); skipped ${skipped}.`);
  console.log(
    '\nNext: review each file, edit any mis-categorized events, set confidence to "established",\n' +
      'fill in connections[], then move from src/data/events/imported/ to src/data/events/.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
