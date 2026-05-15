// Wikipedia API client (MediaWiki + REST).
// All responses are cached on disk; re-runs are cheap and offline-friendly.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = path.join(__dirname, '.cache');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENT =
  process.env.IMPORTER_USER_AGENT ||
  'The-Chronicle-of-Light-Importer/0.1 (https://github.com/rafsunsheikh/The-Chronicle-of-Light)';

let lastRequestAt = 0;
const MIN_INTERVAL_MS = 800;

async function ratelimit() {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < MIN_INTERVAL_MS) await sleep(MIN_INTERVAL_MS - elapsed);
  lastRequestAt = Date.now();
}

function cachePath(key) {
  return path.join(CACHE_DIR, key);
}

function cacheRead(key) {
  const f = cachePath(key);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

function cacheWrite(key, data) {
  const f = cachePath(key);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

export async function politeFetch(url, cacheKey, { method = 'GET', headers = {}, body } = {}) {
  if (cacheKey) {
    const cached = cacheRead(cacheKey);
    if (cached) return cached;
  }
  await ratelimit();
  const res = await fetch(url, {
    method,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
    body,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  const data = await res.json();
  if (cacheKey) cacheWrite(cacheKey, data);
  return data;
}

const slugifyTitle = (title) => title.replace(/ /g, '_');

export async function fetchTimelineLinks(pageTitle) {
  const url =
    `https://en.wikipedia.org/w/api.php` +
    `?action=parse&page=${encodeURIComponent(pageTitle)}` +
    `&prop=links&format=json&formatversion=2`;
  const data = await politeFetch(url, `timeline/${slugifyTitle(pageTitle)}.json`);
  const links = data?.parse?.links ?? [];
  return links
    .filter((l) => l.ns === 0 && l.exists !== false)
    .map((l) => l.title);
}

export async function fetchSummary(title) {
  const slug = slugifyTitle(title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`;
  const data = await politeFetch(url, `summary/${slug}.json`);
  return {
    title: data.title,
    canonicalTitle: data.titles?.canonical ?? slug,
    extract: data.extract ?? '',
    thumbnail: data.thumbnail?.source ?? null,
    qid: data.wikibase_item ?? null,
    coordinates: data.coordinates
      ? { lat: data.coordinates.lat, lon: data.coordinates.lon }
      : null,
    shortDescription: data.description ?? null,
  };
}

export function wikipediaUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(slugifyTitle(title))}`;
}

// Resolve a batch of article titles to their Wikidata QIDs in one or a few
// MediaWiki query calls. Up to 50 titles per request.
// Returns Map<title, qid | null>. Titles whose Wikipedia article exists but
// has no Wikidata link → null. Redirect sources are mapped to the target's QID.
export async function batchResolveQids(titles) {
  const out = new Map();
  if (titles.length === 0) return out;

  const CHUNK_SIZE = 50;
  for (let i = 0; i < titles.length; i += CHUNK_SIZE) {
    const chunk = titles.slice(i, i + CHUNK_SIZE);
    const titlesParam = chunk.join('|');
    const url =
      `https://en.wikipedia.org/w/api.php` +
      `?action=query&prop=pageprops&ppprop=wikibase_item` +
      `&titles=${encodeURIComponent(titlesParam)}` +
      `&format=json&formatversion=2&redirects=1`;
    const cacheKey = `qids/${batchHash(titlesParam)}.json`;
    const data = await politeFetch(url, cacheKey);

    const pages = data?.query?.pages ?? [];
    const redirects = data?.query?.redirects ?? [];
    // redirect.from = original requested title, redirect.to = resolved title
    const redirectSourceOf = new Map();
    for (const r of redirects) {
      if (!redirectSourceOf.has(r.to)) redirectSourceOf.set(r.to, []);
      redirectSourceOf.get(r.to).push(r.from);
    }

    for (const page of pages) {
      const qid = page?.pageprops?.wikibase_item ?? null;
      out.set(page.title, qid);
      // Also map the original (pre-redirect) titles the user asked for.
      for (const src of redirectSourceOf.get(page.title) ?? []) {
        out.set(src, qid);
      }
    }
    for (const t of chunk) {
      if (!out.has(t)) out.set(t, null);
    }
  }
  return out;
}

function batchHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
