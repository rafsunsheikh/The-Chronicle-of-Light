import { supabase } from './supabase';
import type { AiJob, AiJobInput, AiJobKind } from '../types/aiJob';

const NO_BACKEND = 'The backend is not configured.';

/** Every job, newest first. Row-level security limits this to maintainers. */
export async function listAiJobs(): Promise<{ jobs: AiJob[]; error?: string }> {
  if (!supabase) return { jobs: [], error: NO_BACKEND };
  const { data, error } = await supabase
    .from('ai_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { jobs: [], error: error.message };
  return { jobs: (data ?? []) as AiJob[] };
}

export async function createAiJob(
  kind: AiJobKind,
  input: AiJobInput,
  userId: string,
): Promise<{ error?: string }> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase.from('ai_jobs').insert({ kind, input, created_by: userId });
  return { error: error?.message };
}

/** Only queued jobs can be cancelled; row-level security enforces that too. */
export async function cancelAiJob(id: string): Promise<{ error?: string }> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase
    .from('ai_jobs')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'queued');
  return { error: error?.message };
}
