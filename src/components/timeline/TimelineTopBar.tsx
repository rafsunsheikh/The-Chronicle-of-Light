import React, { useRef } from 'react';

interface EraMarker {
  year: string;
  label: string;
}

const ERA_MARKERS: EraMarker[] = [
  { year: 'earlier', label: 'Earlier' },
  { year: '600', label: '600' },
  { year: '700', label: '700' },
  { year: '800', label: '800' },
  { year: '900', label: '900' },
  { year: '1000', label: '1000' },
  { year: '1100', label: '1100' },
  { year: '1200', label: '1200' },
  { year: '1300', label: '1300' },
  { year: '1400', label: '1400' },
  { year: '1500', label: '1500' },
  { year: '1600', label: '1600' },
  { year: '1700', label: '1700' },
  { year: '1800', label: '1800' },
  { year: '1900', label: '1900' },
  { year: '2000', label: '2000' },
];

interface TimelineTopBarProps {
  selectedEra?: string;
  onEraChange: (era: string) => void;
  onClose?: () => void;
  onAddEvent?: () => void;
  onExport?: () => void;
  changeCount?: number;
}

export const TimelineTopBar: React.FC<TimelineTopBarProps> = ({
  selectedEra,
  onEraChange,
  onClose,
  onAddEvent,
  onExport,
  changeCount = 0,
}) => {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const showActions = Boolean(onAddEvent || onExport);

  return (
    <div className="relative bg-white border-b border-slate-200 h-12 sm:h-16">
      <div
        className={`h-full flex items-start pl-28 sm:pl-44 pt-2 sm:pt-3 overflow-x-auto ${
          showActions ? 'pr-44 sm:pr-80' : 'pr-6 sm:pr-14'
        }`}
      >
      <nav
        role="navigation"
        aria-label="Era navigation"
        className="flex items-start space-x-4 sm:space-x-8 whitespace-nowrap"
      >
        {ERA_MARKERS.map((era, idx) => {
          const isActive = selectedEra === era.year;
          return (
            <div
              key={era.year}
              className="relative flex flex-col items-center pb-4"
            >
              <button
                ref={(el) => { buttonRefs.current[era.year] = el; }}
                onClick={() => onEraChange(era.year)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const next = ERA_MARKERS[Math.min(idx + 1, ERA_MARKERS.length - 1)];
                    buttonRefs.current[next.year]?.focus();
                    onEraChange(next.year);
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prev = ERA_MARKERS[Math.max(idx - 1, 0)];
                    buttonRefs.current[prev.year]?.focus();
                    onEraChange(prev.year);
                  }
                }}
                aria-pressed={isActive}
                className={`text-[13px] sm:text-[15px] font-medium transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900 ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {era.label}
              </button>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 -translate-x-1/2 -bottom-1 flex items-center justify-center w-5 h-5 bg-red-nma text-white text-xs font-bold leading-none shadow-sm"
                >
                  ›
                </span>
              )}
            </div>
          );
        })}
      </nav>
      </div>

      <div className="absolute top-1/2 right-3 sm:right-4 -translate-y-1/2 flex items-center gap-2 bg-white pl-3">
        {onAddEvent && (
          <button
            onClick={onAddEvent}
            className="flex items-center gap-1 rounded-full bg-teal-nma hover:bg-teal-nma/90 text-white text-[11px] sm:text-xs font-semibold tracking-wider uppercase px-3 sm:px-4 py-1.5 sm:py-2 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="hidden sm:inline">Add event</span>
            <span className="sm:hidden">Add</span>
          </button>
        )}
        {onExport && (
          <button
            onClick={onExport}
            disabled={changeCount === 0}
            title={
              changeCount === 0
                ? 'No edits to export yet'
                : `Download ${changeCount} edited/added event(s) as JSON`
            }
            className="rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] sm:text-xs font-semibold tracking-wider uppercase px-3 sm:px-4 py-1.5 sm:py-2 transition-colors"
          >
            Export{changeCount > 0 ? ` (${changeCount})` : ''}
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close timeline"
            className="w-8 h-8 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6L18 18M6 18L18 6" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
