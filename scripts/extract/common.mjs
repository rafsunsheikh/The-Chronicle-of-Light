// Shared helpers for the extraction pipeline: front matter, repo paths,
// existing event ids, the gazetteer matcher (ported from
// books/the_history_of_al_tabari/enrich_events.py) and slug/date utilities.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '..', '..');
export const eventsDir = path.join(repoRoot, 'src', 'data', 'events');
export const importedDir = path.join(eventsDir, 'imported');
// The curated gazetteer built for the Tabari pipeline: 123 medieval places
// with aliases and coordinates. Shared here rather than copied.
export const gazetteerPath = path.join(repoRoot, 'books', 'the_history_of_al_tabari', 'gazetteer.json');

export const CATEGORIES = ['political', 'religious', 'cultural', 'scientific', 'military'];

/** Parse a `---` YAML front matter block written by scripts/convert. */
export function parseFrontMatter(markdown) {
  const m = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fields: {}, body: markdown };
  const fields = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith('"')) {
      try { v = JSON.parse(v); } catch { v = v.slice(1, -1); }
    } else if (/^\d+$/.test(v)) v = Number(v);
    fields[kv[1]] = v;
  }
  return { fields, body: markdown.slice(m[0].length) };
}

/** Resolve the book folder and read content.md + meta.json. */
export function loadBook(input) {
  let file = path.resolve(input);
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'content.md');
  if (!fs.existsSync(file)) throw new Error(`no such file: ${input}`);
  const dir = path.dirname(file);
  const markdown = fs.readFileSync(file, 'utf8');
  const { fields, body } = parseFrontMatter(markdown);
  let meta = {};
  const metaPath = path.join(dir, 'meta.json');
  if (fs.existsSync(metaPath)) {
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { meta = {}; }
  }
  const slug = path.basename(dir);
  return {
    dir,
    file,
    slug,
    body,
    title: fields.title || meta.title || slug,
    author: fields.author || meta.author || null,
    sourceUrl: meta.source?.url || (typeof fields.source === 'string' && /^https?:/.test(fields.source) ? fields.source : null),
    converted: fields.converted || meta.converted || null,
    extractDir: path.join(dir, 'extract'),
  };
}

export function walkJson(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) walkJson(full, acc);
    else if (entry.endsWith('.json')) acc.push(full);
  }
  return acc;
}

/** Every existing event, keyed by id, with its folder relative to events/. */
export function loadExistingEvents({ includeImported = true } = {}) {
  const out = new Map();
  for (const full of walkJson(eventsDir)) {
    const rel = path.relative(eventsDir, full);
    if (!includeImported && rel.startsWith('imported')) continue;
    try {
      const ev = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (ev && typeof ev.id === 'string') out.set(ev.id, { ...ev, _file: rel });
    } catch {
      // validate-events reports broken files; skip here.
    }
  }
  return out;
}

export function slugify(title) {
  let s = String(title).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  s = s.replace(/^(the|a|an)-/, '');
  const words = s.split('-').slice(0, 8);
  // A slug cut at eight words should not end on a dangling "of" or "al".
  const dangling = new Set(['of', 'al', 'and', 'the', 'in', 'at', 'to', 'a', 'an', 'for', 'on', 'from', 'by', 'with', 'his', 'its']);
  while (words.length > 2 && dangling.has(words[words.length - 1])) words.pop();
  return words.join('-') || 'event';
}

/** "634", "634-08", "0634-08-20" -> "0634-08-20" style. Returns null if unusable. */
export function padDate(value, { end = false } = {}) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  let m = s.match(/^(-?\d{1,4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  if (year < 1 || year > 2100) return null;
  const month = m[2] ? parseInt(m[2], 10) : end ? 12 : 1;
  const day = m[3] ? parseInt(m[3], 10) : end ? (m[2] ? daysIn(year, month) : 31) : 1;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

// ---- gazetteer -------------------------------------------------------------
const STOP = new Set(['al', 'the', 'of']);
export function normalizePlace(s) {
  let t = String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/[`'ʿʾ‘’]/g, '').replace(/[^a-z0-9]+/g, ' ');
  return t.split(/\s+/).filter((w) => w && !STOP.has(w)).join(' ');
}

export function loadGazetteer(file = gazetteerPath) {
  if (!fs.existsSync(file)) return [];
  const gaz = JSON.parse(fs.readFileSync(file, 'utf8'));
  const phrases = [];
  for (const e of gaz) {
    for (const f of new Set([e.name, ...(e.aliases ?? [])])) {
      const nf = normalizePlace(f);
      if (nf) phrases.push({ nf, rx: new RegExp(`\\b${nf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`), entry: e });
    }
  }
  // Longest phrases first so "dumat jandal" beats "jandal".
  phrases.sort((a, b) => b.nf.split(' ').length - a.nf.split(' ').length || b.nf.length - a.nf.length);
  return phrases;
}

/** Best gazetteer hit in a piece of text, or null. */
export function matchPlace(text, phrases) {
  if (!text) return null;
  const norm = normalizePlace(text);
  for (const { rx, entry } of phrases) {
    if (rx.test(norm)) {
      return { name: entry.modern || entry.name, latitude: entry.lat, longitude: entry.lon, gazetteer: entry.name };
    }
  }
  return null;
}
