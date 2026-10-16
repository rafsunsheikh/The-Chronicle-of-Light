#!/usr/bin/env node
// Stage 4: move reviewed drafts out of src/data/events/imported/<slug>/ into
// src/data/events/<slug>/ so they ship with the site, then run the validator.
//
//   npm run extract:promote -- <slug> --all
//   npm run extract:promote -- <slug> event-0634-battle-of-the-bridge event-0636-...
//   add --established to flip confidence from auto-imported to established
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { eventsDir, importedDir, repoRoot } from './common.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--') && !a.startsWith('event-'));
const ids = args.filter((a) => a.startsWith('event-'));
const all = args.includes('--all');
const established = args.includes('--established');
if (!slug || (!all && ids.length === 0)) {
  console.error('Usage: npm run extract:promote -- <slug> (--all | <event-id> ...) [--established]');
  process.exit(1);
}
const src = path.join(importedDir, slug);
const dst = path.join(eventsDir, slug);
if (!fs.existsSync(src)) {
  console.error(`No drafts at ${path.relative(repoRoot, src)}`);
  process.exit(1);
}
fs.mkdirSync(dst, { recursive: true });
const files = fs.readdirSync(src).filter((f) => f.endsWith('.json') && (all || ids.includes(f.replace(/\.json$/, ''))));
let moved = 0;
for (const f of files) {
  const record = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  if (established) record.confidence = 'established';
  fs.writeFileSync(path.join(dst, f), JSON.stringify(record, null, 2) + '\n');
  fs.unlinkSync(path.join(src, f));
  moved += 1;
}
const missing = ids.filter((id) => !files.includes(`${id}.json`));
if (missing.length) console.error(`Not found in drafts: ${missing.join(', ')}`);
console.log(`Promoted ${moved} event(s) to ${path.relative(repoRoot, dst)}`);
execFileSync('node', [path.join(repoRoot, 'scripts', 'validate-events.mjs')], { stdio: 'inherit' });
