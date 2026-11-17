import { useMemo, useRef, useState } from 'react';
import { allBooks } from '../../data/pipeline/books';
import { queuePipelineJob } from '../../lib/pipeline';
import type { AiJob } from '../../types/aiJob';
import { PIPELINE_STAGES, STAGE_LABEL, type PipelineBook, type PipelineStage, type PipelineStatus, type UploadedBook } from '../../types/pipeline';
import { AddBookDialog, type Uploader } from './AddBookDialog';

// 'upload' jobs fetch an uploaded PDF and then convert it (runner/src/uploads.mjs).
const PIPELINE_KINDS = new Set<string>([...PIPELINE_STAGES, 'all', 'upload']);

const isPipelineJob = (j: AiJob) => PIPELINE_KINDS.has(j.kind);

/** What a book has reached, read from the board and the live queue. */
interface BookRow {
  book: PipelineBook;
  byStage: Partial<Record<PipelineStage, PipelineStatus>>;
  /** The queued or running pipeline job for this book, if any. */
  job: AiJob | null;
  next: PipelineStage | null;
  /** The furthest stage that is done, for the stage chip. */
  reached: PipelineStage | null;
  failed: PipelineStatus | null;
}

function rowsFor(books: PipelineBook[], board: PipelineStatus[], jobs: AiJob[]): BookRow[] {
  const bySlug = new Map<string, Partial<Record<PipelineStage, PipelineStatus>>>();
  for (const r of board) {
    const m = bySlug.get(r.slug) ?? {};
    m[r.stage] = r;
    bySlug.set(r.slug, m);
  }
  const active = new Map<string, AiJob>();
  for (const j of jobs) {
    if (!isPipelineJob(j) || (j.status !== 'queued' && j.status !== 'running')) continue;
    const slug = String(j.input.slug ?? '');
    if (!active.has(slug)) active.set(slug, j);
  }
  return books.map((book) => {
    const byStage = bySlug.get(book.slug) ?? {};
    const failed = PIPELINE_STAGES.map((s) => byStage[s]).find((s) => s?.state === 'failed') ?? null;
    // An upload not yet on the owner's machine has no stage to run: the runner
    // fetches it, or, if that failed, the maintainer uploads it again.
    if (book.upload && book.upload.state !== 'fetched') {
      return { book, byStage, job: active.get(book.slug) ?? null, next: null, reached: null, failed };
    }
    let reached: PipelineStage | null = null;
    let next: PipelineStage | null = null;
    for (const stage of PIPELINE_STAGES) {
      const s = byStage[stage];
      if (s?.state === 'done') reached = stage;
      else {
        next = stage;
        break;
      }
    }
    // A partly read book is "done" with chunk but not with extraction: the board keeps extract-local pending with its counts.
    return { book, byStage, job: active.get(book.slug) ?? null, next, reached, failed };
  });
}

const fmt = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('en-AU') : '–');
const short = (title: string) => title.replace(/^The History of al-Tabari, /, '').replace(/^Volume (\d+): /, 'Vol. $1 · ');

function remaining(job: AiJob, row: BookRow): string | null {
  const per = row.byStage['extract-local']?.stats.secondsPerChunk;
  if (job.kind !== 'extract-local' && job.kind !== 'all') return null;
  if (!per || !job.progress_total) return null;
  const left = (job.progress_total - job.progress_done) * per;
  if (left < 90) return 'about a minute left';
  if (left < 3600) return `about ${Math.round(left / 60)} min left`;
  return `about ${(left / 3600).toFixed(1)} h left`;
}

const CHIP = {
  neutral: 'bg-slate-100 text-slate-700',
  running: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
};

function StageChip({ row }: { row: BookRow }) {
  let text = 'Not started';
  let tone: keyof typeof CHIP = 'neutral';
  if (row.job?.kind === 'upload') {
    text = row.job.status === 'queued' ? 'Waiting for the runner' : row.job.stage?.startsWith('convert') ? 'Converting' : 'Fetching';
    tone = 'running';
  } else if (row.book.upload?.state === 'failed' && !row.job) {
    text = 'Upload failed';
    tone = 'failed';
  } else if (row.book.upload?.state === 'uploaded' && !row.job) {
    text = 'Waiting for the runner';
  } else if (row.job) {
    text = row.job.status === 'queued' ? 'Queued' : `Running ${STAGE_LABEL[(row.job.stage?.split(':')[0] as PipelineStage) ?? row.job.kind as PipelineStage] ?? ''}`.trim();
    tone = 'running';
  } else if (row.failed) {
    text = `${STAGE_LABEL[row.failed.stage]} failed`;
    tone = 'failed';
  } else if (row.reached) {
    const extract = row.byStage['extract-local'];
    if (row.reached === 'chunk' && extract?.stats.done && extract.stats.chunks && extract.stats.done < extract.stats.chunks) {
      text = `Read ${extract.stats.done} of ${extract.stats.chunks}`;
    } else {
      text = { convert: 'Converted', chunk: 'Chunked', 'extract-local': 'Extracted', merge: 'Merged', draft: 'Drafted', enrich: 'Enriched' }[row.reached];
    }
    tone = row.reached === 'enrich' ? 'done' : 'neutral';
  }
  return <span className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full ${CHIP[tone]}`}>{text}</span>;
}

interface Props {
  board: PipelineStatus[];
  jobs: AiJob[];
  /** Books uploaded from this page (pipeline_books). */
  uploaded: UploadedBook[];
  userId: string;
  boardError: string | null;
  onQueued: () => Promise<unknown>;
  /** The dev preview passes a fake; the real page uses the default. */
  uploader?: Uploader;
}

export const PipelinePanel: React.FC<Props> = ({ board, jobs, uploaded, userId, boardError, onQueued, uploader }) => {
  const books = useMemo(() => allBooks(uploaded), [uploaded]);
  const rows = useMemo(() => rowsFor(books, board, jobs), [books, board, jobs]);
  const [adding, setAdding] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  // Names a new upload may not take: every book in the list, except uploads that failed (they may be uploaded again).
  const takenSlugs = useMemo(() => new Set(books.filter((b) => b.upload?.state !== 'failed').map((b) => b.slug)), [books]);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [queueAllBusy, setQueueAllBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const converted = rows.filter((r) => r.byStage.convert?.state === 'done').length;
    // An upload that failed before it reached the owner's machine has no file to convert; leave it out of the count.
    const counted = rows.filter((r) => !(r.book.upload?.state === 'failed' && r.byStage.convert?.state !== 'done')).length;
    let chunksRead = 0;
    let chunksTotal = 0;
    let drafts = 0;
    let enriched = 0;
    for (const r of rows) {
      const ex = r.byStage['extract-local']?.stats;
      const ch = r.byStage.chunk?.stats;
      chunksTotal += ex?.chunks ?? ch?.chunks ?? 0;
      chunksRead += ex?.done ?? 0;
      drafts += r.byStage.draft?.stats.drafts ?? 0;
      enriched += r.byStage.enrich?.stats.enriched ?? 0;
    }
    return { converted, counted, chunksRead, chunksTotal, drafts, enriched };
  }, [rows]);

  const running = rows.filter((r) => r.job);
  const withNext = rows.filter((r) => r.next && !r.job);
  const finding = running.length
    ? `${running.length} book${running.length > 1 ? 's' : ''} in progress`
    : totals.drafts
      ? `${fmt(totals.drafts)} draft event${totals.drafts === 1 ? '' : 's'} waiting for review; nothing running`
      : 'Nothing running';

  const queue = async (row: BookRow, kind: PipelineStage | 'all') => {
    setBusySlug(row.book.slug);
    setError(null);
    const { error: err } = await queuePipelineJob(kind, { slug: row.book.slug, title: row.book.title }, userId, row.failed?.stage === kind);
    setBusySlug(null);
    if (err) setError(err);
    else await onQueued();
  };

  const queueAll = async () => {
    if (!withNext.length) return;
    if (!window.confirm(`Queue every remaining stage for ${withNext.length} book${withNext.length > 1 ? 's' : ''}? The runner takes them one at a time; a full book is a few hours of local compute.`)) return;
    setQueueAllBusy(true);
    setError(null);
    for (const row of withNext) {
      const { error: err } = await queuePipelineJob('all', { slug: row.book.slug, title: row.book.title }, userId);
      if (err) {
        setError(err);
        break;
      }
    }
    setQueueAllBusy(false);
    await onQueued();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Books pipeline</h1>
          <p className="text-sm text-slate-600 mt-1">
            {totals.converted} of {totals.counted} books converted, {fmt(totals.chunksRead)} of {fmt(totals.chunksTotal)} chunks read. {finding}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            ref={addButtonRef}
            type="button"
            onClick={() => setAdding(true)}
            className="bg-teal-nma hover:bg-teal-nma/90 text-white text-xs font-semibold tracking-wider uppercase px-5 py-2.5 rounded-full min-h-[44px]"
          >
            Add a book
          </button>
          <button
            type="button"
            onClick={queueAll}
            disabled={queueAllBusy || withNext.length === 0}
            className="border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-800 text-xs font-semibold tracking-wider uppercase px-5 py-2.5 rounded-full min-h-[44px]"
          >
            {queueAllBusy ? 'Queueing…' : `Run every stage for ${withNext.length} book${withNext.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </header>

      {(error || boardError) && <p className="text-sm text-red-nma">{error ?? boardError}</p>}

      <dl className="bg-white rounded-md border border-slate-200 grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200">
        {[
          ['Books converted', `${totals.converted} / ${totals.counted}`],
          ['Chunks read', `${fmt(totals.chunksRead)} / ${fmt(totals.chunksTotal)}`],
          ['Draft events', fmt(totals.drafts)],
          ['Drafts with a Wikipedia source', `${fmt(totals.enriched)} / ${fmt(totals.drafts)}`],
        ].map(([label, value]) => (
          <div key={label} className="p-4">
            <dt className="text-sm text-slate-500">{label}</dt>
            <dd className="text-2xl text-slate-900 tabular-nums mt-1">{value}</dd>
          </div>
        ))}
      </dl>

      {running.length > 0 && (
        <section aria-live="polite" className="bg-white rounded-md border border-slate-200 p-4 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">Running now</h2>
          {running.map((row) => {
            const job = row.job!;
            const pct = job.progress_total ? Math.round((100 * job.progress_done) / job.progress_total) : job.status === 'running' ? 5 : 0;
            const left = remaining(job, row);
            return (
              <div key={job.id}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                  <span className="font-semibold text-slate-900">{short(row.book.title)}</span>
                  <span className="text-slate-600">{job.status === 'queued' ? 'queued, waiting for the runner' : job.stage ?? 'starting'}</span>
                  {job.progress_total > 0 && (
                    <span className="text-slate-600 tabular-nums">
                      {job.progress_done} of {job.progress_total}
                      {left ? ` · ${left}` : ''}
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 bg-slate-100 rounded overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${short(row.book.title)} progress`}>
                  <div className="h-full bg-teal-nma transition-[width] duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="bg-white rounded-md border border-slate-200">
        <h2 className="text-base font-semibold text-slate-900 px-4 pt-4">Books</h2>
        <p className="text-xs text-slate-500 px-4 pb-3">
          Each button runs the book's next stage on the owner's machine. Review, promote and the database seed stay manual.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th scope="col" className="text-left font-normal px-4 py-2">Book</th>
                <th scope="col" className="text-right font-normal px-3 py-2">Pages</th>
                <th scope="col" className="text-right font-normal px-3 py-2 whitespace-nowrap">Chunks read</th>
                <th scope="col" className="text-right font-normal px-3 py-2">Events</th>
                <th scope="col" className="text-right font-normal px-3 py-2">Drafts</th>
                <th scope="col" className="text-left font-normal px-3 py-2">Stage</th>
                <th scope="col" className="text-right font-normal px-4 py-2">Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const ex = row.byStage['extract-local']?.stats;
                const ch = row.byStage.chunk?.stats;
                const chunksTotal = ex?.chunks ?? ch?.chunks ?? null;
                const events = row.byStage.merge?.stats.kept ?? ex?.events ?? null;
                const drafts = row.byStage.draft?.stats.drafts ?? null;
                const enriched = row.byStage.enrich?.stats.enriched ?? null;
                const busy = busySlug === row.book.slug;
                return (
                  <tr key={row.book.slug} className={`align-middle ${row.book.upload && row.byStage.convert?.state !== 'done' ? 'bg-[#F3FAFA]' : ''}`}>
                    <td className="px-4 py-2.5 min-w-[14rem] max-w-md">
                      <div className="text-slate-900 font-medium">{short(row.book.title)}</div>
                      <div className="text-xs text-slate-500">
                        {row.book.translator ? `tr. ${row.book.translator}` : row.book.author ?? ''}
                        {row.book.upload ? `${row.book.translator || row.book.author ? ' · ' : ''}uploaded ${new Date(row.book.upload.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmt(row.byStage.convert?.stats.pages)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {chunksTotal === null ? '–' : `${fmt(ex?.done ?? 0)} / ${fmt(chunksTotal)}`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmt(events)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {drafts === null ? '–' : enriched === null ? fmt(drafts) : `${fmt(enriched)} / ${fmt(drafts)}`}
                    </td>
                    <td className="px-3 py-2.5">
                      <StageChip row={row} />
                      {row.failed && !row.job && <div className="text-xs text-rose-700 mt-1 max-w-[16rem] truncate" title={row.failed.error ?? ''}>{row.failed.error}</div>}
                      {!row.failed && !row.job && row.book.upload?.state === 'failed' && (
                        <div className="text-xs text-rose-700 mt-1 max-w-[16rem] truncate" title={row.book.upload.error ?? ''}>{row.book.upload.error}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {row.job ? (
                        <span className="text-xs text-slate-500">{row.job.status === 'queued' ? 'Queued' : 'Running'}</span>
                      ) : row.next ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => queue(row, row.next!)}
                          className="border border-slate-300 hover:bg-slate-100 disabled:opacity-50 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full min-h-[44px] sm:min-h-[32px]"
                        >
                          {busy ? 'Queueing…' : row.failed ? `Retry ${STAGE_LABEL[row.next].toLowerCase()}` : STAGE_LABEL[row.next]}
                        </button>
                      ) : row.book.upload?.state === 'failed' ? (
                        <span className="text-xs text-slate-500">Upload it again</span>
                      ) : row.book.upload?.state === 'uploaded' ? (
                        <span className="text-xs text-slate-500">Waiting</span>
                      ) : (
                        <span className="text-xs text-emerald-800">Ready to review</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AddBookDialog
        open={adding}
        onClose={() => {
          setAdding(false);
          addButtonRef.current?.focus();
        }}
        takenSlugs={takenSlugs}
        onQueued={onQueued}
        uploader={uploader}
      />
    </div>
  );
};
