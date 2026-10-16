import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { cancelAiJob, createAiJob, listAiJobs } from '../../lib/aiJobs';
import type { AiJob, AiJobKind } from '../../types/aiJob';

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full flex items-center justify-center p-8 text-center">
    <div className="max-w-md">{children}</div>
  </div>
);

const formatWhen = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};

const STATUS_STYLE: Record<AiJob['status'], string> = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-amber-100 text-amber-800',
  done: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-nma',
  cancelled: 'bg-slate-100 text-slate-500',
};

const POLL_ACTIVE_MS = 5000;
const POLL_IDLE_MS = 30000;

/**
 * Maintainer-only control panel for AI jobs. The page renders for anyone who
 * asks; the API refuses non-maintainers through row-level security, and the
 * page says so plainly rather than pretending to be secret. Queued jobs are
 * picked up by the home runner (see runner/README.md) and come back as a
 * pull request.
 */
export const AdminPage: React.FC = () => {
  const { enabled, loading, user, isMaintainer, signInWithGoogle } = useAuth();
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<AiJobKind>('summarize');
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [chunks, setChunks] = useState('');

  const refresh = useCallback(async (): Promise<AiJob[]> => {
    const { jobs: list, error: err } = await listAiJobs();
    setJobs(list);
    setError(err ?? null);
    return list;
  }, []);

  // Poll while anything is queued or running so progress shows up as it lands.
  useEffect(() => {
    if (!isMaintainer) return;
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      const list = await refresh();
      if (stopped) return;
      const active = list.some((j) => j.status === 'queued' || j.status === 'running');
      timer = window.setTimeout(tick, active ? POLL_ACTIVE_MS : POLL_IDLE_MS);
    };
    timer = window.setTimeout(tick, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [isMaintainer, refresh]);

  if (!enabled) {
    return (
      <Centered>
        <p className="text-slate-600">The backend is not configured, so there is no job queue here.</p>
      </Centered>
    );
  }
  if (loading) {
    return (
      <Centered>
        <p className="text-slate-500">Checking your account…</p>
      </Centered>
    );
  }
  if (!user) {
    return (
      <Centered>
        <p className="text-slate-600 mb-4">The admin panel is for maintainers. Sign in to continue.</p>
        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="bg-teal-nma text-white text-xs font-semibold tracking-wider uppercase px-5 py-2.5 rounded-full"
        >
          Sign in with Google
        </button>
      </Centered>
    );
  }
  if (!isMaintainer) {
    return (
      <Centered>
        <h1 className="text-lg font-semibold text-slate-800 mb-2">Maintainers only</h1>
        <p className="text-slate-600">
          Your account is signed in but does not have the maintainer role, so it cannot queue AI runs or see the
          queue. Ask a maintainer if you think it should.
        </p>
      </Centered>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source.trim() || !title.trim()) return;
    setBusy(true);
    const { error: err } = await createAiJob(
      kind,
      {
        source: source.trim(),
        title: title.trim(),
        author: author.trim() || null,
        slug: slug.trim() || null,
        public: isPublic,
        chunks: kind === 'extract' && chunks.trim() ? chunks.trim() : null,
      },
      user.id,
    );
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setSource('');
    setTitle('');
    setAuthor('');
    setSlug('');
    setIsPublic(false);
    setChunks('');
    await refresh();
  };

  return (
    <div className="h-full overflow-y-auto bg-panel">
      <div className="container mx-auto px-4 sm:px-6 py-8 max-w-5xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">AI jobs</h1>
          <p className="text-sm text-slate-600 mt-1">
            Queue a run for the home runner. It converts the source to Markdown, reads it with Claude on the
            owner's subscription, and opens a pull request with the result. Nothing goes live until that pull
            request is merged.
          </p>
        </header>

        <form onSubmit={submit} className="bg-white rounded-md border border-slate-200 p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Kind</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as AiJobKind)}
              className="w-full p-2 border border-slate-300 rounded text-sm bg-white"
            >
              <option value="summarize">Summarise a book</option>
              <option value="extract">Extract events from a book</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              Source (a URL, or a path on the runner such as content/private/slug/content.md)
            </span>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              placeholder="https://www.gutenberg.org/ebooks/58977.epub.noimages"
              className="w-full p-2 border border-slate-300 rounded text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full p-2 border border-slate-300 rounded text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Author</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm" />
          </label>
          <label className="text-sm">
            <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Slug (optional)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="derived from the title"
              className="w-full p-2 border border-slate-300 rounded text-sm"
            />
          </label>
          {kind === 'extract' && (
            <label className="text-sm">
              <span className="block text-[10px] uppercase tracking-widest text-slate-500 mb-1">Chunk range (optional, e.g. 1-10)</span>
              <input value={chunks} onChange={(e) => setChunks(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm" />
            </label>
          )}
          <label className="text-sm flex items-center gap-2 md:col-span-2">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <span>
              The source is public domain or openly licensed: also host its full text under <code>content/books/</code>.
            </span>
          </label>
          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="bg-teal-nma disabled:bg-slate-300 text-white text-xs font-semibold tracking-wider uppercase px-5 py-2.5 rounded-full"
            >
              {busy ? 'Queueing…' : 'Queue job'}
            </button>
            {error && <span className="text-sm text-red-nma">{error}</span>}
          </div>
        </form>

        <section>
          <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Queue</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500">No jobs yet.</p>
          ) : (
            <ul className="space-y-3">
              {jobs.map((j) => (
                <li key={j.id} className="bg-white rounded-md border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_STYLE[j.status]}`}>
                      {j.status}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-500">{j.kind}</span>
                    <span className="font-semibold text-slate-900">{j.input.title}</span>
                    <span className="text-xs text-slate-500 ml-auto">
                      {formatWhen(j.created_at)}
                      {j.attempts > 1 ? ` · attempt ${j.attempts}` : ''}
                    </span>
                  </div>
                  {j.status === 'running' && (
                    <div className="mt-2 text-xs text-slate-600">
                      {j.stage ?? 'working'}
                      {j.progress_total > 0 ? ` (${j.progress_done}/${j.progress_total})` : ''}
                      <div className="mt-1 h-1.5 bg-slate-100 rounded overflow-hidden">
                        <div
                          className="h-full bg-teal-nma"
                          style={{ width: `${j.progress_total ? Math.round((100 * j.progress_done) / j.progress_total) : 10}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {j.status === 'done' && j.result && (
                    <p className="mt-2 text-xs text-slate-600">
                      {j.result.prUrl ? (
                        <a href={j.result.prUrl} target="_blank" rel="noopener noreferrer" className="text-teal-nma font-semibold hover:underline">
                          Open the pull request
                        </a>
                      ) : (
                        'Finished'
                      )}
                      {typeof j.result.costUsd === 'number' && ` · about $${j.result.costUsd.toFixed(2)} of subscription usage`}
                      {j.result.model && ` · ${j.result.model}`}
                    </p>
                  )}
                  {j.status === 'failed' && j.error && <p className="mt-2 text-xs text-red-nma">{j.error}</p>}
                  {j.status === 'queued' && (
                    <button
                      type="button"
                      onClick={async () => {
                        await cancelAiJob(j.id);
                        await refresh();
                      }}
                      className="mt-2 text-xs text-slate-500 hover:text-red-nma"
                    >
                      Cancel
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
