// Uploading a book from the admin page (migration 0006).
//
// 1. The browser checks the file (a real PDF, 50 MB or less) and makes the
//    book's short name from its title.
// 2. It uploads <slug>.pdf to the private book-uploads bucket with tus, which
//    reports progress. Storage refuses anyone who is not a maintainer, any other
//    type and anything over 50 MB, whatever this code does.
// 3. It calls queue_book_upload(), which checks everything again and records
//    the book and its upload job in one step. The home runner does the rest.
import type { DetailedError, Upload } from 'tus-js-client';
import { supabase, supabaseKey, supabaseUrl } from './supabase';
import type { UploadedBook } from '../types/pipeline';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const BUCKET = 'book-uploads';
const NO_BACKEND = 'The backend is not configured.';

/** Books uploaded from the admin page. Row-level security limits the list to maintainers. */
export async function listUploadedBooks(): Promise<{ books: UploadedBook[]; error?: string }> {
  if (!supabase) return { books: [], error: NO_BACKEND };
  const { data, error } = await supabase
    .from('pipeline_books')
    .select('slug, title, author, translator, is_public, size_bytes, state, error, created_at')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return { books: [], error: error.message };
  return { books: (data ?? []) as UploadedBook[] };
}

/** "The Origins of the Islamic State, Part 1" -> "the-origins-of-the-islamic-state-part-1". */
export function slugFromTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** A starting title from a file name: "Baladhuri_Origins_Part1.pdf" -> "Baladhuri Origins Part1". */
export function titleFromFileName(name: string): string {
  return name.replace(/\.(pdf|epub)$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const formatMb = (bytes: number) => `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)}\u00a0MB`;

export type BookFormat = 'pdf' | 'epub';

const CONTENT_TYPE: Record<BookFormat, string> = { pdf: 'application/pdf', epub: 'application/epub+zip' };

/**
 * What this file is, by its first bytes, or why it cannot be uploaded. A PDF
 * starts with %PDF-. An EPUB is a ZIP whose first entry is "mimetype", stored
 * uncompressed, reading application/epub+zip, right at the start of the file.
 * The runner checks the whole package again.
 */
export async function fileKind(file: File): Promise<{ format: BookFormat; problem?: undefined } | { format?: undefined; problem: string }> {
  if (file.size === 0) return { problem: 'This file is empty. Choose the book again.' };
  if (file.size > MAX_UPLOAD_BYTES) return { problem: `This file is ${formatMb(file.size)}. Files over 50 MB cannot be uploaded.` };
  const head = new Uint8Array(await file.slice(0, 30).arrayBuffer());
  const text = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (text(head, 0, 5) === '%PDF-') return { format: 'pdf' };
  if (text(head, 0, 4) === 'PK\u0003\u0004' && head.length === 30) {
    // The first entry's name and extra field have their lengths in the header,
    // as the runner reads them (some tools add an extra field).
    const nameLen = head[26] | (head[27] << 8);
    const extraLen = head[28] | (head[29] << 8);
    const at = 30 + nameLen + extraLen;
    const first = new Uint8Array(await file.slice(0, at + 20).arrayBuffer());
    if (text(first, 30, 30 + nameLen) === 'mimetype' && text(first, at, at + 20) === 'application/epub+zip') return { format: 'epub' };
    return { problem: 'This file is a ZIP package but not an EPUB book. Export it as an EPUB or a PDF.' };
  }
  return { problem: 'This file is not a PDF or an EPUB. Only PDF and EPUB books can be converted.' };
}

export interface BookDetails {
  title: string;
  author: string;
  translator: string;
  isPublic: boolean;
}

export interface UploadHandle {
  /** Resolves when the job is queued; rejects with a message a person can act on. */
  done: Promise<void>;
  /** Stops the upload (and removes its partial data on the server when it can). Does nothing once the file is stored. */
  cancel: () => void;
}

/** True when storage refused because <slug>.<format> is already in the bucket. */
function alreadyStored(err: Error): boolean {
  const res = (err as DetailedError).originalResponse;
  return res?.getStatus() === 409 || /already exists/i.test(res?.getBody() ?? '');
}

/** Turn a tus error into a sentence that says what went wrong and what to do. */
function uploadMessage(err: Error): string {
  const res = (err as DetailedError).originalResponse;
  const status = res?.getStatus() ?? 0;
  const body = res?.getBody() ?? '';
  if (status === 413 || /maximum allowed size|too large/i.test(body)) return 'The file is over 50 MB, so storage refused it.';
  if (status === 401 || status === 403 || /row-level security|unauthori/i.test(body)) return 'Storage refused the upload: only maintainers can add books. Sign in again if your session expired.';
  if (/mime type/i.test(body)) return 'Storage accepts PDF and EPUB files only.';
  if (status === 0) return 'The upload could not reach the server. Check the connection and try again.';
  return `The upload failed (${status}${body ? `: ${body.slice(0, 200)}` : ''}).`;
}

/** The resumable-upload endpoint on Supabase's storage host, as its guide recommends. */
function tusEndpoint(): string {
  const m = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return m ? `https://${m[1]}.storage.supabase.co/storage/v1/upload/resumable` : `${supabaseUrl}/storage/v1/upload/resumable`;
}

/**
 * Upload one book and queue it. `slug` must already be checked by the caller
 * against the book list; the server checks it again.
 */
export function uploadBook(file: File, slug: string, format: BookFormat, details: BookDetails, onProgress: (sent: number, total: number) => void): UploadHandle {
  let upload: Upload | null = null;
  let cancelled = false;
  // tus does not call onError after abort(), so cancelling settles the promise itself.
  let stop: ((err: Error) => void) | null = null;
  let stored = false;
  const done = (async () => {
    if (!supabase) throw new Error(NO_BACKEND);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Your session has ended. Sign in again, then add the book.');
    // Loaded only when someone uploads, so the public site does not carry it.
    const { Upload: TusUpload } = await import('tus-js-client');

    await new Promise<void>((resolve, reject) => {
      stop = reject;
      const finish = () => {
        stored = true;
        onProgress(file.size, file.size); // on a 409 nothing more was sent; show the queueing state
        upload = null;
        resolve();
      };
      upload = new TusUpload(file, {
        endpoint: tusEndpoint(),
        retryDelays: [0, 3000, 5000, 10000],
        headers: { authorization: `Bearer ${token}`, apikey: supabaseKey, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        storeFingerprintForResuming: false,
        removeFingerprintOnSuccess: true,
        metadata: { bucketName: BUCKET, objectName: `${slug}.${format}`, contentType: CONTENT_TYPE[format], cacheControl: '3600' },
        chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
        // Retry only what a retry can fix: no answer, or a server error.
        onShouldRetry: (err) => {
          const status = (err as DetailedError).originalResponse?.getStatus() ?? 0;
          return status === 0 || status >= 500;
        },
        onProgress,
        // A 409 means <slug>.<format> is already in the bucket, most likely from an
        // earlier try whose queue call failed. Queue it anyway: the database
        // call checks the file exists and the name is free, and refuses in plain
        // words if another book already took it.
        onError: (err) => (alreadyStored(err) ? finish() : reject(new Error(uploadMessage(err)))),
        onSuccess: () => finish(),
      });
      if (cancelled) reject(new Error('Upload cancelled.'));
      else upload.start();
    });

    if (cancelled) throw new Error('Upload cancelled.');
    const { error } = await supabase.rpc('queue_book_upload', {
      p_slug: slug,
      p_title: details.title.trim(),
      p_author: details.author.trim() || null,
      p_translator: details.translator.trim() || null,
      p_is_public: details.isPublic,
      // The database refuses when a different file is already stored under this name.
      p_size: file.size,
    });
    // The function's refusals are written for people ("A book with this name has already been added.").
    if (error) throw new Error(error.message);
  })();
  return {
    done,
    cancel: () => {
      if (stored) return; // the file is in the bucket and the job is being queued; let it finish
      cancelled = true;
      if (upload) void (upload as Upload).abort(true).catch(() => {});
      stop?.(new Error('Upload cancelled.'));
    },
  };
}
