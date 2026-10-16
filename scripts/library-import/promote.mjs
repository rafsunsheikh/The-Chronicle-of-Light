#!/usr/bin/env node
// Move reviewed library drafts from src/data/library/imported/** into
// src/data/library/, optionally flipping confidence, then validate.
//
//   node scripts/library-import/promote.mjs --all [--established]
//   node scripts/library-import/promote.mjs lib-1911-rhazes-encyclopaedia-britannica-1911 ... [--established]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { importedDir, libraryDir, repoRoot } from './lib.mjs';

const args = process.argv.slice(2);
const ids = args.filter((a) => a.startsWith('lib-'));
const all = args.includes('--all');
const established = args.includes('--established');
if (!all && ids.length === 0) {
  console.error('Usage: node scripts/library-import/promote.mjs (--all | <lib-id> ...) [--established]');
  process.exit(1);
}
const files = [];
const walk = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (entry.endsWith('.json') && (all || ids.includes(entry.replace(/\.json$/, '')))) files.push(full);
  }
};
walk(importedDir);
let moved = 0;
for (const full of files) {
  const record = JSON.parse(fs.readFileSync(full, 'utf8'));
  if (record.summary === 'Summary to be written during review.') {
    console.error(`skip ${record.id}: summary not written yet`);
    continue;
  }
  if (established) record.confidence = 'established';
  fs.writeFileSync(path.join(libraryDir, `${record.id}.json`), JSON.stringify(record, null, 2) + '\n');
  fs.unlinkSync(full);
  moved += 1;
}
console.log(`Promoted ${moved} resource(s) to ${path.relative(repoRoot, libraryDir)}`);
execFileSync('node', [path.join(repoRoot, 'scripts', 'validate-library.mjs')], { stdio: 'inherit' });
