// Development-only sample data for the pipeline panel, so the screen can be
// looked at without a Supabase project: open /#/admin?preview=pipeline on the
// dev server. Vite drops this from production builds (import.meta.env.DEV).
// The figures are the real ones measured for volume 35 on 2026-11-17.
import type { AiJob } from '../../types/aiJob';
import type { PipelineStatus } from '../../types/pipeline';

const at = '2026-11-17T08:40:00.000Z';
const row = (slug: string, stage: PipelineStatus['stage'], state: PipelineStatus['state'], stats: PipelineStatus['stats'], error: string | null = null): PipelineStatus => ({
  slug,
  stage,
  state,
  stats,
  job_id: null,
  error,
  updated_at: at,
});

export const FIXTURE_BOARD: PipelineStatus[] = [
  row('tabari-volume-35', 'convert', 'done', { pages: 202, words: 72257, figures: 4 }),
  row('tabari-volume-35', 'chunk', 'done', { chunks: 59, withAnnal: 54 }),
  row('tabari-volume-35', 'extract-local', 'running', { chunks: 59, done: 28, events: 171, secondsPerChunk: 177, failed: 1 }),
  row('tabari-volume-35', 'merge', 'done', { candidates: 171, kept: 145, merged: 15, alreadyOnTimeline: 11, datesFromAnnal: 0 }),
  row('tabari-volume-35', 'draft', 'done', { drafts: 145, located: 78 }),
  row('tabari-volume-35', 'enrich', 'done', { enriched: 74, unmatched: 71, drafts: 145 }),
  row('tabari-volume-02', 'convert', 'done', { pages: 220, words: 73541, figures: 3 }),
  row('tabari-volume-02', 'chunk', 'done', { chunks: 58, withAnnal: 0 }),
  row('tabari-volume-30', 'convert', 'done', { pages: 394, words: 143699, figures: 8 }),
  row('tabari-volume-30', 'chunk', 'done', { chunks: 121, withAnnal: 33 }),
  row('tabari-volume-30', 'extract-local', 'failed', { chunks: 121, done: 3, events: 9 }, 'model server at http://localhost:8080 is unreachable (fetch failed)'),
  ...['01', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((n) => row(`tabari-volume-${n}`, 'convert', 'done', { pages: 250, words: 90000, figures: 4 })),
  row('akram-muslim-conquest-of-persia', 'convert', 'done', { pages: 332, words: 127204, figures: 20 }),
];

export const FIXTURE_JOBS: AiJob[] = [
  {
    id: 'job-1',
    kind: 'extract-local',
    input: { slug: 'tabari-volume-35', title: 'The History of al-Tabari, Volume 35: The Crisis of the Abbasid Caliphate', source: 'tabari-volume-35' },
    status: 'running',
    stage: 'extract-local: reading chunks with the local model: 171 events so far',
    progress_done: 28,
    progress_total: 59,
    attempts: 1,
    error: null,
    result: null,
    created_by: 'preview',
    created_at: '2026-11-17T07:00:00.000Z',
    claimed_at: '2026-11-17T07:00:10.000Z',
    heartbeat_at: at,
    finished_at: null,
  },
  {
    id: 'job-0',
    kind: 'convert',
    input: { slug: 'tabari-volume-02', title: 'The History of al-Tabari, Volume 2: Prophets and Patriarchs', source: 'tabari-volume-02' },
    status: 'done',
    stage: 'done',
    progress_done: 1,
    progress_total: 1,
    attempts: 1,
    error: null,
    result: { durationMs: 69000, costUsd: 0, stages: { convert: { pages: 220, words: 73541 } } },
    created_by: 'preview',
    created_at: '2026-11-15T05:00:00.000Z',
    claimed_at: '2026-11-15T05:00:05.000Z',
    heartbeat_at: '2026-11-15T05:01:14.000Z',
    finished_at: '2026-11-15T05:01:14.000Z',
  },
];
