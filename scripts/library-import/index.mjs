#!/usr/bin/env node
// Collect open books, reports and articles into library drafts for review.
//
//   npm run import:library -- --source wikisource --query "Rhazes" --category medicine
//   npm run import:library -- --source gutenberg --query "moors spain" --category art-and-architecture,institutions
//   npm run import:library -- --source openlibrary --query "literary history of persia" --category literature-and-poetry
//   npm run import:library -- --source ia --query 'creator:(browne) AND title:(arabian medicine)' --category medicine
//
// Drafts go to src/data/library/imported/<source>/ (gitignored) with
// confidence auto-imported. Review, write the summary, confirm the licence,
// then promote with scripts/library-import/promote.mjs.
import path from 'node:path';
import { existingIds, repoRoot, writeDraft } from './lib.mjs';

const CATEGORIES = [
  'science-and-mathematics', 'astronomy', 'medicine', 'philosophy-and-theology', 'literature-and-poetry',
  'art-and-architecture', 'translation-movement', 'institutions', 'geography-and-travel',
];
const SOURCES = ['wikisource', 'gutenberg', 'openlibrary', 'ia'];

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error('Usage: npm run import:library -- --source <wikisource|gutenberg|openlibrary|ia> --query "<q>" --category <cat>[,<cat>] [--type book|report|article|video|course] [--max 20] [--dry-run]');
  process.exit(msg ? 1 : 0);
}

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = opt('--source');
const query = opt('--query');
const categories = (opt('--category') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const type = opt('--type');
const max = Number(opt('--max') ?? 20);
const dryRun = args.includes('--dry-run');
if (args.includes('--help')) usage();
if (!SOURCES.includes(source)) usage(`--source must be one of ${SOURCES.join(', ')}`);
if (!query) usage('--query is required');
if (categories.length === 0) usage('--category is required');
for (const c of categories) if (!CATEGORIES.includes(c)) usage(`unknown category ${c}`);

const mod = await import(`./sources/${source}.mjs`);
const records = await mod.search({ query, max, type, categories });
const existing = existingIds();
let written = 0, skipped = 0;
for (const r of records) {
  // Two editions with the same title in one run get distinct ids.
  const base = r.id;
  for (let n = 2; existing.has(r.id) && records.some((o) => o !== r && o.id === base); n++) r.id = `${base}-${n}`;
  const { file, status } = writeDraft(r, { source, existing, dryRun });
  if (status === 'written') existing.add(r.id);
  const rel = path.relative(repoRoot, file);
  const tag = status === 'written' ? '+' : status === 'exists' ? '=' : '?';
  console.log(`${tag} ${r.year} ${r.license.padEnd(14)} ${r.title.slice(0, 60).padEnd(60)} ${status === 'written' ? rel : status}`);
  if (status === 'written') written += 1; else skipped += 1;
}
console.log(`\n${records.length} result(s): ${written} draft(s) written, ${skipped} skipped${dryRun ? ' (dry run)' : ''}.`);
if (!dryRun && written) console.log('Review the drafts, write summaries, confirm licences, then: node scripts/library-import/promote.mjs --all');
