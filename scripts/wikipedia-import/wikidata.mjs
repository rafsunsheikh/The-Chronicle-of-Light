// Wikidata SPARQL client.
// One batched query per run for the full QID set — much cheaper than per-item lookups.
import { politeFetch } from './wikipedia.mjs';

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

function buildQuery(qids) {
  const values = qids.map((q) => `wd:${q}`).join(' ');
  // We REQUIRE both a date (P585 point-in-time OR P580 start-time) and
  // coordinates (either P625 on the event itself, or on its P276 location).
  // Pre-filtering at the Wikidata level is the whole point of Path 2 — we
  // never fetch a Wikipedia summary for a QID that isn't a locatable event.
  return `
SELECT ?event ?eventLabel
       ?startTime ?endTime
       ?location ?locationLabel ?coords
       ?image
       (GROUP_CONCAT(DISTINCT ?typeLabel; separator="|") AS ?types)
WHERE {
  VALUES ?event { ${values} }

  { ?event wdt:P585 ?startTime . }
  UNION
  { ?event wdt:P580 ?startTime . }

  {
    ?event wdt:P276 ?location .
    ?location wdt:P625 ?coords .
  }
  UNION
  {
    ?event wdt:P625 ?coords .
  }

  OPTIONAL { ?event wdt:P582 ?endTime . }
  OPTIONAL { ?event wdt:P18 ?image . }
  OPTIONAL {
    ?event wdt:P31 ?type .
    ?type rdfs:label ?typeLabel .
    FILTER(LANG(?typeLabel) = "en")
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?event ?eventLabel ?startTime ?endTime ?location ?locationLabel ?coords ?image
`.trim();
}

const qidFromUri = (uri) => uri.split('/').pop();

function parsePointWkt(wkt) {
  // "Point(lon lat)"
  const m = /Point\(\s*(-?[0-9.]+)\s+(-?[0-9.]+)\s*\)/.exec(wkt ?? '');
  if (!m) return null;
  return { lon: parseFloat(m[1]), lat: parseFloat(m[2]) };
}

// Wikidata caps GET-request URLs around ~8 KB; for big VALUES lists we POST.
// We also chunk by 200 QIDs/query to keep individual responses small and the
// progress more visible.
const SPARQL_CHUNK = 200;

async function runSparql(qids) {
  const query = buildQuery(qids);
  const cacheKey = `wikidata/${hash(query)}.json`;
  return politeFetch(SPARQL_ENDPOINT, cacheKey, {
    method: 'POST',
    headers: {
      Accept: 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'query=' + encodeURIComponent(query) + '&format=json',
  });
}

export async function fetchWikidata(qids) {
  if (qids.length === 0) return new Map();
  const out = new Map();
  const uniqueQids = [...new Set(qids)];

  for (let i = 0; i < uniqueQids.length; i += SPARQL_CHUNK) {
    const chunk = uniqueQids.slice(i, i + SPARQL_CHUNK);
    const data = await runSparql(chunk);
    for (const b of data?.results?.bindings ?? []) {
      const qid = qidFromUri(b.event.value);
      const existing = out.get(qid) ?? { qid, types: [] };
      if (b.eventLabel) existing.label = b.eventLabel.value;
      if (b.startTime && !existing.startTime) existing.startTime = b.startTime.value;
      if (b.endTime && !existing.endTime) existing.endTime = b.endTime.value;
      if (b.locationLabel && !existing.locationName) existing.locationName = b.locationLabel.value;
      if (b.location && !existing.locationQid) existing.locationQid = qidFromUri(b.location.value);
      if (b.coords && !existing.coords) existing.coords = parsePointWkt(b.coords.value);
      if (b.image && !existing.image) existing.image = b.image.value;
      if (b.types) {
        existing.types = (b.types.value || '')
          .split('|')
          .map((t) => t.trim())
          .filter(Boolean);
      }
      out.set(qid, existing);
    }
  }
  return out;
}

function hash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
