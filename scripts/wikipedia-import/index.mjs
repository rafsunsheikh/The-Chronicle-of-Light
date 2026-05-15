#!/usr/bin/env node
// Wikipedia → Chronicle of Light importer.
//
// Pipeline (Path 2: pre-filter at Wikidata) with optional recursion (--depth):
//
//   For each BFS depth level d ∈ {0..maxDepth}:
//     A. Fetch outgoing wikilinks from the frontier pages
//     B. Batch-resolve every candidate title → Wikidata QID
//     C. ONE SPARQL query: keep only QIDs that have a date AND coordinates
//     D. Record newly-confirmed events; their titles become next frontier
//
//   After BFS, fetch Wikipedia summaries for the first --max events and write.
//
//   IMPORTANT: at depth 1+ we only recurse into pages that were CONFIRMED as
//   events by the Wikidata filter. Concept articles (Allah, Caliphate, Islam,
//   …) are dead-ends for crawling, so the BFS stays focused on the event
//   subgraph and doesn't drift into "everything Wikipedia knows about".
//
// Usage:
//   node scripts/wikipedia-import/index.mjs \
//     --page "Timeline_of_the_history_of_Islam" \
//     --depth 1 --max 25 --dry-run [--ignore-existing]
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
  batchFetchLinks,
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
    depth: 0,
    dryRun: false,
    ignoreExisting: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--page') args.page = argv[++i];
    else if (a === '--max') args.max = parseInt(argv[++i], 10);
    else if (a === '--depth') args.depth = parseInt(argv[++i], 10);
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--ignore-existing') args.ignoreExisting = true;
    else if (a === '--help' || a === '-h') {
      console.log(
        'Usage: node scripts/wikipedia-import/index.mjs ' +
          '[--page <title>] [--max <n>] [--depth <n>] [--dry-run] [--ignore-existing]\n\n' +
          '  --depth 0   only links from the seed page (default)\n' +
          '  --depth 1   also recurse into confirmed events found at depth 0\n' +
          '  --depth 2+  one more hop per level. Warning: rapid growth.',
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

// Breadth-first discovery of event QIDs reachable from a seed Wikipedia page.
// Only confirmed events (date + coords on Wikidata) become recursion frontier
// at the next depth — concept articles are dead-ends.
async function bfsDiscoverEvents(args, state) {
  const visited = new Set([args.page]);
  // qid → { title, qid, wd, depth }
  const eventsByQid = new Map();
  let frontier = [args.page];

  for (let depth = 0; depth <= args.depth; depth++) {
    console.log(`\n── depth ${depth} ──`);
    console.log(`  frontier: ${frontier.length} page(s)`);

    // Step A: fetch outgoing links.
    let pageToLinks;
    if (depth === 0) {
      // Seed page: use the un-truncated fetcher.
      const links = await fetchTimelineLinks(args.page);
      pageToLinks = new Map([[args.page, links]]);
    } else {
      pageToLinks = await batchFetchLinks(frontier);
    }

    const candidateTitles = new Set();
    for (const links of pageToLinks.values()) {
      for (const l of links) {
        if (!visited.has(l)) candidateTitles.add(l);
      }
    }
    console.log(`  new candidate titles: ${candidateTitles.size}`);
    if (candidateTitles.size === 0) break;

    // Step B: batch-resolve QIDs.
    const titleToQid = await batchResolveQids([...candidateTitles]);

    // Step C: SPARQL filter — but only ask Wikidata about QIDs we haven't
    // already classified (cached responses still flow through fetchWikidata,
    // this is just to keep logs and request volume sane).
    const seenInRun = new Set(eventsByQid.keys());
    const seenInRepo = args.ignoreExisting ? new Set() : state.qids;
    const unseenQids = [
      ...new Set([...titleToQid.values()].filter(Boolean)),
    ].filter((q) => !seenInRun.has(q) && !seenInRepo.has(q));

    console.log(`  QIDs to probe: ${unseenQids.length}`);
    const wd = unseenQids.length > 0 ? await fetchWikidata(unseenQids) : new Map();
    console.log(`  confirmed events: ${wd.size}`);

    // Step D: record newly-confirmed events; their titles become next frontier.
    const nextFrontier = [];
    for (const [title, qid] of titleToQid) {
      if (!qid || visited.has(title) || eventsByQid.has(qid)) continue;
      if (!wd.has(qid)) continue;
      eventsByQid.set(qid, { title, qid, wd: wd.get(qid), depth });
      nextFrontier.push(title);
      visited.add(title);
    }

    if (depth >= args.depth || nextFrontier.length === 0) break;
    frontier = nextFrontier;
  }

  return [...eventsByQid.values()];
}

async function main() {
  const args = parseArgs(process.argv);
  const today = new Date().toISOString().slice(0, 10);

  console.log(`page:     ${args.page}`);
  console.log(`depth:    ${args.depth}`);
  console.log(`max:      ${args.max}`);
  console.log(`dry-run:  ${args.dryRun}`);
  console.log(`out dir:  ${path.relative(repoRoot, outDir)}\n`);

  if (!process.env.IMPORTER_USER_AGENT) {
    console.warn(
      '⚠ IMPORTER_USER_AGENT is not set; using a generic UA.\n' +
        '  Set it to identify your project per Wikipedia policy:\n' +
        "  export IMPORTER_USER_AGENT='YourProject/0.1 (https://github.com/you/repo; you@example.com)'\n",
    );
  }
  if (args.depth >= 2) {
    console.warn(
      `⚠ --depth ${args.depth} can take many minutes and produce hundreds of\n` +
        `  draft events. Re-runs are cached so you only pay the cost once.\n`,
    );
  }

  const state = loadExistingState();
  console.log(
    `existing: ${state.ids.size} event(s), ${state.qids.size} known Wikidata QID(s)` +
      (args.ignoreExisting ? '  (--ignore-existing: dedup disabled)' : ''),
  );

  // ── BFS discovery ───────────────────────────────────────────────────────
  const discovered = await bfsDiscoverEvents(args, state);

  if (discovered.length === 0) {
    console.log('\nno events found');
    return;
  }
  const depthCounts = discovered.reduce((acc, e) => {
    acc[e.depth] = (acc[e.depth] ?? 0) + 1;
    return acc;
  }, {});
  console.log(
    `\n→ ${discovered.length} total event(s) discovered  (` +
      Object.entries(depthCounts)
        .map(([d, n]) => `depth ${d}: ${n}`)
        .join(', ') +
      ')',
  );

  // Sort: depth-0 events first (closest to the seed); within a depth, by date.
  discovered.sort((a, b) => {
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (a.wd?.startTime ?? '').localeCompare(b.wd?.startTime ?? '');
  });
  const survivors = discovered.slice(0, args.max);

  // ── Summary fetch + build (for the first --max only) ────────────────────
  console.log(
    `\nfetching Wikipedia summaries for ${survivors.length} event(s) ` +
      `(of ${discovered.length} discovered) ...`,
  );
  const built = [];
  const seenIds = args.ignoreExisting ? new Set() : new Set(state.ids);
  let skipped = 0;

  for (let i = 0; i < survivors.length; i++) {
    const { title, qid, wd } = survivors[i];
    try {
      const summary = await fetchSummary(title);
      const out = buildEvent({ summary, wd, today });
      if (out.skipped) {
        console.log(`  [${i + 1}/${survivors.length}] ${title} — skip (${out.reason})`);
        skipped++;
        continue;
      }
      if (seenIds.has(out.event.id)) {
        console.log(
          `  [${i + 1}/${survivors.length}] ${title} — skip (id "${out.event.id}" collision)`,
        );
        skipped++;
        continue;
      }
      seenIds.add(out.event.id);
      built.push(out);
      console.log(
        `  [${i + 1}/${survivors.length}] ${title} → ${out.filename} ` +
          `(${out.event.category}, ${out.event.startDate})`,
      );
    } catch (e) {
      console.warn(`  [${i + 1}/${survivors.length}] ${title} — ${e.message}`);
      skipped++;
    }
  }

  // ── Write or report ─────────────────────────────────────────────────────
  if (args.dryRun) {
    console.log(`\n[dry-run] would write ${built.length} event(s); skipped ${skipped}.`);
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  for (const w of built) {
    const filepath = path.join(outDir, w.filename);
    fs.writeFileSync(filepath, JSON.stringify(w.event, null, 2) + '\n');
  }
  console.log(
    `\n✓ wrote ${built.length} event(s) to ${path.relative(repoRoot, outDir)}; ` +
      `skipped ${skipped}.`,
  );
  console.log(
    '\nNext: review each file, fix any mis-categorized events, set confidence to "established",\n' +
      'fill in connections[], then move from src/data/events/imported/ to src/data/events/.',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
