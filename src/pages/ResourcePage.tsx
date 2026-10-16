import { ResourceCard } from '../components/library/ResourceCard';
import { VideoEmbed } from '../components/library/VideoEmbed';
import { LICENSE_LABELS } from '../data/licenses';
import { useLibrary } from '../hooks/useLibrary';
import { categoryLabel } from '../data/renaissanceCategories';
import type { HistoricalIncident } from '../types/incident';

interface ResourcePageProps {
  id: string | null;
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
}

export function ResourcePage({ id, incidents, onIncidentClick }: ResourcePageProps) {
  const { resources, byId } = useLibrary();
  const resource = id ? byId.get(id) : undefined;

  if (!resource) {
    return (
      <div className="bg-panel font-sans">
        <main className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl text-center">
          <p className="text-slate-600 mb-4">That resource is not in the library.</p>
          <a href="#/renaissance" className="text-sm font-semibold text-teal-nma hover:underline">
            Back to the Islamic Renaissance
          </a>
        </main>
      </div>
    );
  }

  const related = incidents.filter((e) => resource.relatedEvents?.includes(e.id));
  const siblings = resources
    .filter((r) => r.id !== resource.id && r.categories.some((c) => resource.categories.includes(c)))
    .slice(0, 3);

  return (
    <div className="bg-panel font-sans">
      <main className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 max-w-4xl">
        <a href="#/renaissance" className="text-xs font-semibold tracking-widest uppercase text-teal-nma hover:underline">
          ← Islamic Renaissance
        </a>

        <article className="mt-6 bg-white rounded-md border border-slate-200 p-5 sm:p-8">
          {resource.type === 'video' && resource.video && (
            <VideoEmbed video={resource.video} title={resource.title} className="mb-6" />
          )}
          <div className="text-[11px] font-semibold tracking-widest uppercase text-slate-500 mb-2">
            {resource.type} · {resource.year}
          </div>
          <h1 className="text-2xl sm:text-4xl font-semibold text-teal-nma leading-tight mb-2">
            {resource.title}
          </h1>
          {resource.originalTitle && (
            <p className="text-sm text-slate-500 italic mb-2">{resource.originalTitle}</p>
          )}
          <p className="text-sm sm:text-base text-slate-700 mb-1">{resource.creators.join(', ')}</p>
          {resource.edition && <p className="text-xs text-slate-500 mb-4">{resource.edition}</p>}

          <p className="text-sm sm:text-base text-slate-700 leading-relaxed mt-4 mb-6">
            {resource.summary}
          </p>

          <div className="flex flex-wrap gap-1 mb-6">
            {resource.categories.map((c) => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {categoryLabel(c)}
              </span>
            ))}
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm border-t border-slate-100 pt-4">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Licence</dt>
              <dd className="text-slate-800">{LICENSE_LABELS[resource.license]}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Language</dt>
              <dd className="text-slate-800 uppercase">{resource.language}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Source</dt>
              <dd className="text-slate-800">
                {resource.source.url ? (
                  <a href={resource.source.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {resource.source.name}
                  </a>
                ) : (
                  resource.source.name
                )}
                <span className="text-slate-500"> · retrieved {resource.source.retrieved}</span>
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Full text on this site</dt>
              <dd className="text-slate-800">
                {resource.hosted ? (
                  <a href={`#/library/${encodeURIComponent(resource.id)}/read`} className="text-teal-nma font-semibold hover:underline">
                    Yes, read it here
                  </a>
                ) : (
                  'No, read it at the source'
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-6 flex flex-wrap gap-3">
            {resource.hosted && (
              <a
                href={`#/library/${encodeURIComponent(resource.id)}/read`}
                className="inline-block bg-navy-nma hover:bg-navy-nma/90 text-white text-[11px] sm:text-xs font-semibold tracking-wider uppercase px-5 sm:px-6 py-2.5 sm:py-3 rounded-full transition-colors"
              >
                Read on this site
              </a>
            )}
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-teal-nma hover:bg-teal-nma/90 text-white text-[11px] sm:text-xs font-semibold tracking-wider uppercase px-5 sm:px-6 py-2.5 sm:py-3 rounded-full transition-colors"
            >
              Open at source
            </a>
          </div>
        </article>

        {related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">Related moments on the timeline</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {related.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onIncidentClick(e)}
                    className="w-full text-left bg-white rounded-md border border-slate-200 p-4 hover:border-slate-400 transition-colors"
                  >
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                      {e.startDate.split('-')[0]} · {e.category}
                    </div>
                    <div className="font-semibold text-slate-900">{e.title}</div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {siblings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">More on these subjects</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {siblings.map((r) => (
                <ResourceCard key={r.id} resource={r} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
