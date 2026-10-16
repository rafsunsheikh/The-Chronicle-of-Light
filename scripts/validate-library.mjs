#!/usr/bin/env node
// Validates every src/data/library/*.json against library.schema.json and
// checks the rules the schema cannot express on its own:
//   - unique ids, filename == id + ".json", id year == `year`
//   - hosted entries need a contentPath that exists and a redistributable license
//   - video entries need a `video` block; other types must not have one
//   - every relatedEvents id points to a real event in src/data/events/
// Exits 0 on success, 1 on any failure. Used by CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'src', 'data', 'library.schema.json');
const libraryDir = path.join(repoRoot, 'src', 'data', 'library');
const eventsDir = path.join(repoRoot, 'src', 'data', 'events');

const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// Licenses under which we may copy the full text into this repo.
const REDISTRIBUTABLE = new Set(['public-domain', 'cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'cc-by-nc-sa']);

const errors = [];

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, acc);
    else if (entry.endsWith('.json')) acc.push(full);
  }
  return acc;
}

// Known event ids, so relatedEvents can be cross-checked.
const eventIds = new Set();
for (const full of walk(eventsDir)) {
  try {
    const ev = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (ev && typeof ev.id === 'string') eventIds.add(ev.id);
  } catch {
    // validate-events.mjs reports broken event files; ignore here.
  }
}

const files = walk(libraryDir)
  .map((full) => path.relative(libraryDir, full))
  .sort();

if (files.length === 0) {
  console.error(colors.red(`No library files found in ${libraryDir}`));
  process.exit(1);
}

const seenIds = new Map();
let validCount = 0;

for (const relPath of files) {
  const filename = relPath;
  const filepath = path.join(libraryDir, relPath);
  const basename = path.basename(relPath);
  let res;
  try {
    res = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    errors.push(`${filename}: invalid JSON: ${e.message}`);
    continue;
  }

  if (!validate(res)) {
    for (const err of validate.errors ?? []) {
      const where = err.instancePath || '(root)';
      errors.push(
        `${filename}: schema violation at ${where}: ${err.message}` +
          (err.params ? ` ${JSON.stringify(err.params)}` : ''),
      );
    }
    continue;
  }

  if (seenIds.has(res.id)) {
    errors.push(`${filename}: duplicate id "${res.id}" (already in ${seenIds.get(res.id)})`);
    continue;
  }
  seenIds.set(res.id, filename);

  if (basename !== `${res.id}.json`) {
    errors.push(`${filename}: filename should be "${res.id}.json" (id is "${res.id}")`);
  }

  const idYear = /^lib-(\d{4})-/.exec(res.id)?.[1];
  const expectedYear = String(res.year).padStart(4, '0');
  if (idYear !== expectedYear) {
    errors.push(`${filename}: id year "${idYear}" does not match year ${res.year}`);
  }

  if (res.hosted) {
    if (!res.contentPath) {
      errors.push(`${filename}: hosted is true but contentPath is missing`);
    } else if (!fs.existsSync(path.join(repoRoot, res.contentPath))) {
      errors.push(`${filename}: contentPath "${res.contentPath}" does not exist`);
    }
    if (!REDISTRIBUTABLE.has(res.license)) {
      errors.push(
        `${filename}: hosted is true but license "${res.license}" does not allow redistribution`,
      );
    }
  } else if (res.contentPath) {
    errors.push(`${filename}: contentPath is set but hosted is false`);
  }

  if (res.type === 'video' && !res.video) {
    errors.push(`${filename}: type "video" requires a video block`);
  }
  if (res.type !== 'video' && res.video) {
    errors.push(`${filename}: video block is only allowed when type is "video"`);
  }

  for (const evId of res.relatedEvents ?? []) {
    if (!eventIds.has(evId)) {
      errors.push(`${filename}: relatedEvents references unknown event "${evId}"`);
    }
  }

  validCount += 1;
}

if (errors.length > 0) {
  console.error(colors.red(`\n✗ ${errors.length} validation error(s):\n`));
  for (const e of errors) console.error('  ' + colors.red('•') + ' ' + e);
  console.error(colors.dim(`\nValidated ${files.length} library file(s) against the schema.`));
  process.exit(1);
}

console.log(colors.green(`✓ ${validCount} library resource(s) validated, related events intact`));
