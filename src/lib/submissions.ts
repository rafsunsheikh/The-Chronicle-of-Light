import { supabase } from './supabase';
import type { HistoricalIncident } from '../types/incident';
import type {
  EventSubmission,
  LeaderboardEntry,
  SubmissionType,
} from '../types/contribution';

export interface SubmitResult {
  error?: string;
}

const NO_BACKEND = 'Sign-in is not available — backend not configured.';

/**
 * Insert a proposed edit / new event as a `pending` submission. The change is
 * NOT applied to the live data until a maintainer approves it.
 */
export async function createSubmission(params: {
  type: SubmissionType;
  payload: HistoricalIncident;
  authorId: string;
  authorEmail: string | null;
  note?: string;
}): Promise<SubmitResult> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase.from('event_submissions').insert({
    event_id: params.payload.id,
    type: params.type,
    status: 'pending',
    payload: params.payload,
    author_id: params.authorId,
    author_email: params.authorEmail,
    note: params.note?.trim() ? params.note.trim() : null,
  });
  return { error: error?.message };
}

/** A contributor's own submissions, newest first. */
export async function listMySubmissions(
  authorId: string,
): Promise<EventSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as EventSubmission[];
}

/** Pending submissions awaiting review (maintainers only, enforced by RLS). */
export async function listPendingSubmissions(): Promise<EventSubmission[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('event_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data as EventSubmission[];
}

/** Approve a submission → applies its payload to the live overrides (RPC). */
export async function approveSubmission(
  submissionId: string,
  note?: string,
): Promise<SubmitResult> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase.rpc('approve_submission', {
    submission_id: submissionId,
    note: note?.trim() ? note.trim() : null,
  });
  return { error: error?.message };
}

/** Reject a submission (RPC). */
export async function rejectSubmission(
  submissionId: string,
  note?: string,
): Promise<SubmitResult> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase.rpc('reject_submission', {
    submission_id: submissionId,
    note: note?.trim() ? note.trim() : null,
  });
  return { error: error?.message };
}

/**
 * Contributors ranked by approved submissions (server-side aggregation via the
 * `contributor_leaderboard` RPC, which safely reads past RLS). Public — works
 * for logged-out visitors too.
 */
export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('contributor_leaderboard');
  if (error || !data) return [];
  return data as LeaderboardEntry[];
}

/** A contributor withdraws their own still-pending submission. */
export async function withdrawSubmission(
  submissionId: string,
): Promise<SubmitResult> {
  if (!supabase) return { error: NO_BACKEND };
  const { error } = await supabase
    .from('event_submissions')
    .delete()
    .eq('id', submissionId);
  return { error: error?.message };
}
