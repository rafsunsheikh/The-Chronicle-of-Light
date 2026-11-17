import { useEffect, useId, useRef, useState } from 'react';
import { fileKind, formatMb, slugFromTitle, titleFromFileName, uploadBook, type BookDetails, type BookFormat, type UploadHandle } from '../../lib/bookUploads';

/** Uploads one book; the admin page passes the real one, the dev preview a fake. */
export type Uploader = (file: File, slug: string, format: BookFormat, details: BookDetails, onProgress: (sent: number, total: number) => void) => UploadHandle;

type Phase = 'choose' | 'details' | 'uploading' | 'queued';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Short names already used by a book in the list (manifest books, and uploads that did not fail). */
  takenSlugs: Set<string>;
  /** Called once the book and its job are recorded, so the list can refresh. */
  onQueued: () => Promise<unknown> | void;
  uploader?: Uploader;
}

const STEPS = ['Choose the file', 'Check the details', 'Convert'] as const;

const FileIcon = ({ label = 'PDF' }: { label?: string }) => (
  <svg className="w-10 h-12 flex-none" viewBox="0 0 40 48" aria-hidden="true">
    <path d="M4 2h22l10 10v32a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#fff" stroke="#94A3B8" strokeWidth="2" />
    <path d="M26 2v10h10" fill="none" stroke="#94A3B8" strokeWidth="2" />
    <text x="20" y="36" textAnchor="middle" fontSize="9" fontWeight="700" fill="#1B8A87">{label}</text>
  </svg>
);

const ErrorIcon = () => (
  <svg className="w-3.5 h-3.5 flex-none mt-0.5" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 4.5v4.2M8 11v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const fieldClass = 'w-full min-h-[40px] border border-slate-300 rounded-md px-2.5 py-2 bg-white text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-nma focus-visible:outline-offset-2';
const primaryBtn = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-full bg-teal-nma hover:bg-teal-nma/90 disabled:bg-slate-300 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-sm font-semibold';
const ghostBtn = 'inline-flex items-center justify-center min-h-[44px] px-5 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-sm font-semibold';
const smallGhostBtn = 'inline-flex items-center justify-center min-h-[44px] sm:min-h-[32px] px-3 rounded-full border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold flex-none w-full sm:w-auto';

export const AddBookDialog: React.FC<Props> = ({ open, onClose, takenSlugs, onQueued, uploader = uploadBook }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const handleRef = useRef<UploadHandle | null>(null);
  const ids = { title: useId(), author: useId(), translator: useId(), heading: useId(), fileError: useId(), limits: useId() };

  const [phase, setPhase] = useState<Phase>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<BookFormat>('pdf');
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [details, setDetails] = useState<BookDetails>({ title: '', author: '', translator: '', isPublic: false });
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [dragging, setDragging] = useState(false);

  // Every byte is sent: the book is being recorded, which cannot be stopped half way.
  const queueing = phase === 'uploading' && progress.total > 0 && progress.sent >= progress.total;

  const reset = () => {
    setPhase('choose');
    setFile(null);
    setFormat('pdf');
    setFileError(null);
    setSubmitError(null);
    setDetails({ title: '', author: '', translator: '', isPublic: false });
    setProgress({ sent: 0, total: 0 });
  };

  // The native dialog gives the focus trap, Escape and an inert page behind it.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      fileInputRef.current?.focus(); // start at step 1, not on the close button
    }
    if (!open && d.open) d.close();
  }, [open]);

  // Controls that remove or disable themselves hand focus on: to the file
  // picker for a new choice, to the title once a file is chosen, to Done once queued.
  useEffect(() => {
    if (!open) return;
    if (phase === 'choose' && !fileError) fileInputRef.current?.focus();
    if (phase === 'details') titleInputRef.current?.focus();
    if (phase === 'queued') doneRef.current?.focus();
  }, [open, phase, fileError]);
  useEffect(() => {
    if (queueing && dialogRef.current?.contains(document.activeElement) && (document.activeElement as HTMLButtonElement).disabled) {
      dialogRef.current.focus();
    }
  });

  const close = () => {
    if (phase === 'uploading') return; // Cancel stops the upload first
    reset();
    onClose();
  };

  const pick = async (f: File | undefined | null) => {
    if (!f) return;
    setSubmitError(null);
    setFile(f);
    const kind = await fileKind(f);
    const problem = kind.problem ?? null;
    setFileError(problem);
    setFormat(kind.format ?? (/\.epub$/i.test(f.name) ? 'epub' : 'pdf'));
    if (!problem) {
      setDetails((d) => (d.title.trim() ? d : { ...d, title: titleFromFileName(f.name) }));
      setPhase('details');
    } else {
      setPhase('choose');
    }
  };

  const slug = slugFromTitle(details.title);
  const titleProblem = !details.title.trim()
    ? 'Add the book’s title.'
    : !slug
      ? 'Use at least one Latin letter or digit in the title; it becomes the book’s short name.'
      : takenSlugs.has(slug)
        ? 'A book with this title is already in the list. Add the volume or part to the title.'
        : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || fileError || titleProblem || phase === 'uploading') return;
    setSubmitError(null);
    setPhase('uploading');
    setProgress({ sent: 0, total: file.size });
    const handle = uploader(file, slug, format, details, (sent, total) => setProgress({ sent, total }));
    handleRef.current = handle;
    try {
      await handle.done;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSubmitError(message === 'Upload cancelled.' ? null : message);
      setPhase('details');
      return;
    } finally {
      handleRef.current = null;
    }
    // The book is queued. Refreshing the list is separate: if it fails, the
    // upload still stands and the page's own polling catches up.
    setPhase('queued');
    try {
      await onQueued();
    } catch {
      /* the next poll refreshes the list */
    }
  };

  const cancel = () => {
    if (phase === 'uploading') {
      handleRef.current?.cancel();
      return;
    }
    close();
  };

  const step = phase === 'choose' ? 0 : phase === 'details' ? 1 : 2;
  const pct = progress.total ? Math.round((100 * progress.sent) / progress.total) : 0;
  const showFields = phase === 'choose' || phase === 'details' || phase === 'uploading';

  return (
    <dialog
      ref={dialogRef}
      // Focus can rest on the dialog itself while its buttons are briefly disabled.
      tabIndex={-1}
      aria-labelledby={ids.heading}
      onCancel={(e) => {
        e.preventDefault(); // Escape: close unless an upload is running
        close();
      }}
      onClose={() => {
        if (!open) return;
        // Chrome lets a second Escape close a dialog even after the first was
        // refused; while an upload runs, put it back rather than hide it.
        if (phase === 'uploading') {
          dialogRef.current?.showModal();
          return;
        }
        reset();
        onClose();
      }}
      className="outline-none w-[600px] max-w-[calc(100%-32px)] max-h-[calc(100%-32px)] overflow-auto overscroll-contain rounded-lg bg-white p-6 text-sm text-slate-900 shadow-[0_12px_32px_rgba(12,34,48,0.2)] backdrop:bg-navy-nma/35"
    >
      <form onSubmit={submit} noValidate>
        <div className="flex items-center justify-between gap-4">
          <h2 id={ids.heading} className="text-base font-semibold text-slate-900">
            Add a book
          </h2>
          <button
            type="button"
            onClick={cancel}
            aria-label={phase === 'uploading' ? 'Stop the upload' : 'Close'}
            disabled={queueing}
            className="w-11 h-11 -mr-2 rounded-full text-2xl leading-none text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-nma"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <ol className="flex flex-wrap gap-2 my-3 mb-4 p-0 list-none text-xs text-slate-500" aria-label="Steps">
          {STEPS.map((label, i) => (
            <li
              key={label}
              aria-current={i === step ? 'step' : undefined}
              className={`px-2.5 py-1 rounded-full ${i === step ? 'bg-[#DDF3F2] text-[#145F5D] font-semibold' : 'bg-slate-100'}`}
            >
              {label}
            </li>
          ))}
        </ol>

        {/* Step 1: the file */}
        {phase === 'choose' && !fileError && (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pick(e.dataTransfer.files[0]);
            }}
            className={`relative flex items-center gap-3.5 p-5 rounded-lg border-2 border-dashed cursor-pointer bg-slate-100 focus-within:outline focus-within:outline-2 focus-within:outline-teal-nma focus-within:outline-offset-2 ${
              dragging ? 'border-teal-nma' : 'border-slate-300 hover:border-teal-nma'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf,application/epub+zip,.epub"
              aria-describedby={ids.limits}
              className="sr-only"
              onChange={(e) => void pick(e.target.files?.[0])}
            />
            <FileIcon label={format === 'epub' ? 'EPUB' : 'PDF'} />
            <span>
              <strong className="block text-slate-900">Choose a PDF or EPUB, or drop it here</strong>
              <span id={ids.limits} className="text-xs text-slate-500">
                PDF or EPUB, up to 50&nbsp;MB
              </span>
            </span>
          </label>
        )}

        {file && fileError && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg border border-rose-300 bg-white">
            <FileIcon label={format === 'epub' ? 'EPUB' : 'PDF'} />
            <div className="flex-1 min-w-[12rem]">
              <div className="font-semibold break-words">{file.name}</div>
              <p id={ids.fileError} role="alert" className="flex gap-1.5 mt-1 text-sm text-rose-800">
                <ErrorIcon />
                <span>{fileError}</span>
              </p>
            </div>
            <button
              type="button"
              className={smallGhostBtn}
              onClick={() => {
                setFile(null);
                setFileError(null);
                setPhase('choose');
              }}
            >
              Choose another
            </button>
          </div>
        )}

        {file && !fileError && (phase === 'details' || phase === 'uploading') && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
            <FileIcon label={format === 'epub' ? 'EPUB' : 'PDF'} />
            <div className="flex-1 min-w-[12rem]">
              <div className="font-semibold break-words">{file.name}</div>
              {phase === 'uploading' ? (
                <>
                  <div className="text-xs text-slate-500" aria-live="polite">
                    {queueing ? 'Uploaded, adding it to the list…' : `Uploading ${formatMb(progress.sent)} of ${formatMb(progress.total)}`}
                  </div>
                  <div
                    className="h-1.5 mt-2 rounded bg-slate-100 overflow-hidden"
                    role="progressbar"
                    aria-label="Upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                  >
                    <div className="h-full w-full origin-left bg-teal-nma transition-transform duration-500 motion-reduce:transition-none" style={{ transform: `scaleX(${pct / 100})` }} />
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500">{formatMb(file.size)}</div>
              )}
            </div>
            {phase === 'details' && (
              <button
                type="button"
                className={smallGhostBtn}
                onClick={() => {
                  setFile(null);
                  setPhase('choose');
                  setSubmitError(null);
                }}
              >
                Choose another
              </button>
            )}
          </div>
        )}

        {phase === 'queued' && file && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white" role="status">
            <FileIcon label={format === 'epub' ? 'EPUB' : 'PDF'} />
            <div className="flex-1 min-w-[12rem]">
              <div className="font-semibold break-words">Uploaded</div>
              <div className="text-xs text-slate-500">
                The runner converts it to Markdown when it next checks the queue. It is at the top of the list behind this window, and waits there for chunking.
              </div>
            </div>
            <button type="button" className={smallGhostBtn} onClick={reset}>
              Add another
            </button>
          </div>
        )}

        {/* Step 2: the details */}
        {showFields && (
          <fieldset disabled={phase === 'uploading'} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border-0 p-0 m-0 min-w-0">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor={ids.title} className="text-sm font-semibold text-slate-800">
                Title
              </label>
              <input
                ref={titleInputRef}
                id={ids.title}
                name="title"
                autoComplete="off"
                type="text"
                maxLength={300}
                value={details.title}
                onChange={(e) => setDetails({ ...details, title: e.target.value })}
                aria-invalid={file && !fileError && titleProblem ? true : undefined}
                aria-describedby={`${ids.title}-hint`}
                className={fieldClass}
              />
              <span id={`${ids.title}-hint`} aria-live="polite" className={`text-xs ${file && !fileError && titleProblem ? 'text-rose-800' : 'text-slate-500'}`}>
                {file && !fileError && titleProblem ? titleProblem : 'Include the volume or part, so each book has its own name.'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.author} className="text-sm font-semibold text-slate-800">
                Author
              </label>
              <input id={ids.author} name="author" autoComplete="off" type="text" maxLength={200} value={details.author} onChange={(e) => setDetails({ ...details, author: e.target.value })} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.translator} className="text-sm font-semibold text-slate-800">
                Translator <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input id={ids.translator} name="translator" autoComplete="off" type="text" maxLength={200} value={details.translator} onChange={(e) => setDetails({ ...details, translator: e.target.value })} className={fieldClass} />
            </div>
            <label className="sm:col-span-2 flex gap-2.5 items-start text-sm mt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={details.isPublic}
                onChange={(e) => setDetails({ ...details, isPublic: e.target.checked })}
                className="w-[18px] h-[18px] mt-0.5 accent-teal-nma"
              />
              <span>
                Public domain or openly licensed
                <span className="block text-xs text-slate-500">Leave off for books in copyright. Their text stays on the owner’s Mac.</span>
              </span>
            </label>
          </fieldset>
        )}

        {submitError && (
          <p role="alert" className="flex gap-1.5 mt-4 text-sm text-rose-800">
            <ErrorIcon />
            <span>{submitError}</span>
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 mt-5">
          {phase === 'queued' ? (
            <button ref={doneRef} type="button" className={primaryBtn} onClick={close}>
              Done
            </button>
          ) : (
            <>
              <button type="button" className={`${ghostBtn} disabled:opacity-50 disabled:cursor-not-allowed`} onClick={cancel} disabled={queueing}>
                Cancel
              </button>
              <button type="submit" className={primaryBtn} disabled={phase !== 'details' || !!titleProblem}>
                {queueing ? 'Queueing…' : phase === 'uploading' ? 'Uploading…' : 'Upload and convert'}
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
};
