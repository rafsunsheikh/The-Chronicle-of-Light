export type AiJobKind = 'summarize' | 'extract';
export type AiJobStatus = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface AiJobInput {
  /** A URL, or a path inside the repo on the runner machine (content/private/<slug>/content.md). */
  source: string;
  title: string;
  author?: string | null;
  /** Folder name under content/ and src/data/events/. Derived from the title when empty. */
  slug?: string | null;
  /** True only for public domain or openly licensed sources: the text is hosted too. */
  public?: boolean;
  /** For extract jobs: a chunk range such as "1-10". Empty means every chunk. */
  chunks?: string | null;
}

export interface AiJobResult {
  prUrl?: string | null;
  branch?: string | null;
  files?: string[];
  model?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  drafts?: number;
}

export interface AiJob {
  id: string;
  kind: AiJobKind;
  input: AiJobInput;
  status: AiJobStatus;
  stage: string | null;
  progress_done: number;
  progress_total: number;
  attempts: number;
  error: string | null;
  result: AiJobResult | null;
  created_by: string;
  created_at: string;
  claimed_at: string | null;
  heartbeat_at: string | null;
  finished_at: string | null;
}
