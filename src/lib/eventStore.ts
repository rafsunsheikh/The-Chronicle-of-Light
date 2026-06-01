import { HistoricalIncident } from '../types/incident';

// Form-side helpers for composing event objects. Edits/additions are no longer
// stored locally — they're submitted to Supabase as pending submissions (see
// lib/submissions.ts) and, once approved, merged over the base JSON.

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
