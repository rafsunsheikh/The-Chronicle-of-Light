#!/usr/bin/env node
// Validates every src/data/events/*.json against event.schema.json
// AND checks that every `connections` ID points to an existing event.
// Exits 0 on success, 1 on any failure. Used by CI.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const schemaPath = path.join(repoRoot, 'src', 'data', 'event.schema.json');
const eventsDir = path.join(repoRoot, 'src', 'data', 'events');

const colors = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

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

const files = walk(eventsDir)
  .map((full) => path.relative(eventsDir, full))
  .sort();

if (files.length === 0) {
  console.error(colors.red(`No event files found in ${eventsDir}`));
  process.exit(1);
}

const seenIds = new Map(); // id -> filename
const events = [];

for (const relPath of files) {
  const filename = relPath; // e.g. "event-001-...json" or "imported/event-017-...json"
  const filepath = path.join(eventsDir, relPath);
  const basename = path.basename(relPath);
  let event;
  try {
    event = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    errors.push(`${filename}: invalid JSON — ${e.message}`);
    continue;
  }

  const valid = validate(event);
  if (!valid) {
    for (const err of validate.errors ?? []) {
      const where = err.instancePath || '(root)';
      errors.push(
        `${filename}: schema violation at ${where} — ${err.message}` +
          (err.params ? ` ${JSON.stringify(err.params)}` : ''),
      );
    }
    continue;
  }

  if (seenIds.has(event.id)) {
    errors.push(
      `${filename}: duplicate id "${event.id}" (already in ${seenIds.get(event.id)})`,
    );
    continue;
  }
  seenIds.set(event.id, filename);

  const expectedPrefix = event.id + '-';
  if (!basename.startsWith(expectedPrefix)) {
    errors.push(
      `${filename}: filename should start with "${expectedPrefix}" (id is "${event.id}")`,
    );
  }

  if (event.endDate && event.startDate > event.endDate) {
    errors.push(
      `${filename}: endDate (${event.endDate}) is before startDate (${event.startDate})`,
    );
  }

  if (event.confidence === 'auto-imported' || event.confidence === 'contested') {
    if (!event.sources || event.sources.length === 0) {
      errors.push(
        `${filename}: confidence "${event.confidence}" requires at least one entry in sources[]`,
      );
    }
  }

  if (event.confidence === 'contested') {
    if (!event.perspectives || event.perspectives.length === 0) {
      errors.push(
        `${filename}: confidence "contested" requires perspectives[] with at least one entry`,
      );
    }
  }

  events.push({ filename, event });
}

const allIds = new Set(events.map((e) => e.event.id));
for (const { filename, event } of events) {
  for (const connId of event.connections ?? []) {
    if (!allIds.has(connId)) {
      errors.push(
        `${filename}: connections references unknown event "${connId}"`,
      );
    }
    if (connId === event.id) {
      errors.push(`${filename}: connections includes its own id`);
    }
  }
}

if (errors.length > 0) {
  console.error(colors.red(`\n✗ ${errors.length} validation error(s):\n`));
  for (const e of errors) {
    console.error('  ' + colors.red('•') + ' ' + e);
  }
  console.error(
    colors.dim(`\nValidated ${files.length} event file(s) against the schema.`),
  );
  process.exit(1);
}

console.log(
  colors.green(`✓ ${events.length} event(s) validated, connections intact`),
);
