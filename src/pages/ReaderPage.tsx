import { useEffect, useState } from 'react';
import { useLibrary } from '../hooks/useLibrary';
import { LICENSE_LABELS } from '../data/licenses';
import { loadBookMarkdown, splitFrontMatter } from '../lib/books';
import { readingMinutes, renderBook } from '../lib/markdown';
import './reader.css';

interface ReaderPageProps {
  id: string | null;
}

type Loaded =
  | { status: 'error'; message: string }
  | { status: 'ready'; html: string; toc: { id: string; text: string; level: number }[]; minutes: number; body: string };
// The loaded text remembers which path it came from, so switching books shows
// "loading" by comparison rather than by resetting state inside the effect.
type State = (Loaded & { path: string }) | { status: 'loading'; path: null };

/**
 * Reads a hosted book. The Markdown chunk is fetched only when this page
 * opens; the contents list is built from the headings and links into the
 * text. Licence and source sit at the top so nothing is hosted anonymously.
 */
export function ReaderPage({ id }: ReaderPageProps) {
  const { byId } = useLibrary();
  const resource = id ? byId.get(id) : undefined;
  const contentPath = resource?.hosted ? resource.contentPath ?? null : null;
  const [loaded, setLoaded] = useState<State>({ status: 'loading', path: null });
  const [tocOpen, setTocOpen] = useState(false);
  const state: State = loaded.path === contentPath ? loaded : { status: 'loading', path: null };

  useEffect(() => {
    if (!contentPath) return;
    let cancelled = false;
    loadBookMarkdown(contentPath)
      .then((markdown) => {
        if (cancelled) return;
        const { body } = splitFrontMatter(markdown);
        const { html, toc } = renderBook(body);
        setLoaded({ status: 'ready', html, toc, minutes: readingMinutes(body), body, path: contentPath });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoaded({ status: 'error', message: err.message, path: contentPath });
      });
    return () => {
      cancelled = true;
    };
  }, [contentPath]);

  // Build the download only when asked, and release the object URL at once.
  const download = () => {
    if (state.status !== 'ready' || !resource) return;
    const url = URL.createObjectURL(new Blob([state.body], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${resource.id}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!resource || !contentPath) {
    return (
      <div className="bg-panel font-sans">
        <main className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl text-center">
          <p className="text-slate-600 mb-4">
            {resource ? 'This resource is not hosted on the site; read it at the source.' : 'That resource is not in the library.'}
          </p>
          <a href={resource ? `#/library/${encodeURIComponent(resource.id)}` : '#/renaissance'} className="text-sm font-semibold text-teal-nma hover:underline">
            {resource ? 'Back to the resource' : 'Back to the Islamic Renaissance'}
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-panel font-sans min-h-full">
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 sm:px-6 py-4 max-w-6xl flex flex-wrap items-center gap-x-6 gap-y-2">
          <a href={`#/library/${encodeURIComponent(resource.id)}`} className="text-xs font-semibold tracking-widest uppercase text-teal-nma hover:underline">
            ← {resource.title}
          </a>
          <span className="text-xs text-slate-500">
            {resource.creators.join(', ')} · {resource.year} · {LICENSE_LABELS[resource.license]} · from{' '}
            {resource.source.url ? (
              <a href={resource.source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{resource.source.name}</a>
            ) : (
              resource.source.name
            )}
            {state.status === 'ready' && ` · about ${state.minutes} min`}
          </span>
          {state.status === 'ready' && (
            <button type="button" onClick={download} className="ml-auto text-xs font-semibold text-teal-nma hover:underline">
              Download Markdown
            </button>
          )}
        </div>
      </header>

      {state.status === 'loading' && <p className="container mx-auto px-4 py-12 max-w-6xl text-slate-500">Opening the book…</p>}
      {state.status === 'error' && <p className="container mx-auto px-4 py-12 max-w-6xl text-red-nma">{state.message}</p>}

      {state.status === 'ready' && (
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-10 max-w-6xl lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
          <aside className="mb-6 lg:mb-0">
            <button
              type="button"
              onClick={() => setTocOpen((o) => !o)}
              aria-expanded={tocOpen}
              className="lg:hidden w-full text-left bg-white border border-slate-200 rounded-md px-4 py-3 text-sm font-semibold text-slate-800"
            >
              Contents ({state.toc.length}) {tocOpen ? '▴' : '▾'}
            </button>
            <nav aria-label="Contents" className={`${tocOpen ? 'block' : 'hidden'} lg:block lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto bg-white border border-slate-200 rounded-md p-4 mt-2 lg:mt-0`}>
              <h2 className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 hidden lg:block">Contents</h2>
              {state.toc.length === 0 ? (
                <p className="text-xs text-slate-500">No headings in this text.</p>
              ) : (
                <ol className="space-y-1">
                  {state.toc.map((t) => (
                    <li key={t.id} style={{ paddingLeft: `${(t.level - 1) * 12}px` }}>
                      <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(t.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setTocOpen(false); }} className="block text-sm text-slate-700 hover:text-teal-nma leading-snug py-0.5">
                        {t.text}
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </nav>
          </aside>
          <article className="reader-prose bg-white border border-slate-200 rounded-md px-5 sm:px-10 py-8 sm:py-12" dangerouslySetInnerHTML={{ __html: state.html }} />
        </div>
      )}
    </div>
  );
}
