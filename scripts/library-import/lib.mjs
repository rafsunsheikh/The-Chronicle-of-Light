// Shared helpers for the library importer: polite cached fetch, id and
// language normalisation, licence inference and draft writing.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
export const libraryDir = path.join(repoRoot, 'src', 'data', 'library');
export const importedDir = path.join(libraryDir, 'imported');
const cacheDir = path.join(__dirname, '.cache');

export const USER_AGENT =
  process.env.IMPORTER_USER_AGENT ||
  'The-Chronicle-of-Light-Library-Importer/0.1 (https://github.com/rafsunsheikh/The-Chronicle-of-Light)';

export const today = () => new Date().toISOString().slice(0, 10);

/** GET with a one-day on-disk cache, so re-runs do not hit the APIs again. */
export async function fetchText(url, { ttlMs = 24 * 3600 * 1000, accept = '*/*' } = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const key = createHash('sha1').update(url).digest('hex');
  const file = path.join(cacheDir, key);
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < ttlMs) {
    return fs.readFileSync(file, 'utf8');
  }
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  return text;
}

export async function fetchJson(url, opts) {
  const text = await fetchText(url, { ...opts, accept: 'application/json' });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`not JSON from ${url}: ${text.slice(0, 120)}`);
  }
}

export function slugify(value) {
  return (
    String(value)
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .slice(0, 8)
      .join('-') || 'untitled'
  );
}

const LANG = {
  eng: 'en', english: 'en', en: 'en',
  ara: 'ar', arabic: 'ar', ar: 'ar',
  fre: 'fr', fra: 'fr', french: 'fr', fr: 'fr',
  ger: 'de', deu: 'de', german: 'de', de: 'de',
  per: 'fa', fas: 'fa', persian: 'fa', fa: 'fa',
  tur: 'tr', ota: 'ota', turkish: 'tr', tr: 'tr',
  lat: 'la', latin: 'la', la: 'la',
  spa: 'es', spanish: 'es', es: 'es',
  ita: 'it', italian: 'it', it: 'it',
  urd: 'ur', urdu: 'ur', ur: 'ur',
  heb: 'he', hebrew: 'he', he: 'he',
};
export function toLanguage(value) {
  const v = Array.isArray(value) ? value[0] : value;
  if (!v) return 'und';
  return LANG[String(v).toLowerCase().trim()] ?? (/^[a-z]{2,3}$/.test(String(v)) ? String(v).toLowerCase() : 'und');
}

/** Licence from a URL or label, else by age. Anything not provable is "unknown"
 *  and the reviewer decides. */
export function inferLicense({ licenseUrl, label, year }) {
  const s = `${licenseUrl ?? ''} ${label ?? ''}`.toLowerCase();
  if (s.includes('publicdomain/zero') || s.includes('cc0')) return 'cc0';
  if (s.includes('publicdomain') || s.includes('public domain')) return 'public-domain';
  const cc = s.match(/licenses\/(by(?:-nc)?(?:-sa)?)(?:-nd)?\//);
  if (cc) return cc[1] === 'by' ? 'cc-by' : `cc-${cc[1]}`;
  if (s.includes('creativecommons')) return 'unknown';
  if (year && year <= 1899) return 'public-domain';
  return 'unknown';
}

export function toYear(value) {
  const m = String(value ?? '').match(/\d{3,4}/);
  if (!m) return null;
  const y = parseInt(m[0], 10);
  return y >= 1 && y <= 2100 ? y : null;
}

/** Write one draft under src/data/library/imported/<source>/, skipping ids
 *  that already exist anywhere in the library. Returns the path or null. */
export function writeDraft(record, { source, existing, dryRun }) {
  const dir = path.join(importedDir, source);
  const file = path.join(dir, `${record.id}.json`);
  if (existing.has(record.id)) return { file, status: 'exists' };
  if (dryRun) return { file, status: 'dry-run' };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  return { file, status: 'written' };
}

export function existingIds() {
  const ids = new Set();
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (fs.statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.json')) {
        try { ids.add(JSON.parse(fs.readFileSync(full, 'utf8')).id); } catch { /* validator reports */ }
      }
    }
  };
  walk(libraryDir);
  return ids;
}

/** Build a schema-shaped draft from normalised fields. */
export function makeRecord(f) {
  const year = f.year;
  const record = {
    id: `lib-${String(year).padStart(4, '0')}-${slugify(f.title)}`,
    type: f.type,
    title: String(f.title).replace(/\s+/g, ' ').trim().slice(0, 200),
  };
  if (f.originalTitle) record.originalTitle = f.originalTitle.slice(0, 200);
  record.creators = (f.creators?.length ? f.creators : ['Unknown']).map((c) => String(c).trim()).filter(Boolean).slice(0, 6);
  if (f.edition) record.edition = f.edition;
  record.year = year;
  record.language = f.language || 'und';
  record.categories = f.categories;
  record.summary = (f.summary && f.summary.length >= 20 ? f.summary : 'Summary to be written during review.').replace(/\s+/g, ' ').trim().slice(0, 1500);
  record.url = f.url;
  record.license = f.license;
  record.hosted = false;
  record.contentPath = null;
  record.video = null;
  record.source = { name: f.sourceName, url: f.sourceUrl ?? f.url, retrieved: today() };
  record.relatedEvents = [];
  record.confidence = 'auto-imported';
  return record;
}
