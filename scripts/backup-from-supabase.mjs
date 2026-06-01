// Mirror the Supabase `events` table back into src/data/events/*.json.
//
// Used by the scheduled GitHub Action (and runnable locally) to keep the repo a
// living backup of the canonical knowledge base. Reads with the anon key (the
// events table is world-readable). Writes each event to its stored source_path
// and prunes JSON files whose id no longer exists in the table.
//
//   npm run backup:supabase

import { readdirSync, statSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, EVENTS_DIR } from './_env.mjs';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

// Fetch the whole table, paginated (PostgREST caps responses at 1,000 rows).
const PAGE = 1000;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from('events')
    .select('id, payload, source_path')
    .range(from, from + PAGE - 1);
  if (error) {
    console.error('Fetch failed:', error.message);
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < PAGE) break;
}

if (rows.length === 0) {
  console.error('Refusing to back up: the events table is empty (not seeded?).');
  process.exit(1);
}

// Write each event to its source path (default "<id>.json" at the root).
const written = new Set();
for (const row of rows) {
  const rel = row.source_path || `${row.id}.json`;
  const dest = join(EVENTS_DIR, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(row.payload, null, 2) + '\n');
  written.add(relative(EVENTS_DIR, dest));
}

// Prune any local *.json files that are no longer in the table.
function walkJson(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkJson(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

let pruned = 0;
for (const file of walkJson(EVENTS_DIR)) {
  if (!written.has(relative(EVENTS_DIR, file))) {
    rmSync(file);
    pruned += 1;
  }
}

console.log(`✅ Backed up ${written.size} events (${pruned} stale file(s) pruned).`);
