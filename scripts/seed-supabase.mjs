// One-time seed: load every event JSON file into the Supabase `events` table.
//
// Requires the SERVICE ROLE key (it bypasses row-level security so the bulk
// insert is allowed). Run once, locally:
//
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:supabase
//
// (or add SUPABASE_SERVICE_ROLE_KEY to your .env). The service-role key is a
// secret — never commit it or expose it in the browser.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, EVENTS_DIR } from './_env.mjs';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in .env or inline, e.g.\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=… npm run seed:supabase',
  );
  process.exit(1);
}

function walkJson(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkJson(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

const files = walkJson(EVENTS_DIR);
const rows = files.map((file) => {
  const payload = JSON.parse(readFileSync(file, 'utf8'));
  return {
    id: payload.id,
    payload,
    source_path: relative(EVENTS_DIR, file),
  };
});

console.log(`Found ${rows.length} event files. Upserting into Supabase…`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const BATCH = 500;
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  const { error } = await supabase.from('events').upsert(batch, { onConflict: 'id' });
  if (error) {
    console.error(`Batch starting at ${i} failed:`, error.message);
    process.exit(1);
  }
  done += batch.length;
  console.log(`  upserted ${done}/${rows.length}`);
}

console.log(`✅ Seeded ${done} events.`);
