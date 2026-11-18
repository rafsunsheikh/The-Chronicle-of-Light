/** The book pipeline as the admin page sees it: one row per book and stage,
 *  kept by the runner in the pipeline_status table (migration 0005). */
export const PIPELINE_STAGES = ['convert', 'chunk', 'extract-local', 'merge', 'draft', 'enrich'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export type PipelineState = 'pending' | 'running' | 'done' | 'failed';

export const STAGE_LABEL: Record<PipelineStage, string> = {
  convert: 'Convert',
  chunk: 'Chunk',
  'extract-local': 'Extract',
  merge: 'Merge',
  draft: 'Draft',
  enrich: 'Enrich',
};

/** What each stage reports. Keys match what runner/src/pipeline.mjs writes. */
export interface PipelineStats {
  pages?: number | null;
  words?: number | null;
  figures?: number | null;
  chunks?: number | null;
  withAnnal?: number | null;
  done?: number | null;
  events?: number | null;
  secondsPerChunk?: number | null;
  failed?: number | null;
  candidates?: number | null;
  kept?: number | null;
  merged?: number | null;
  alreadyOnTimeline?: number | null;
  datesFromAnnal?: number | null;
  drafts?: number | null;
  located?: number | null;
  enriched?: number | null;
  unmatched?: number | null;
}

export interface PipelineStatus {
  slug: string;
  stage: PipelineStage;
  state: PipelineState;
  stats: PipelineStats;
  job_id: string | null;
  error: string | null;
  updated_at: string;
}

/** A book from scripts/convert/manifests/*.json, bundled with the site. */
export interface PipelineBook {
  slug: string;
  title: string;
  author: string | null;
  translator?: string | null;
  public?: boolean;
  /** Set for books uploaded from the admin page (pipeline_books), absent for manifest books. */
  upload?: { state: UploadState; error: string | null; createdAt: string };
}

/** An uploaded book's own state, kept by queue_book_upload() and the runner (migration 0006). */
export type UploadState = 'uploaded' | 'fetched' | 'failed';

/** A row of pipeline_books as the admin page reads it. */
export interface UploadedBook {
  slug: string;
  title: string;
  author: string | null;
  translator: string | null;
  is_public: boolean;
  size_bytes: number | null;
  state: UploadState;
  error: string | null;
  created_at: string;
}
