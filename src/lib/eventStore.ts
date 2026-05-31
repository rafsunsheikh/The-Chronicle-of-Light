import { HistoricalIncident } from '../types/incident';

// User edits and newly-added events are kept in a localStorage "overlay" that
// is merged on top of the build-time event data (see useIncidents.ts). The base
// JSON files are never mutated; the overlay is the only writable layer, and the
// Export button serialises it back out so changes can be committed to the repo.

const STORAGE_KEY = 'iht:event-overrides:v1';

export const CATEGORIES: HistoricalIncident['category'][] = [
  'political',
  'religious',
  'cultural',
  'scientific',
  'military',
];

export const CONFIDENCE_LEVELS: NonNullable<HistoricalIncident['confidence']>[] = [
  'established',
  'contested',
  'legendary',
  'auto-imported',
];

export type EventOverrides = Record<string, HistoricalIncident>;

export function loadOverrides(): EventOverrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as EventOverrides) : {};
  } catch {
    return {};
  }
}

export function persistOverrides(overrides: EventOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // Storage may be unavailable (private mode / quota); edits still apply
    // for the current session, they just won't survive a reload.
  }
}

export function emptyIncident(): HistoricalIncident {
  return {
    id: '',
    title: '',
    description: '',
    startDate: '',
    category: 'political',
    connections: [],
    media: [],
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Build an id in the repo's "event-YYYY-slug" convention, appending a numeric
// suffix if that id is already taken.
export function generateId(
  title: string,
  startDate: string,
  taken: Set<string>,
): string {
  const year = (startDate.split('-')[0] || '0000').padStart(4, '0');
  const slug = slugify(title) || 'event';
  const base = `event-${year}-${slug}`;
  let id = base;
  let n = 2;
  while (taken.has(id)) {
    id = `${base}-${n}`;
    n += 1;
  }
  return id;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
