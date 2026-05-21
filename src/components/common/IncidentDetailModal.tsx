import React, { useEffect } from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentDetailModalProps {
  incident: HistoricalIncident | null;
  onClose: () => void;
}

const formatProseDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  const year = parseInt(y, 10);
  const month = parseInt(m ?? '1', 10);
  const day = parseInt(d ?? '1', 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date).toUpperCase();
};

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
}) => {
  useEffect(() => {
    if (!incident) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [incident, onClose]);

  if (!incident) return null;

  const heroMedia = incident.media?.find((m) => m.type === 'image');
  const heroUrl = heroMedia?.url;
  const heroCaption = heroMedia?.caption;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-headline"
      className="fixed inset-0 z-50 bg-panel overflow-y-auto"
    >
      <button
        onClick={onClose}
        aria-label="Close detail panel"
        className="fixed sm:absolute top-3 sm:top-6 right-3 sm:right-6 w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-300 bg-white/95 backdrop-blur-sm text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors z-20"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6L18 18M6 18L18 6" />
        </svg>
      </button>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16 py-8 sm:py-12 md:py-16 grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
        <figure>
          {heroUrl ? (
            <img
              src={heroUrl}
              alt={heroCaption ?? incident.title}
              className="w-full aspect-[4/3] object-cover rounded-sm"
            />
          ) : (
            <div className="w-full aspect-[4/3] rounded-sm bg-slate-200 flex items-center justify-center text-slate-400">
              <span className="font-serif italic">No image available</span>
            </div>
          )}
          {heroCaption && (
            <figcaption className="mt-3 text-xs italic text-slate-500">
              {heroCaption}
            </figcaption>
          )}
        </figure>

        <div>
          <div className="text-xs font-semibold tracking-widest text-slate-500 mb-3">
            {formatProseDate(incident.startDate)}
          </div>

          <h2
            id="incident-headline"
            className="text-2xl sm:text-3xl md:text-4xl font-semibold text-teal-nma mb-4 sm:mb-6"
          >
            {incident.title}
          </h2>

          <p className="text-sm sm:text-base text-slate-700 leading-relaxed mb-6 sm:mb-8">
            {incident.description}
          </p>

          <button
            type="button"
            disabled
            title="Article page coming soon"
            className="bg-teal-nma hover:bg-teal-nma/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[11px] sm:text-xs font-semibold tracking-wider uppercase px-5 sm:px-6 py-2.5 sm:py-3 rounded-full transition-colors"
          >
            Read more about this moment
          </button>
        </div>
      </div>
    </div>
  );
};
