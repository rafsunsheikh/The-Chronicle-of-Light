// Upload jobs: a maintainer uploaded a book's PDF from the admin page. The
// runner fetches it into the books folder, checks it, records it in the local
// uploads manifest, removes it from the bucket, then runs the ordinary convert
// stage. Chunking and the rest wait for a person, as for every other book.
//
// The job carries a slug and nothing else the runner acts on. Everything about
// the book comes from the pipeline_books row, which only queue_book_upload()
// and this runner can write, and is checked again here.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.mjs';
import { runPipeline } from './pipeline.mjs';

export const UPLOADS_MANIFEST = 'uploads.json';
export const MAX_BYTES = 50 * 1024 * 1024;
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const PDF_SIGNATURE = Buffer.from('%PDF-');

/** Slugs the committed manifests (every manifest but the uploads one) already use. */
export function committedSlugs(manifestsDir = config.manifestsDir) {
  const slugs = new Set();
  if (!existsSync(manifestsDir)) return slugs;
  for (const file of readdirSync(manifestsDir).filter((f) => f.endsWith('.json') && f !== UPLOADS_MANIFEST)) {
    const manifest = JSON.parse(readFileSync(join(manifestsDir, file), 'utf8'));
    for (const item of manifest.items ?? []) if (typeof item.slug === 'string') slugs.add(item.slug);
  }
  return slugs;
}

/** Refuse a slug that is malformed or that a committed manifest already uses. */
export function checkSlug(slug, taken) {
  if (typeof slug !== 'string' || !SLUG_RE.test(slug)) {
    throw new Error(`"${String(slug).slice(0, 100)}" is not a valid book name: lower-case letters, digits and hyphens, up to 80 characters`);
  }
  if (taken.has(slug)) {
    throw new Error(`"${slug}" is already a book in the committed manifests; upload it under another title`);
  }
  return slug;
}

/** Refuse anything that is empty, over the limit, or does not start like a PDF. */
export function checkPdf(bytes) {
  if (!bytes || bytes.length === 0) throw new Error('The uploaded file is empty');
  if (bytes.length > MAX_BYTES) throw new Error(`The uploaded file is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is 50 MB`);
  if (!bytes.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) throw new Error('The uploaded file is not a PDF (it does not start with %PDF-)');
  return bytes;
}

/** The uploads manifest with this book added, or replaced if it was there already. */
export function manifestWith(manifest, entry) {
  const base = manifest ?? {
    description: 'Books uploaded from the admin page. Written by the home runner; kept out of git because uploaded books may be in copyright.',
    baseDir: '${BOOKS_DIR}',
    items: [],
  };
  const items = (base.items ?? []).filter((item) => item.slug !== entry.slug);
  return { ...base, items: [...items, entry] };
}

function writeAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, file);
}

/**
 * Put a checked PDF in <booksDir>/uploads/<slug>.pdf and list it in the
 * uploads manifest. Paths are built here from the checked slug only.
 */
export function storeUpload({ book, bytes, booksDir, manifestsDir = config.manifestsDir }) {
  if (!booksDir) throw new Error('BOOKS_DIR is not set in runner/.env; the runner needs it to store uploaded books');
  const slug = checkSlug(book.slug, committedSlugs(manifestsDir));
  checkPdf(bytes);
  const dir = join(booksDir, 'uploads');
  mkdirSync(dir, { recursive: true });
  const pdfPath = join(dir, `${slug}.pdf`);
  writeAtomic(pdfPath, bytes);

  const manifestPath = join(manifestsDir, UPLOADS_MANIFEST);
  const current = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const entry = { input: `uploads/${slug}.pdf`, slug, title: book.title };
  if (book.author) entry.author = book.author;
  if (book.translator) entry.translator = book.translator;
  if (book.is_public) entry.public = true;
  writeAtomic(manifestPath, `${JSON.stringify(manifestWith(current, entry), null, 2)}\n`);
  return { pdfPath, manifestPath };
}

/**
 * Run an upload job. `source` is where the book and its file come from:
 * Supabase normally (queue.mjs), or a local file for --local-job runs.
 *   source.getBook(slug)            -> the pipeline_books row, or null
 *   source.download(slug)           -> Buffer
 *   source.remove(slug)             -> removes the file from the bucket
 *   source.setState(slug, state, error)
 */
export async function runUpload(job, { source, report, setStatus }) {
  const slug = String(job.input?.slug ?? '');
  const started = Date.now();

  // Refusals before any work. Each touches only what belongs to this upload:
  // a malformed slug touches nothing at all; a slug that names a committed book
  // clears the bucket and marks the upload row, but never that book's board row.
  if (!SLUG_RE.test(slug)) {
    throw new Error(`upload failed: "${slug.slice(0, 100)}" is not a valid book name: lower-case letters, digits and hyphens, up to 80 characters`);
  }
  try {
    checkSlug(slug, committedSlugs());
  } catch (err) {
    await Promise.resolve(source.remove(slug)).catch(() => {});
    await Promise.resolve(source.setState(slug, 'failed', err.message)).catch(() => {});
    throw new Error(`upload failed: ${err.message}`);
  }
  let book;
  try {
    book = await source.getBook(slug);
  } catch (err) {
    // Could not read the book (a network or database error): free the name so
    // the maintainer can upload again, as for any other failure.
    const message = `could not read the uploaded book: ${err instanceof Error ? err.message : String(err)}`;
    await Promise.resolve(source.remove(slug)).catch(() => {});
    await Promise.resolve(source.setState(slug, 'failed', message)).catch(() => {});
    throw new Error(`upload failed: ${message}`);
  }
  if (!book) throw new Error(`upload failed: No uploaded book "${slug}" is recorded`);
  // A duplicate or stale job for a book already fetched (or failed) must not
  // mark it failed again; only a fresh upload is processed.
  if (book.state !== 'uploaded') throw new Error(`upload failed: "${slug}" is ${book.state}, not waiting to be fetched; nothing was changed`);

  try {
    await setStatus(slug, 'convert', 'running', { jobId: job.id, stats: {} });
    await report('upload: fetching the PDF', 0, 1);
    const bytes = await source.download(slug);
    storeUpload({ book: { ...book, slug }, bytes, booksDir: config.booksDir, manifestsDir: config.manifestsDir });
    await source.remove(slug);
    await source.setState(slug, 'fetched', null);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Always clear the bucket, so the maintainer can upload again under the same name.
    await Promise.resolve(source.remove(slug)).catch(() => {});
    await Promise.resolve(source.setState(slug, 'failed', message)).catch(() => {});
    await setStatus(slug, 'convert', 'failed', { jobId: job.id, stats: {}, error: message });
    throw new Error(`upload failed: ${message}`);
  }
  // The ordinary convert stage; it writes the board and reports progress itself.
  try {
    const result = await runPipeline({ ...job, kind: 'convert', input: { slug } }, { report, setStatus });
    return { ...result, durationMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await Promise.resolve(source.setState(slug, 'failed', message)).catch(() => {});
    throw err;
  }
}

/** A source for --local-job runs: the job names a PDF on this machine. Never used for queued jobs. */
export function localSource(job) {
  const file = String(job.input?.file ?? '');
  return {
    getBook: async (slug) => ({
      slug,
      state: 'uploaded',
      title: String(job.input?.title ?? slug),
      author: job.input?.author ?? null,
      translator: job.input?.translator ?? null,
      is_public: job.input?.public === true,
    }),
    download: async () => {
      if (!file || !existsSync(file)) throw new Error(`--local-job upload needs input.file, a PDF on this machine (got "${file}")`);
      return readFileSync(file);
    },
    remove: async () => {},
    setState: async () => {},
  };
}
