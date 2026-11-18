// Pure layout for the "Along time" connections view: which events are drawn,
// which links join them, and where each event sits. Kept apart from the
// component so it can be tested and reused.
import type { HistoricalIncident } from '../../types/incident';

export const CATEGORIES = ['political', 'religious', 'cultural', 'scientific', 'military'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLOR: Record<Category, string> = {
  political: '#2D6BFF',
  religious: '#00A862',
  cultural: '#8B3FE0',
  scientific: '#E08600',
  military: '#E8264B',
};

/** Darker shades of the same hues for small text: each is at least 4.5:1 on white. */
export const CATEGORY_TEXT: Record<Category, string> = {
  political: '#1D4ED8',
  religious: '#007A47',
  cultural: '#8B3FE0',
  scientific: '#9A5800',
  military: '#C21A3A',
};

export interface PlacedEvent {
  incident: HistoricalIncident;
  year: number;
  lane: number;
  /** Position inside the lane, 0 to 1, spread so neighbours rarely overlap. */
  spread: number;
  degree: number;
}

export interface ConnectionsLayout {
  events: PlacedEvent[];
  byId: Map<string, PlacedEvent>;
  neighbours: Map<string, Set<string>>;
  links: Array<[string, string]>;
  /** Events in the filtered set that have no connection to another event in it. */
  unconnected: number;
  /** Connected events with no usable year (missing, or before year 1); not drawn on the axis. */
  undated: number;
  /** The full year range, rounded out to whole half-centuries. */
  yearMin: number;
  yearMax: number;
}

export const yearOf = (incident: HistoricalIncident): number => {
  const y = parseInt(incident.startDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : 0;
};

/** Links are unordered pairs between events that are both in the given set. */
export function layoutConnections(incidents: HistoricalIncident[]): ConnectionsLayout {
  const inSet = new Map(incidents.map((i) => [i.id, i]));
  const neighbours = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!neighbours.has(a)) neighbours.set(a, new Set());
    neighbours.get(a)!.add(b);
  };
  for (const i of incidents) {
    for (const other of i.connections ?? []) {
      if (other === i.id || !inSet.has(other)) continue;
      add(i.id, other);
      add(other, i.id);
    }
  }
  const connected = incidents.filter((i) => neighbours.has(i.id));
  // Only events with a year can sit on a year axis; the rest are counted, not drawn.
  const dated = connected.filter((i) => yearOf(i) > 0);
  const drawn = new Set(dated.map((i) => i.id));
  const links: Array<[string, string]> = [];
  for (const [a, set] of neighbours) for (const b of set) if (a < b && drawn.has(a) && drawn.has(b)) links.push([a, b]);

  const events: PlacedEvent[] = dated.map((incident, k) => ({
    incident,
    year: yearOf(incident),
    lane: Math.max(0, CATEGORIES.indexOf(incident.category as Category)),
    // A fixed spread (golden-ratio steps) keeps dots apart and stable between renders.
    spread: (k * 0.618034) % 1,
    // Only neighbours that are drawn, so the count matches the list people see.
    degree: [...neighbours.get(incident.id)!].filter((id) => drawn.has(id)).length,
  }));
  const years = events.map((e) => e.year);
  const yearMin = years.length ? Math.floor(Math.min(...years) / 50) * 50 : 600;
  const yearMax = years.length ? Math.max(yearMin + 50, Math.ceil(Math.max(...years) / 50) * 50) : 650;
  return {
    events,
    byId: new Map(events.map((e) => [e.incident.id, e])),
    neighbours,
    links,
    unconnected: incidents.length - connected.length,
    undated: connected.length - dated.length,
    yearMin,
    yearMax,
  };
}

/** Spacing for the year marks: wider steps when more years are in view. */
export function tickStep(span: number, narrow: boolean): number {
  const s = span * (narrow ? 3 : 1);
  if (s > 300) return narrow ? 100 : 50;
  if (s > 120) return 25;
  if (s > 50) return 10;
  if (s > 20) return 5;
  return 1;
}

/**
 * Zoom the visible years [from, to] by `factor` around `year`, keeping at least
 * `minSpan` years and never leaving [yearMin, yearMax].
 */
export function zoomAround(
  view: [number, number],
  year: number,
  factor: number,
  bounds: [number, number],
  minSpan = 10,
): [number, number] {
  const [from, to] = view;
  const span = Math.min(bounds[1] - bounds[0], Math.max(minSpan, (to - from) * factor));
  let start = year - ((year - from) * span) / (to - from);
  start = Math.max(bounds[0], Math.min(bounds[1] - span, start));
  return [start, start + span];
}

/** Move the visible years by `delta`, staying inside the bounds. */
export function panBy(view: [number, number], delta: number, bounds: [number, number]): [number, number] {
  const span = view[1] - view[0];
  const start = Math.max(bounds[0], Math.min(bounds[1] - span, view[0] + delta));
  return [start, start + span];
}
