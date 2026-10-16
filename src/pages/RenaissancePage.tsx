import { useMemo, useState } from 'react';
import { ResourceCard } from '../components/library/ResourceCard';
import { useLibrary } from '../hooks/useLibrary';
import { RENAISSANCE_CATEGORIES } from '../data/renaissanceCategories';
import type { HistoricalIncident } from '../types/incident';
import type { ResourceType } from '../types/library';

// The period the section covers. The Abbasid caliphate's rise in 750 is the
// usual opening marker; the late 1300s and the Timurid conquests the usual close.
export const PERIOD_START = 750;
export const PERIOD_END = 1400;

// The corpus has hundreds of moments in this range, so the page shows a sample
// and points at the timeline for the rest.
const MOMENTS_SHOWN = 24;

const TYPE_LABELS: Record<ResourceType, string> = {
  book: 'Books',
  report: 'Reports',
  article: 'Articles',
  video: 'Videos',
  course: 'Courses',
};

const yearOf = (iso: string): number => parseInt(iso.split('-')[0], 10);

interface RenaissancePageProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
}

export function RenaissancePage({ incidents, onIncidentClick }: RenaissancePageProps) {
  const { resources, countByCategory } = useLibrary();

  const [category, setCategory] = useState<string | null>(null);
  const [type, setType] = useState<ResourceType | ''>('');
  const [query, setQuery] = useState('');

  const periodEvents = useMemo(
    () =>
      incidents.filter((e) => {
        const y = yearOf(e.startDate);
        return y >= PERIOD_START && y <= PERIOD_END;
      }),
    [incidents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return resources.filter((r) => {
      if (category && !r.categories.includes(category as never)) return false;
      if (type && r.type !== type) return false;
      if (q) {
        const hay = `${r.title} ${r.creators.join(' ')} ${r.summary}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [resources, category, type, query]);

  const typesPresent = useMemo(
    () => (Object.keys(TYPE_LABELS) as ResourceType[]).filter((t) => resources.some((r) => r.type === t)),
    [resources],
  );

  const selectCategory = (id: string) => {
    setCategory((current) => (current === id ? null : id));
    document.getElementById('resources')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-panel font-sans">
      {/* Hero */}
      <header className="bg-navy-nma text-white">
        <div className="container mx-auto px-4 sm:px-6 py-10 sm:py-16 max-w-5xl">
          <div className="text-[11px] sm:text-xs font-semibold tracking-widest uppercase text-teal-nma-bright mb-3">
            Circa {PERIOD_START} to {PERIOD_END}
          </div>
          <h1 className="text-3xl sm:text-5xl font-semibold leading-tight mb-5">
            The Islamic Renaissance
          </h1>
          <p className="text-sm sm:text-lg text-white/85 leading-relaxed max-w-3xl mb-4">
            For about six centuries, scholars working in Arabic from Córdoba to Samarkand
            gathered the knowledge of Greece, Persia and India, tested it, and added to it.
            They gave us algebra and the word algorithm, hospitals with wards and
            pharmacies, star tables that sailors used for centuries, and the medical
            textbook Europe taught from until the 1600s.
          </p>
          <p className="text-sm sm:text-lg text-white/85 leading-relaxed max-w-3xl">
            This section collects books, articles and other open resources about that
            period, sorted by subject. Where the original text is free to read, we link
            straight to it.
          </p>
          <dl className="mt-8 flex flex-wrap gap-6 sm:gap-10">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-white/60">Resources</dt>
              <dd className="text-2xl sm:text-3xl font-semibold">{resources.length}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-white/60">Moments on the timeline</dt>
              <dd className="text-2xl sm:text-3xl font-semibold">{periodEvents.length.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-white/60">Subjects</dt>
              <dd className="text-2xl sm:text-3xl font-semibold">{RENAISSANCE_CATEGORIES.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-5xl space-y-10 sm:space-y-14">
        {/* Category grid */}
        <section aria-labelledby="subjects-heading">
          <h2 id="subjects-heading" className="text-xs uppercase tracking-widest text-slate-500 mb-4">
            Browse by subject
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {RENAISSANCE_CATEGORIES.map((c) => {
              const active = category === c.id;
              const count = countByCategory[c.id] ?? 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCategory(c.id)}
                  aria-pressed={active}
                  className={`text-left rounded-md border p-4 transition-colors ${
                    active
                      ? 'bg-teal-nma text-white border-teal-nma'
                      : 'bg-white border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{c.label}</h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${active ? 'text-white/85' : 'text-slate-600'}`}>
                    {c.blurb}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Resources */}
        <section id="resources" aria-labelledby="resources-heading" className="scroll-mt-12">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
            <h2 id="resources-heading" className="text-xs uppercase tracking-widest text-slate-500">
              Resources{category ? `: ${RENAISSANCE_CATEGORIES.find((c) => c.id === category)?.label}` : ''}
            </h2>
            <div className="flex flex-wrap gap-2">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ResourceType | '')}
                aria-label="Filter by type"
                className="p-2 border border-slate-300 rounded text-sm bg-white"
              >
                <option value="">All types</option>
                {typesPresent.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search titles and authors"
                aria-label="Search resources"
                className="p-2 border border-slate-300 rounded text-sm bg-white w-full sm:w-64"
              />
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory(null)}
                  className="text-sm text-teal-nma font-semibold px-2"
                >
                  Clear subject
                </button>
              )}
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {filtered.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              No resources match these filters yet.
            </div>
          )}
        </section>

        {/* Timeline moments */}
        <section aria-labelledby="moments-heading">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 id="moments-heading" className="text-xs uppercase tracking-widest text-slate-500">
              Moments on the timeline, {PERIOD_START} to {PERIOD_END}
            </h2>
            {periodEvents.length > MOMENTS_SHOWN && (
              <a href="#/timeline" className="text-xs font-semibold text-teal-nma hover:underline whitespace-nowrap">
                All {periodEvents.length.toLocaleString()} on the timeline
              </a>
            )}
          </div>
          {periodEvents.length > 0 ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {periodEvents.slice(0, MOMENTS_SHOWN).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onIncidentClick(e)}
                    className="w-full text-left bg-white rounded-md border border-slate-200 p-4 hover:border-slate-400 transition-colors"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                      {yearOf(e.startDate)} · {e.category}
                    </div>
                    <div className="font-semibold text-slate-900">{e.title}</div>
                    {e.location?.name && (
                      <div className="text-xs text-slate-500 mt-1">{e.location.name}</div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">No timeline events fall in this period yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
