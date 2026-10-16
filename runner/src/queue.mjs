// The Supabase side of the runner: claim, heartbeat, finish, fail. Uses the
// service-role key, which bypasses row-level security and never leaves the
// runner machine.
import { createClient } from '@supabase/supabase-js';
import { config } from './config.mjs';

let client = null;
const db = () =>
  (client ??= createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } }));

export async function ping() {
  const { count, error } = await db().from('ai_jobs').select('id', { count: 'exact', head: true }).eq('status', 'queued');
  if (error) throw new Error(error.message);
  return { pending: count ?? 0 };
}

/** Claim one job through the atomic SQL function, or null when the queue is empty. */
export async function claim() {
  const { data, error } = await db().rpc('claim_ai_job', { stale_minutes: config.staleMinutes });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows[0] ?? null;
}

export async function progress(id, stage, done = 0, total = 0) {
  const { error } = await db()
    .from('ai_jobs')
    .update({ stage, progress_done: done, progress_total: total, heartbeat_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function complete(id, result) {
  const now = new Date().toISOString();
  const { error } = await db()
    .from('ai_jobs')
    .update({ status: 'done', stage: 'done', result, finished_at: now, heartbeat_at: now })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fail(id, message) {
  const { error } = await db()
    .from('ai_jobs')
    .update({ status: 'failed', stage: 'failed', error: String(message).slice(0, 2000), finished_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
