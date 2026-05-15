import React, { useEffect, useMemo, useRef } from 'react';
import { HistoricalIncident } from '../../types/incident';
import { TimelineTopBar } from './TimelineTopBar';
import './timeline.css';

interface TimelineViewProps {
  incidents: HistoricalIncident[];
  onIncidentClick: (incident: HistoricalIncident) => void;
  selectedEra?: string;
  onEraChange?: (era: string) => void;
  dateRange: { start: string; end: string } | null;
  onDateRangeChange?: (range: { start: string; end: string } | null) => void;
}

interface EraDef {
  id: string;
  label: string;
}

const ERAS: EraDef[] = [
  { id: 'earlier', label: 'Earlier' },
  { id: '600', label: '600' },
  { id: '700', label: '700' },
  { id: '800', label: '800' },
  { id: '900', label: '900' },
  { id: '1000', label: '1000' },
  { id: '1100', label: '1100' },
  { id: '1200', label: '1200' },
  { id: '1300', label: '1300' },
  { id: '1400', label: '1400' },
  { id: '1500', label: '1500' },
  { id: '1600', label: '1600' },
  { id: '1700', label: '1700' },
  { id: '1800', label: '1800' },
  { id: '1900', label: '1900' },
  { id: '2000', label: '2000' },
];

const bucketize = (iso: string): string => {
  const year = parseInt(iso.split('-')[0], 10);
  if (Number.isNaN(year) || year < 600) return 'earlier';
  if (year >= 2000) return '2000';
  return String(Math.floor(year / 100) * 100);
};

interface CardVariant {
  width: number;
  height: number;
}

const CARD_VARIANTS: CardVariant[] = [
  { width: 220, height: 220 },
  { width: 240, height: 280 },
  { width: 260, height: 220 },
  { width: 280, height: 240 },
  { width: 200, height: 260 },
  { width: 260, height: 260 },
  { width: 220, height: 200 },
  { width: 280, height: 200 },
  { width: 200, height: 240 },
];

const hashString = (s: string): number =>
  Math.abs([...s].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 7));

const variantFor = (id: string): CardVariant =>
  CARD_VARIANTS[hashString(id) % CARD_VARIANTS.length];

const ERA_BASE_WIDTH = 200;
// Pixels of horizontal space per year of elapsed time. Controls visual density.
// Bumping it up spreads events further apart; bumping it down tightens clusters
// (and forces more lane alternation when events are close in date).
const PX_PER_YEAR = 28;
// Minimum horizontal gap (px) between two cards sharing a lane.
const LANE_GAP = 16;
// Buffer (px) added to the right edge of the placed cards before declaring the
// era's tracks width.
const ERA_RIGHT_BUFFER = 24;

// Convert "YYYY-MM-DD" into a fractional year (e.g. 610-10-13 → 610.78).
// Used to position cards along the X axis proportional to their date.
const fractionalYear = (iso: string): number => {
  const [y, m, d] = iso.split('-');
  const year = parseInt(y, 10);
  const month = parseInt(m ?? '1', 10);
  const day = parseInt(d ?? '1', 10);
  if (Number.isNaN(year)) return 0;
  const monthFrac = Number.isNaN(month) ? 0 : (month - 1) / 12;
  const dayFrac = Number.isNaN(day) ? 0 : (day - 1) / 372; // ≈ 1/31/12
  return year + monthFrac + dayFrac;
};

interface PlacedCard {
  incident: HistoricalIncident;
  x: number;
  width: number;
  lane: 'top' | 'bottom';
}

// Greedy chronological placement: walk events left-to-right by date, compute
// each card's "ideal X" from its date, then assign top or bottom lane based on
// which one lets it sit nearest to that ideal X without colliding with the
// previous card in the chosen lane. Layout is fully data-driven: any new event
// slots in automatically by its startDate.
function placeEra(events: HistoricalIncident[]): {
  placed: PlacedCard[];
  width: number;
} {
  if (events.length === 0) return { placed: [], width: 120 };

  // Numeric sort — see useIncidents.ts comment; protects against any
  // 3-digit vs 4-digit year mismatch in event data.
  const sorted = [...events].sort(
    (a, b) => fractionalYear(a.startDate) - fractionalYear(b.startDate),
  );
  const firstYear = fractionalYear(sorted[0].startDate);

  const placed: PlacedCard[] = [];
  let lastTopRight = -Infinity;
  let lastBotRight = -Infinity;

  for (const event of sorted) {
    const idealX = (fractionalYear(event.startDate) - firstYear) * PX_PER_YEAR;
    const width = variantFor(event.id).width;

    const nextXTop = Math.max(idealX, lastTopRight + LANE_GAP);
    const nextXBot = Math.max(idealX, lastBotRight + LANE_GAP);

    // Choose the lane that lets us sit closest to idealX (= smallest nextX).
    // Ties resolve toward the less-used lane so cards naturally alternate.
    const chooseTop =
      nextXTop < nextXBot ||
      (nextXTop === nextXBot && lastTopRight <= lastBotRight);

    if (chooseTop) {
      placed.push({ incident: event, x: nextXTop, width, lane: 'top' });
      lastTopRight = nextXTop + width;
    } else {
      placed.push({ incident: event, x: nextXBot, width, lane: 'bottom' });
      lastBotRight = nextXBot + width;
    }
  }

  const rightEdge = Math.max(lastTopRight, lastBotRight);
  return { placed, width: Math.max(120, rightEdge + ERA_RIGHT_BUFFER) };
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
  }).format(date);
};

interface CardProps {
  incident: HistoricalIncident;
  onClick: (incident: HistoricalIncident) => void;
}

const TimelineCard: React.FC<CardProps> = ({ incident, onClick }) => {
  const imageMedia = incident.media?.find((m) => m.type === 'image');
  const imageUrl = imageMedia?.url;
  const date = formatProseDate(incident.startDate);
  const { width, height } = variantFor(incident.id);
  const sizeStyle: React.CSSProperties = { width, height };

  if (imageUrl) {
    return (
      <button
        type="button"
        onClick={() => onClick(incident)}
        className="timeline-card timeline-card--image"
        style={sizeStyle}
        aria-label={`${incident.title}, ${date}`}
      >
        <img src={imageUrl} alt="" className="timeline-card-image" />
        <div className="timeline-card-image-overlay">
          <div className="timeline-card-image-date">{date}</div>
          <div className="timeline-card-image-title">{incident.title}</div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClick(incident)}
      className="timeline-card timeline-card--text"
      style={sizeStyle}
      aria-label={`${incident.title}, ${date}`}
    >
      <div className="timeline-card-text-title">{incident.title}</div>
      <div className="timeline-card-text-date">{date}</div>
    </button>
  );
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  incidents,
  onIncidentClick,
  selectedEra,
  onEraChange,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const eraRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const grouped = useMemo(() => {
    return ERAS.map((era) => ({
      ...era,
      incidents: incidents
        .filter((i) => bucketize(i.startDate) === era.id)
        .sort(
          (a, b) =>
            fractionalYear(a.startDate) - fractionalYear(b.startDate),
        ),
    }));
  }, [incidents]);

  useEffect(() => {
    if (!selectedEra) return;
    const target = eraRefs.current[selectedEra];
    const scroller = scrollerRef.current;
    if (!target || !scroller) return;
    scroller.scrollTo({
      left: target.offsetLeft - 80,
      behavior: 'smooth',
    });
  }, [selectedEra]);

  return (
    <div className="relative w-full bg-white">
      <TimelineTopBar
        selectedEra={selectedEra}
        onEraChange={onEraChange ?? (() => {})}
      />
      <div
        ref={scrollerRef}
        className="timeline-scroller"
        role="region"
        aria-label="Historical timeline"
      >
        <div className="timeline-stage">
          <div className="timeline-rail" aria-hidden="true" />

          <div className="timeline-scroll-hint" aria-hidden="true">
            SCROLL <span className="timeline-scroll-hint-arrow">›</span>
          </div>

          {grouped.map((era) => {
            const { placed, width: tracksWidth } = placeEra(era.incidents);
            const eraWidth = ERA_BASE_WIDTH + tracksWidth;

            return (
              <div
                key={era.id}
                ref={(el) => { eraRefs.current[era.id] = el; }}
                className="timeline-era"
                style={{ width: eraWidth }}
              >
                <div className="timeline-era-label">{era.label}</div>
                <div
                  className="timeline-era-tracks"
                  style={{ width: tracksWidth }}
                >
                  {placed.map((p) => (
                    <div
                      key={p.incident.id}
                      className={`timeline-slot timeline-slot--${p.lane}`}
                      style={{ left: p.x }}
                    >
                      <TimelineCard
                        incident={p.incident}
                        onClick={onIncidentClick}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
