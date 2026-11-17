import { supabase } from './supabase';
import type { PipelineStage, PipelineStatus } from '../types/pipeline';

const NO_BACKEND = 'The backend is not configured.';

/** The whole board. Row-level security limits it to maintainers. */
export async function listPipelineStatus(): Promise<{ rows: PipelineStatus[]; error?: string }> {
  if (!supabase) return { rows: [], error: NO_BACKEND };
  const { data, error } = await supabase.from('pipeline_status').select('*').limit(1000);
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as PipelineStatus[] };
}

/**
 * Queue one stage, or every stage in order, for one book. The runner refuses
 * any slug that is not in the manifests, so the input carries nothing else
 * it could act on.
 */
export async function queuePipelineJob(
  kind: PipelineStage | 'all',
  book: { slug: string; title: string },
  userId: string,
  force = false,
): Promise<{ error?: string }> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase
    .from('ai_jobs')
    .insert({ kind, input: { slug: book.slug, title: book.title, source: book.slug, force }, created_by: userId });
  return { error: error?.message };
}
