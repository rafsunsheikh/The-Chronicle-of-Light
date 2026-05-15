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
