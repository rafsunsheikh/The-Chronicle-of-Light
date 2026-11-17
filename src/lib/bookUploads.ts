// Uploading a book from the admin page (migration 0006).
//
// 1. The browser checks the file (a real PDF, 50 MB or less) and makes the
//    book's short name from its title.
// 2. It uploads <slug>.pdf to the private book-uploads bucket with tus, which
//    reports progress. Storage refuses anyone who is not a maintainer, any other
//    type and anything over 50 MB, whatever this code does.
// 3. It calls queue_book_upload(), which checks everything again and records
//    the book and its upload job in one step. The home runner does the rest.
import { Upload, type DetailedError } from 'tus-js-client';
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
  return name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const formatMb = (bytes: number) => `${(bytes / 1048576).toFixed(bytes < 10 * 1048576 ? 1 : 0)}\u00a0MB`;

/** Why this file cannot be uploaded, or null when it can. Reads the first bytes, so it is async. */
export async function fileProblem(file: File): Promise<string | null> {
  if (file.size === 0) return 'This file is empty. Choose the PDF again.';
  if (file.size > MAX_UPLOAD_BYTES) return `This file is ${formatMb(file.size)}. Files over 50 MB cannot be uploaded.`;
  const head = await file.slice(0, 5).text();
  if (head !== '%PDF-') return 'This file is not a PDF. Only PDF books can be converted.';
  return null;
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

/** True when storage refused because <slug>.pdf is already in the bucket. */
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
  if (/mime type/i.test(body)) return 'Storage accepts PDF files only.';
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
export function uploadBook(file: File, slug: string, details: BookDetails, onProgress: (sent: number, total: number) => void): UploadHandle {
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

    await new Promise<void>((resolve, reject) => {
      stop = reject;
      const finish = () => {
        stored = true;
        onProgress(file.size, file.size); // on a 409 nothing more was sent; show the queueing state
        upload = null;
        resolve();
      };
      upload = new Upload(file, {
        endpoint: tusEndpoint(),
        retryDelays: [0, 3000, 5000, 10000],
        headers: { authorization: `Bearer ${token}`, apikey: supabaseKey, 'x-upsert': 'false' },
        uploadDataDuringCreation: true,
        storeFingerprintForResuming: false,
        removeFingerprintOnSuccess: true,
        metadata: { bucketName: BUCKET, objectName: `${slug}.pdf`, contentType: 'application/pdf', cacheControl: '3600' },
        chunkSize: 6 * 1024 * 1024, // Supabase requires exactly 6 MB chunks
        // Retry only what a retry can fix: no answer, or a server error.
        onShouldRetry: (err) => {
          const status = (err as DetailedError).originalResponse?.getStatus() ?? 0;
          return status === 0 || status >= 500;
        },
        onProgress,
        // A 409 means <slug>.pdf is already in the bucket, most likely from an
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
