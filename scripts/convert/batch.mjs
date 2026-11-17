#!/usr/bin/env node
// Convert every book listed in a manifest, one after another, with the same
// converter as `npm run convert`. Books already converted are skipped unless
// --force is given, so an interrupted batch can simply be run again.
//
//   BOOKS_DIR=~/books npm run convert:batch -- scripts/convert/manifests/tabari.json [--force] [--only tabari-volume-35]
//
// A manifest is JSON: { baseDir, author?, items: [{ input, slug, title, author?, translator?, public? }] }.
// `baseDir` may use ${VAR} for an environment variable; `input` is relative to it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

const argv = process.argv.slice(2);
const manifestPath = argv.find((a) => !a.startsWith('--'));
if (!manifestPath) {
  console.error('Usage: npm run convert:batch -- <manifest.json> [--force] [--only <slug>[,<slug>]] [--engine pdfdown|pdfjs]');
  process.exit(1);
}
const force = argv.includes('--force');
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
const engine = argv.includes('--engine') ? argv[argv.indexOf('--engine') + 1] : null;

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const baseDir = (manifest.baseDir || '').replace(/\$\{(\w+)\}/g, (_, name) => {
  if (!process.env[name]) {
    console.error(`Set ${name} to the folder holding the source files (the manifest's baseDir uses it).`);
    process.exit(1);
  }
  return process.env[name];
});

const items = manifest.items.filter((item) => !only || only.includes(item.slug));
const started = Date.now();
const done = [];
const skipped = [];
const failed = [];
for (const [i, item] of items.entries()) {
  const input = path.resolve(baseDir, item.input);
  const outDir = path.join(repoRoot, 'content', item.public ? 'books' : 'private', item.slug);
  const label = `[${i + 1}/${items.length}] ${item.slug}`;
  if (fs.existsSync(path.join(outDir, 'content.md')) && !force) {
    console.error(`${label}: already converted, skipping (use --force to redo)`);
    skipped.push(item.slug);
    continue;
  }
  if (!fs.existsSync(input)) {
    console.error(`${label}: missing source ${input}`);
    failed.push({ slug: item.slug, error: 'missing source' });
    continue;
  }
  const author = item.author ?? manifest.author ?? null;
  const authorLine = author ? (item.translator ? `${author}, translated by ${item.translator}` : author) : null;
  const args = [path.join(__dirname, 'index.mjs'), input, '--slug', item.slug, '--title', item.title];
  if (authorLine) args.push('--author', authorLine);
  if (item.public) args.push('--public');
  if (force) args.push('--force');
  if (engine) args.push('--engine', engine);
  console.error(`${label}: ${item.title}`);
  const t0 = Date.now();
  const run = spawnSync(process.execPath, args, { stdio: 'inherit' });
  const seconds = Math.round((Date.now() - t0) / 1000);
  if (run.status === 0) done.push(item.slug);
  else failed.push({ slug: item.slug, error: `exit code ${run.status} after ${seconds} s` });
}

const minutes = Math.round((Date.now() - started) / 60000);
console.error(
  `\nBatch finished in ${minutes} min: ${done.length} converted, ${skipped.length} skipped, ${failed.length} failed.`,
);
for (const f of failed) console.error(`  failed: ${f.slug} (${f.error})`);
process.exit(failed.length ? 1 : 0);
