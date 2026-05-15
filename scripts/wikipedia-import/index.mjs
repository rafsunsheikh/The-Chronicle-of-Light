#!/usr/bin/env node
// Wikipedia → Chronicle of Light importer.
//
// Pipeline (Path 2: pre-filter at Wikidata):
//   1. Fetch all outgoing link titles from the timeline article
//   2. Batch-resolve every title → Wikidata QID (~7 MediaWiki calls / 334 titles)
//   3. ONE SPARQL query: keep only QIDs that have a date AND coordinates
//   4. Fetch Wikipedia summaries only for the survivors (small set, fast)
//   5. Map each into the event schema, write to imported/
//
// Usage:
//   node scripts/wikipedia-import/index.mjs \
//     --page "Timeline_of_the_history_of_Islam" \
//     --max 20 \
//     --dry-run \
//     --ignore-existing
//
// All API responses are cached on disk under scripts/wikipedia-import/.cache/
// so re-runs are fast and offline-friendly.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  fetchTimelineLinks,
  fetchSummary,
  batchResolveQids,
} from './wikipedia.mjs';
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

  // ── 1/4  Timeline links ─────────────────────────────────────────────────
  console.log('1/4  fetching timeline article links …');
  const allTitles = await fetchTimelineLinks(args.page);
  const candidates = allTitles.filter(
    (t) => args.ignoreExisting || !state.titles.has(t),
  );
  console.log(
    `     ${allTitles.length} link(s) found, ${candidates.length} candidate(s) after dedup`,
  );
  if (candidates.length === 0) {
    console.log('\nnothing to import');
    return;
  }

  // ── 2/4  Batch-resolve QIDs ─────────────────────────────────────────────
  console.log(
    `\n2/4  resolving Wikidata QIDs for ${candidates.length} candidate(s) ` +
      `(MediaWiki prop=pageprops, batched) …`,
  );
  const titleToQid = await batchResolveQids(candidates);
  const titlesWithQid = candidates.filter((t) => titleToQid.get(t));
  console.log(
    `     ${titlesWithQid.length} have a Wikidata link, ${
      candidates.length - titlesWithQid.length
    } don't (red links or no item)`,
  );

  if (!args.ignoreExisting) {
    const knownQids = state.qids;
    const before = titlesWithQid.length;
    for (let i = titlesWithQid.length - 1; i >= 0; i--) {
      if (knownQids.has(titleToQid.get(titlesWithQid[i]))) {
        titlesWithQid.splice(i, 1);
      }
    }
    if (before !== titlesWithQid.length) {
      console.log(
        `     dropped ${before - titlesWithQid.length} title(s) whose QID is already imported`,
      );
    }
  }

  if (titlesWithQid.length === 0) {
    console.log('\nno candidates have Wikidata items to query');
    return;
  }

  // ── 3/4  SPARQL pre-filter (requires date + coords) ─────────────────────
  console.log(
    `\n3/4  querying Wikidata for ${titlesWithQid.length} QID(s) ` +
      `(one batched SPARQL; requires date AND coordinates) …`,
  );
  const qidList = titlesWithQid.map((t) => titleToQid.get(t));
  const wd = await fetchWikidata(qidList);
  console.log(
    `     ${wd.size} QID(s) returned — ${qidList.length - wd.size} dropped by the date+coords filter`,
  );

  // Take first --max survivors, preserving the timeline-article link order.
  const survivors = titlesWithQid
    .filter((t) => wd.has(titleToQid.get(t)))
    .slice(0, args.max);

  if (survivors.length === 0) {
    console.log('\nno survivors after the Wikidata pre-filter');
    return;
  }

  // ── 4/4  Fetch Wikipedia summaries for survivors only ───────────────────
  console.log(
    `\n4/4  fetching Wikipedia summaries for ${survivors.length} survivor(s) …`,
  );
  const built = [];
  const seenIds = args.ignoreExisting ? new Set() : new Set(state.ids);
  let skipped = 0;

  for (let i = 0; i < survivors.length; i++) {
    const title = survivors[i];
    const qid = titleToQid.get(title);
    try {
      const summary = await fetchSummary(title);
      const out = buildEvent({ summary, wd: wd.get(qid), today });
      if (out.skipped) {
        console.log(`     [${i + 1}/${survivors.length}] ${title} — skip (${out.reason})`);
        skipped++;
        continue;
      }
      if (seenIds.has(out.event.id)) {
        console.log(
          `     [${i + 1}/${survivors.length}] ${title} — skip (id "${out.event.id}" collision)`,
        );
        skipped++;
        continue;
      }
      seenIds.add(out.event.id);
      built.push(out);
      console.log(
        `     [${i + 1}/${survivors.length}] ${title} → ${out.filename} ` +
          `(${out.event.category}, ${out.event.startDate})`,
      );
    } catch (e) {
      console.warn(`     [${i + 1}/${survivors.length}] ${title} — ${e.message}`);
      skipped++;
    }
  }

  // ── Write or dry-run report ────────────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n[dry-run] would write ${built.length} event(s); skipped ${skipped}.`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const w of built) {
    const filepath = path.join(outDir, w.filename);
    fs.writeFileSync(filepath, JSON.stringify(w.event, null, 2) + '\n');
  }
  console.log(`\n✓ wrote ${built.length} event(s) to ${path.relative(repoRoot, outDir)}; skipped ${skipped}.`);
  console.log(
    '\nNext: review each file, fix any mis-categorized events, set confidence to "established",\n' +
      'fill in connections[], then move from src/data/events/imported/ to src/data/events/.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
