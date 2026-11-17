// Upload jobs: a maintainer uploaded a book's PDF or EPUB from the admin page. The
// runner fetches it into the books folder, checks it, records it in the local
// uploads manifest, removes it from the bucket, then runs the ordinary convert
// stage. Chunking and the rest wait for a person, as for every other book.
//
// The job carries a slug and nothing else the runner acts on. Everything about
// the book comes from the pipeline_books row, which only queue_book_upload()
// and this runner can write, and is checked again here.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { config } from './config.mjs';
import { runPipeline } from './pipeline.mjs';

export const UPLOADS_MANIFEST = 'uploads.json';
export const MAX_BYTES = 50 * 1024 * 1024;
export const FORMATS = ['pdf', 'epub'];
/** Limits for an EPUB; sizes are measured by unpacking each part with a cap (see checkEpub). */
export const EPUB_MAX_ENTRIES = 5000;
export const EPUB_MAX_UNPACKED = 300 * 1024 * 1024;
const EPUB_MIMETYPE = 'application/epub+zip';
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

/**
 * Refuse anything that is not a well-formed EPUB within the limits. The EPUB
 * rule is that the first entry is "mimetype", stored uncompressed, reading
 * application/epub+zip, and the package has META-INF/container.xml.
 *
 * The size limit counts what each part really unpacks to, not what the ZIP
 * claims: every part is inflated here with a cap of its stated size, so a part
 * that lies about its size, or a directory that hides parts, is refused before
 * the converter's JSZip ever sees it. Memory stays bounded by the cap.
 */
export function checkEpub(bytes) {
  if (!bytes || bytes.length === 0) throw new Error('The uploaded file is empty');
  if (bytes.length > MAX_BYTES) throw new Error(`The uploaded file is ${(bytes.length / 1048576).toFixed(1)} MB; the limit is 50 MB`);
  const notEpub = (why) => new Error(`The uploaded file is not an EPUB (${why})`);
  if (bytes.length < 30 || bytes.readUInt32LE(0) !== 0x04034b50) throw notEpub('it is not a ZIP package');

  // The first entry: "mimetype", stored, with the EPUB media type as its content.
  const nameLen = bytes.readUInt16LE(26);
  const extraLen = bytes.readUInt16LE(28);
  const method = bytes.readUInt16LE(8);
  const storedLen = bytes.readUInt32LE(18);
  const contentAt = 30 + nameLen + extraLen;
  if (contentAt + storedLen > bytes.length) throw notEpub('its first entry runs past the end of the file');
  if (bytes.toString('latin1', 30, 30 + nameLen) !== 'mimetype') throw notEpub('its first entry is not "mimetype"');
  if (method !== 0 || bytes.toString('latin1', contentAt, contentAt + storedLen) !== EPUB_MIMETYPE) {
    throw notEpub(`its mimetype entry does not read ${EPUB_MIMETYPE}`);
  }

  // The end-of-directory record sits in the last 64 KB plus its own 22 bytes.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw notEpub('its ZIP directory is missing');
  // JSZip looks for the end record up to the last 4 bytes; one there would be
  // the record it uses, so the file must not have one where this check did not look.
  if (bytes.subarray(bytes.length - 21).includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))) throw notEpub('its ZIP end record is damaged');
  if (eocd + 22 + bytes.readUInt16LE(eocd + 20) !== bytes.length) throw notEpub('its ZIP end record is damaged');
  const entries = bytes.readUInt16LE(eocd + 10);
  const dirSize = bytes.readUInt32LE(eocd + 12);
  const dirAt = bytes.readUInt32LE(eocd + 16);
  // One disk, one directory, no ZIP64: any other value makes JSZip look for a
  // ZIP64 directory elsewhere in the file, which this check would not have walked.
  if (
    entries === 0xffff ||
    dirAt === 0xffffffff ||
    dirSize === 0xffffffff ||
    bytes.readUInt16LE(eocd + 4) !== 0 ||
    bytes.readUInt16LE(eocd + 6) !== 0 ||
    bytes.readUInt16LE(eocd + 8) !== entries
  ) {
    throw notEpub('it uses ZIP64 or several disks, which is not supported');
  }
  if (entries > EPUB_MAX_ENTRIES) throw new Error(`The uploaded EPUB has ${entries} parts; the limit is ${EPUB_MAX_ENTRIES}`);
  // The directory must end exactly at the end record: JSZip treats any gap as
  // bytes added in front of the ZIP and shifts every offset, which would point
  // it at a different directory from the one checked here.
  if (dirAt + dirSize !== eocd) throw notEpub('its ZIP directory does not end at its end record');

  let at = dirAt;
  let unpacked = 0;
  let hasContainer = false;
  const tooBig = () => new Error(`The uploaded EPUB unpacks to more than ${EPUB_MAX_UNPACKED / 1048576} MB, the limit`);
  for (let n = 0; n < entries; n++) {
    if (at + 46 > dirAt + dirSize || bytes.readUInt32LE(at) !== 0x02014b50) throw notEpub('its ZIP directory is damaged');
    if (bytes.readUInt16LE(at + 8) & 1) throw notEpub('it is encrypted');
    const partMethod = bytes.readUInt16LE(at + 10);
    const packed = bytes.readUInt32LE(at + 20);
    const size = bytes.readUInt32LE(at + 24);
    const len = bytes.readUInt16LE(at + 28);
    const extra = bytes.readUInt16LE(at + 30);
    const comment = bytes.readUInt16LE(at + 32);
    const localAt = bytes.readUInt32LE(at + 42);
    if (size === 0xffffffff || packed === 0xffffffff || localAt === 0xffffffff) throw notEpub('it uses ZIP64, which is not supported');
    const name = bytes.toString('utf8', at + 46, at + 46 + len);
    if (name === 'META-INF/container.xml') hasContainer = true;

    // The part's data, found through its own local header.
    if (localAt + 30 > dirAt || bytes.readUInt32LE(localAt) !== 0x04034b50) throw notEpub(`its part "${name.slice(0, 80)}" points outside the file`);
    const dataAt = localAt + 30 + bytes.readUInt16LE(localAt + 26) + bytes.readUInt16LE(localAt + 28);
    if (dataAt + packed > dirAt) throw notEpub(`its part "${name.slice(0, 80)}" runs past its data`);
    if (unpacked + size > EPUB_MAX_UNPACKED) throw tooBig();

    // Measure the real size, never more than the stated size plus one byte.
    let real;
    if (partMethod === 0) {
      real = packed;
    } else if (partMethod === 8) {
      try {
        real = inflateRawSync(bytes.subarray(dataAt, dataAt + packed), { maxOutputLength: size + 1 }).length;
      } catch (err) {
        if (err instanceof RangeError || err?.code === 'ERR_BUFFER_TOO_LARGE') real = size + 1;
        else throw notEpub(`its part "${name.slice(0, 80)}" is damaged`);
      }
    } else {
      throw notEpub(`its part "${name.slice(0, 80)}" uses an unsupported compression method`);
    }
    if (real !== size) throw notEpub(`its part "${name.slice(0, 80)}" unpacks to a different size than it states`);
    unpacked += real;
    at += 46 + len + extra + comment;
  }
  // The directory must hold exactly the parts the end record counts: nothing hidden after them.
  if (at !== dirAt + dirSize) throw notEpub('its ZIP directory holds more parts than it declares');
  if (!hasContainer) throw notEpub('META-INF/container.xml is missing');
  return bytes;
}

/** The check for a book's format. */
export function checkFile(bytes, format) {
  if (format === 'pdf') return checkPdf(bytes);
  if (format === 'epub') return checkEpub(bytes);
  throw new Error(`"${String(format).slice(0, 20)}" is not a format the runner accepts (pdf or epub)`);
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
 * Put a checked PDF or EPUB in <booksDir>/uploads/<slug>.<format> and list it
 * in the uploads manifest. Paths are built here from the checked slug only.
 */
export function storeUpload({ book, bytes, booksDir, manifestsDir = config.manifestsDir }) {
  if (!booksDir) throw new Error('BOOKS_DIR is not set in runner/.env; the runner needs it to store uploaded books');
  const slug = checkSlug(book.slug, committedSlugs(manifestsDir));
  const format = book.format ?? 'pdf';
  checkFile(bytes, format);
  const dir = join(booksDir, 'uploads');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${slug}.${format}`);
  writeAtomic(filePath, bytes);

  const manifestPath = join(manifestsDir, UPLOADS_MANIFEST);
  const current = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const entry = { input: `uploads/${slug}.${format}`, slug, title: book.title };
  if (book.author) entry.author = book.author;
  if (book.translator) entry.translator = book.translator;
  if (book.is_public) entry.public = true;
  writeAtomic(manifestPath, `${JSON.stringify(manifestWith(current, entry), null, 2)}\n`);
  return { filePath, manifestPath };
}

/**
 * Run an upload job. `source` is where the book and its file come from:
 * Supabase normally (queue.mjs), or a local file for --local-job runs.
 *   source.getBook(slug)            -> the pipeline_books row, or null
 *   source.download(slug, format)   -> Buffer
 *   source.remove(slug)             -> removes the file from the bucket (every format)
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
    await report('upload: fetching the file', 0, 1);
    const format = book.format ?? 'pdf';
    if (!FORMATS.includes(format)) throw new Error(`"${String(format).slice(0, 20)}" is not a format the runner accepts (pdf or epub)`);
    const bytes = await source.download(slug, format);
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
      format: String(file).toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
      title: String(job.input?.title ?? slug),
      author: job.input?.author ?? null,
      translator: job.input?.translator ?? null,
      is_public: job.input?.public === true,
    }),
    download: async () => {
      if (!file || !existsSync(file)) throw new Error(`--local-job upload needs input.file, a PDF or EPUB on this machine (got "${file}")`);
      return readFileSync(file);
    },
    remove: async () => {},
    setState: async () => {},
  };
}
