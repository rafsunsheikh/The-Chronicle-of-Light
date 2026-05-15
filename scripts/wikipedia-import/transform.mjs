// Transform: Wikipedia summary + Wikidata claims → HistoricalIncident shape.
// Categorization is heuristic: P31 ("instance of") labels are matched against
// keyword lists. Reviewers correct mis-categorizations during the
// imported/ → events/ promotion step.

import { wikipediaUrl } from './wikipedia.mjs';

const CATEGORY_KEYWORDS = {
  military: [
    'battle', 'siege', 'war', 'conflict', 'military',
    'invasion', 'conquest', 'campaign', 'raid', 'revolt', 'rebellion',
  ],
  political: [
    'caliphate', 'dynasty', 'empire', 'kingdom', 'sultanate', 'emirate',
    'treaty', 'coronation', 'state', 'reign', 'government', 'succession',
    'assassination', 'monarchy', 'republic', 'constitution',
  ],
  religious: [
    'religious', 'religion', 'prophet', 'theological', 'theology',
    'scripture', 'sect', 'movement', 'order', 'pilgrimage', 'sermon',
    'covenant',
  ],
  scientific: [
    'scientific', 'science', 'discovery', 'invention', 'medical',
    'mathematical', 'astronomical', 'philosophy', 'philosophical',
    'theory', 'observatory', 'experiment',
  ],
  cultural: [
    'literary', 'literature', 'manuscript', 'book', 'poetry', 'poem',
    'painting', 'architecture', 'building', 'monument', 'city',
    'settlement', 'art', 'mosque', 'library', 'school', 'university',
    'madrasa',
  ],
};

const CATEGORY_PRIORITY = ['military', 'religious', 'political', 'scientific', 'cultural'];

export function categorize(types) {
  if (!types || types.length === 0) return null;
  const haystack = types.join(' ').toLowerCase();
  for (const cat of CATEGORY_PRIORITY) {
    for (const kw of CATEGORY_KEYWORDS[cat]) {
      if (haystack.includes(kw)) return cat;
    }
  }
  return null;
}

// Trim Wikipedia-style extract to ~280 chars at a sentence boundary.
export function condenseExtract(extract, max = 280) {
  if (!extract) return '';
  const cleaned = extract.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  const window = cleaned.slice(0, max + 60);
  const lastStop = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? '),
  );
  if (lastStop > max * 0.6) return window.slice(0, lastStop + 1);
  return cleaned.slice(0, max).replace(/[,;:]?\s*\S*$/, '') + '…';
}

// Normalize Wikidata ISO timestamps to "YYYY-MM-DD".
// Wikidata format examples:
//   "+0610-10-13T00:00:00Z"  → "0610-10-13"
//   "+0830-01-01T00:00:00Z"  → "0830-01-01"
//   "-0500-01-01T00:00:00Z"  → null (we don't handle BCE in the schema yet)
export function normalizeDate(wd) {
  if (!wd) return null;
  if (wd.startsWith('-')) return null;
  const stripped = wd.replace(/^\+/, '');
  const m = /^(\d{1,4})-(\d{2})-(\d{2})/.exec(stripped);
  if (!m) return null;
  const year = m[1].padStart(3, '0');
  return `${year}-${m[2]}-${m[3]}`;
}

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export function buildEvent({ summary, wd, nextId, today }) {
  const id = `event-${String(nextId).padStart(3, '0')}`;

  const startDate = normalizeDate(wd?.startTime);
  if (!startDate) {
    return { skipped: true, reason: 'no usable date from Wikidata' };
  }
  const endDate = normalizeDate(wd?.endTime);

  let lat = null;
  let lon = null;
  let locationName = null;
  if (wd?.coords) {
    lat = wd.coords.lat;
    lon = wd.coords.lon;
  } else if (summary.coordinates) {
    lat = summary.coordinates.lat;
    lon = summary.coordinates.lon;
  }
  locationName = wd?.locationName ?? summary.shortDescription ?? 'Unknown location';

  if (lat === null || lon === null) {
    return { skipped: true, reason: 'no usable coordinates' };
  }

  const category = categorize(wd?.types) ?? 'cultural';

  const event = {
    id,
    title: summary.title,
    description: condenseExtract(summary.extract),
    startDate,
    ...(endDate ? { endDate } : {}),
    location: {
      latitude: round(lat, 4),
      longitude: round(lon, 4),
      name: locationName,
    },
    category,
    connections: [],
    confidence: 'auto-imported',
    sources: [
      {
        citation: `Wikipedia: ${summary.title}`,
        url: wikipediaUrl(summary.title),
        ...(summary.qid ? { wikidata: summary.qid } : {}),
        retrieved: today,
        license: 'CC BY-SA 4.0',
      },
    ],
    ...(summary.thumbnail
      ? { media: [{ type: 'image', url: summary.thumbnail }] }
      : {}),
  };

  const filename = `${id}-${slugify(summary.title)}.json`;
  return { event, filename };
}

function round(n, places) {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}
