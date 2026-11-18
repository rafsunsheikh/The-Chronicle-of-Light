// The book pipeline as runner jobs: convert, chunk, extract with the local
// model, merge, draft, enrich, or all of them in order. Each stage runs the
// same script a person runs from the command line, in this checkout, and the
// runner reads the script's progress lines so the admin page can show chunk
// 18 of 59 as it happens. Nothing here touches git: the drafts land under
// src/data/events/imported/<slug>/ for review, and promotion stays a
// person's decision.
//
// A job names a book by the slug in scripts/convert/manifests/*.json and a
// stage from the list below. Anything else is refused: no paths, no commands
// and no options come from the queue.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config, repoRoot } from './config.mjs';

export const STAGES = ['convert', 'chunk', 'extract-local', 'merge', 'draft', 'enrich'];
export const PIPELINE_KINDS = new Set([...STAGES, 'all']);
export const isPipelineKind = (kind) => PIPELINE_KINDS.has(kind);

const LABELS = {
  convert: 'converting the PDF to Markdown with pdfdown',
  chunk: 'cutting the text into chunks',
  'extract-local': 'reading chunks with the local model',
  merge: 'sorting, grounding dates and merging duplicates',
  draft: 'writing draft event files',
  enrich: 'looking events up on Wikipedia and Wikidata',
};

/** Every book every manifest lists, keyed by slug. */
export function loadBooks() {
  const books = new Map();
  if (!existsSync(config.manifestsDir)) return books;
  for (const file of readdirSync(config.manifestsDir).filter((f) => f.endsWith('.json'))) {
    const manifest = JSON.parse(readFileSync(join(config.manifestsDir, file), 'utf8'));
    for (const item of manifest.items ?? []) {
      if (typeof item.slug === 'string' && /^[a-z0-9-]{1,80}$/.test(item.slug)) {
        books.set(item.slug, { ...item, manifestFile: join(config.manifestsDir, file) });
      }
    }
  }
  return books;
}

function bookOrThrow(slug) {
  const book = loadBooks().get(slug);
  if (!book) throw new Error(`"${slug}" is not a book in scripts/convert/manifests; the pipeline only runs on listed books`);
  return book;
}

const bookDir = (book) => join(repoRoot, 'content', book.public ? 'books' : 'private', book.slug);
const contentPath = (book) => join(bookDir(book), 'content.md');

/** Run one of the repo's scripts and hand every output line to the caller. */
function runScript(args, onLine) {
  return new Promise((resolve, reject) => {
    // Only what the scripts need: the service-role key and the rest of the runner's
    // environment stay out of the child processes and the tools they call.
    const keep = ['PATH', 'HOME', 'USER', 'SHELL', 'TMPDIR', 'LANG', 'LC_ALL', 'NODE_OPTIONS', 'HF_HOME', 'XDG_CACHE_HOME'];
    const env = {
      ...Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])),
      BOOKS_DIR: config.booksDir,
      PDFDOWN_BIN: config.pdfdownBin,
      PDFDOWN_ARGS: config.pdfdownArgs,
      LOCAL_MODEL_URL: config.localModelUrl,
    };
    const child = spawn(process.execPath, args, { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const tail = [];
    let buffer = '';
    const feed = (chunk) => {
      buffer += chunk;
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trimEnd();
        buffer = buffer.slice(nl + 1);
        if (!line.trim()) continue;
        tail.push(line);
        if (tail.length > 40) tail.shift();
        onLine(line);
      }
    };
    child.stdout.on('data', (d) => feed(String(d)));
    child.stderr.on('data', (d) => feed(String(d)));
    child.on('error', reject);
    child.on('close', (code) => {
      if (buffer.trim()) feed('\n');
      if (code === 0) resolve(tail);
      else reject(new Error(`${args[0]} exited ${code}: ${tail.filter((l) => /error|failed|cannot|refus/i.test(l)).slice(-3).join(' | ') || tail.slice(-2).join(' | ')}`));
    });
  });
}

const num = (s) => Number(String(s).replace(/,/g, ''));

// ---- the stages ---------------------------------------------------------------
// Each takes (book, { force, onProgress }) and returns the stats the board shows.

async function convert(book, { force, onProgress }) {
  const args = ['scripts/convert/batch.mjs', book.manifestFile, '--only', book.slug];
  if (force) args.push('--force');
  let pages = null;
  await runScript(args, (line) => {
    const m = line.match(/\[(\d+)\/(\d+)\]/);
    if (m && /pdf/i.test(line)) onProgress(LABELS.convert, 0, 1);
    const w = line.match(/Wrote .*content\.md: ([\d,]+) words(?:.*?([\d,]+) pages)?/);
    if (w) pages = w[2] ? num(w[2]) : null;
  });
  const metaFile = join(bookDir(book), 'meta.json');
  const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
  return { pages: meta.stats?.pages ?? pages ?? null, words: meta.stats?.words ?? null, figures: meta.engine?.figures ?? null, engine: meta.engine?.name ?? null };
}

async function chunk(book, { onProgress }) {
  onProgress(LABELS.chunk, 0, 1);
  await runScript(['scripts/extract/chunk.mjs', contentPath(book)], () => {});
  const index = JSON.parse(readFileSync(join(bookDir(book), 'extract', 'chunks.json'), 'utf8'));
  return { chunks: index.length, chars: index.reduce((n, c) => n + (c.chars ?? 0), 0), withAnnal: index.filter((c) => c.annal).length };
}

async function extractLocal(book, { force, onProgress }) {
  const args = ['scripts/extract/local.mjs', contentPath(book)];
  if (force) args.push('--force');
  const index = JSON.parse(readFileSync(join(bookDir(book), 'extract', 'chunks.json'), 'utf8'));
  const total = index.length;
  const candDir = join(bookDir(book), 'extract', 'candidates');
  const already = existsSync(candDir) ? readdirSync(candDir).filter((f) => f.endsWith('.json')).length : 0;
  let events = 0;
  await runScript(args, (line) => {
    const m = line.match(/\[(\d+)\/(\d+)\] chunk \d+: (\d+) event/);
    if (m) {
      events += Number(m[3]);
      const done = (force ? 0 : already) + Number(m[1]);
      onProgress(`${LABELS['extract-local']}: ${events} events so far`, Math.min(done, total), total);
    }
  });
  return statsFromLog(book, total);
}

/** Counts from the extraction log: what the board shows for extract-local. */
export function statsFromLog(book, total = null) {
  const logFile = join(bookDir(book), 'extract', 'local-log.jsonl');
  const candDir = join(bookDir(book), 'extract', 'candidates');
  const done = existsSync(candDir) ? readdirSync(candDir).filter((f) => f.endsWith('.json')).length : 0;
  if (!existsSync(logFile)) return { chunks: total, done, events: null };
  const rows = readFileSync(logFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const ok = rows.filter((r) => r.events !== null);
  const latest = new Map();
  for (const r of ok) latest.set(r.chunk, r); // one entry per chunk, the last run wins
  const events = [...latest.values()].reduce((n, r) => n + r.events, 0);
  const seconds = ok.reduce((n, r) => n + r.seconds, 0);
  return {
    chunks: total,
    done,
    events,
    secondsPerChunk: ok.length ? Math.round(seconds / ok.length) : null,
    failed: rows.filter((r) => r.events === null).length,
    split: rows.filter((r) => r.split).length,
  };
}

async function merge(book, { onProgress }) {
  onProgress(LABELS.merge, 0, 1);
  let stats = {};
  await runScript(['scripts/extract/merge.mjs', contentPath(book)], (line) => {
    const m = line.match(/Kept (\d+) of (\d+) candidates \((\d+) merged, (\d+) already on the timeline, (\d+) dates set/);
    if (m) stats = { kept: Number(m[1]), candidates: Number(m[2]), merged: Number(m[3]), alreadyOnTimeline: Number(m[4]), datesFromAnnal: Number(m[5]) };
  });
  return stats;
}

async function draft(book, { onProgress }) {
  onProgress(LABELS.draft, 0, 1);
  let stats = {};
  await runScript(['scripts/extract/draft.mjs', contentPath(book), '--from', 'merged'], (line) => {
    const m = line.match(/Wrote (\d+) draft\(s\).*\((\d+) located, (\d+) skipped\)/);
    if (m) stats = { drafts: Number(m[1]), located: Number(m[2]), skipped: Number(m[3]) };
  });
  return stats;
}

async function enrich(book, { onProgress }) {
  let stats = {};
  await runScript(['scripts/extract/enrich.mjs', contentPath(book)], (line) => {
    const p = line.match(/\[(\d+)\/(\d+)\]/);
    if (p) onProgress(LABELS.enrich, Number(p[1]), Number(p[2]));
    const d = line.match(/Done: (\d+) enriched, (\d+) unmatched/);
    if (d) stats = { enriched: Number(d[1]), unmatched: Number(d[2]), drafts: Number(d[1]) + Number(d[2]) };
  });
  return stats;
}

const RUNNERS = { convert, chunk, 'extract-local': extractLocal, merge, draft, enrich };

/** Stages "all" may skip because their output already exists (a stopped run picks up where it was). */
function alreadyDone(book, stage) {
  if (stage === 'convert') return existsSync(contentPath(book));
  if (stage === 'chunk') return existsSync(join(bookDir(book), 'extract', 'chunks.json'));
  return false;
}

/**
 * Run a pipeline job. `report(stage, done, total)` updates the job row;
 * `setStatus(slug, stage, state, {stats, error})` updates the board (a no-op
 * in local mode). Returns the shape handle() stores as the job result.
 */
export async function runPipeline(job, { report, setStatus }) {
  const slug = String(job.input?.slug ?? '');
  const book = bookOrThrow(slug);
  const force = job.input?.force === true;
  const stages = job.kind === 'all' ? STAGES : [job.kind];
  const started = Date.now();
  const results = {};
  for (const stage of stages) {
    if (job.kind === 'all' && !force && alreadyDone(book, stage)) {
      results[stage] = { skipped: 'already done' };
      continue;
    }
    await setStatus(slug, stage, 'running', { jobId: job.id, stats: {} });
    const onProgress = (label, done, total) => report(`${stage}: ${label}`, done, total);
    try {
      const stats = await RUNNERS[stage](book, { force, onProgress });
      results[stage] = stats;
      await setStatus(slug, stage, 'done', { jobId: job.id, stats });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await setStatus(slug, stage, 'failed', { jobId: job.id, stats: stage === 'extract-local' ? statsFromLog(book) : {}, error: message });
      throw new Error(`${stage} failed: ${message}`);
    }
  }
  return {
    slug,
    files: [],
    drafts: results.draft?.drafts ?? results.enrich?.drafts ?? null,
    model: stages.includes('extract-local') || stages.includes('merge') ? 'local model' : null,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: Date.now() - started,
    stages: results,
    prUrl: null,
    branch: null,
  };
}
