#!/usr/bin/env node
// Rebuild the pipeline board (pipeline_status) from what is on disk, so
// stages run from the command line show up on the admin page too.
//
//   npm run runner:board            write the board for every listed book
//   npm run runner:board -- --dry   print it without writing
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config, repoRoot, requireSupabase } from './config.mjs';
import { loadBooks, statsFromLog, STAGES } from './pipeline.mjs';
import * as queue from './queue.mjs';

const dry = process.argv.includes('--dry');
const num = (s) => Number(String(s).replace(/,/g, ''));

/** What each stage has left behind for one book, or null when it has not run. */
function fromDisk(book) {
  const dir = join(repoRoot, 'content', book.public ? 'books' : 'private', book.slug);
  const ex = join(dir, 'extract');
  const out = {};
  if (existsSync(join(dir, 'content.md'))) {
    const meta = existsSync(join(dir, 'meta.json')) ? JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) : {};
    out.convert = { pages: meta.stats?.pages ?? null, words: meta.stats?.words ?? null, figures: meta.engine?.figures ?? null, engine: meta.engine?.name ?? null };
  }
  if (existsSync(join(ex, 'chunks.json'))) {
    const index = JSON.parse(readFileSync(join(ex, 'chunks.json'), 'utf8'));
    out.chunk = { chunks: index.length, chars: index.reduce((n, c) => n + (c.chars ?? 0), 0), withAnnal: index.filter((c) => c.annal).length };
    const candDir = join(ex, 'candidates');
    if (existsSync(candDir) && readdirSync(candDir).some((f) => f.endsWith('.json'))) out['extract-local'] = statsFromLog(book, index.length);
  }
  if (existsSync(join(ex, 'merge-report.md'))) {
    const m = readFileSync(join(ex, 'merge-report.md'), 'utf8').match(/Candidates: (\d+)\. Unusable: (\d+)\. Kept after merging: (\d+)\./);
    const d = readFileSync(join(ex, 'merge-report.md'), 'utf8').match(/Merged: (\d+) by rule, (\d+) by the model/);
    const t = readFileSync(join(ex, 'merge-report.md'), 'utf8').match(/Dropped as already on the timeline: (\d+)/);
    if (m) out.merge = { candidates: num(m[1]), kept: num(m[3]), merged: d ? num(d[1]) + num(d[2]) : null, alreadyOnTimeline: t ? num(t[1]) : null };
  }
  const draftsDir = join(repoRoot, 'src', 'data', 'events', 'imported', book.slug);
  if (existsSync(draftsDir)) {
    const files = readdirSync(draftsDir).filter((f) => f.endsWith('.json'));
    if (files.length) out.draft = { drafts: files.length, located: files.filter((f) => JSON.parse(readFileSync(join(draftsDir, f), 'utf8')).location).length };
  }
  if (existsSync(join(ex, 'enrich-report.md'))) {
    const e = readFileSync(join(ex, 'enrich-report.md'), 'utf8').match(/Matched (\d+) of (\d+) draft\(s\)/);
    if (e) out.enrich = { enriched: num(e[1]), drafts: num(e[2]), unmatched: num(e[2]) - num(e[1]) };
  }
  return out;
}

async function main() {
  if (!dry) requireSupabase();
  const books = loadBooks();
  let rows = 0;
  for (const book of books.values()) {
    const found = fromDisk(book);
    for (const stage of STAGES) {
      const stats = found[stage];
      if (!stats) continue;
      // A partial extraction is still running from the board's point of view only while a job holds it; here it is simply what exists.
      const state = stage === 'extract-local' && stats.chunks && stats.done < stats.chunks ? 'pending' : 'done';
      rows += 1;
      if (dry) console.log(`${book.slug} ${stage} ${state} ${JSON.stringify(stats)}`);
      else await queue.setStatus(book.slug, stage, state, { stats });
    }
  }
  console.log(`${dry ? 'Would write' : 'Wrote'} ${rows} board row(s) for ${books.size} book(s)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
