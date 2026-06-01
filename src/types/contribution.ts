import { HistoricalIncident } from './incident';

export type UserRole = 'contributor' | 'maintainer';

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  role: UserRole;
  created_at: string;
}

export type SubmissionType = 'edit' | 'create';
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface EventSubmission {
  id: string;
  event_id: string;
  type: SubmissionType;
  status: SubmissionStatus;
  payload: HistoricalIncident;
  author_id: string;
  author_email: string | null;
  note: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface EventOverride {
  event_id: string;
  payload: HistoricalIncident;
  updated_at: string;
  updated_by: string | null;
}

/** One row of the contributors leaderboard (see `contributor_leaderboard` RPC). */
export interface LeaderboardEntry {
  author_id: string;
  display_name: string;
  approved_count: number;
  pending_count: number;
  rejected_count: number;
  total_count: number;
  last_contribution: string;
}
