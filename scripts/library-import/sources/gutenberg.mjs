// Project Gutenberg: the whole catalogue is one CSV (about 21 MB), fetched
// once and cached for a day. Matches every query word against title and
// subjects. Gutenberg texts are public domain in the United States; the
// reviewer confirms the author's death date for other countries.
import { fetchText, makeRecord, toLanguage, toYear } from '../lib.mjs';

const CATALOG = 'https://www.gutenberg.org/cache/epub/feeds/pg_catalog.csv';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export async function search({ query, max, type, categories, language = 'en' }) {
  const text = await fetchText(CATALOG, { ttlMs: 7 * 24 * 3600 * 1000 });
  const rows = parseCsv(text);
  const head = rows.shift();
  const col = Object.fromEntries(head.map((h, i) => [h, i]));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const r of rows) {
    if (r[col.Type] !== 'Text') continue;
    if (language && r[col.Language] !== language) continue;
    const hay = `${r[col.Title]} ${r[col.Subjects]}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) continue;
    const id = r[col['Text#']];
    const authors = (r[col.Authors] || '').split(';').map((a) => a.replace(/,\s*\d{4}.*$/, '').trim()).filter(Boolean);
    // The catalogue has no publication year; the author's dates are the only
    // hint, so year defaults to the first author's death year or 1900.
    const death = (r[col.Authors] || '').match(/\d{4}-(\d{4})/);
    const year = toYear(death?.[1]) ?? 1900;
    out.push(makeRecord({
      title: r[col.Title].split('\n')[0],
      creators: authors.map((a) => a.split(', ').reverse().join(' ')),
      edition: `Project Gutenberg eBook ${id}`,
      year,
      language: toLanguage(r[col.Language]),
      categories,
      type: type || 'book',
      // The year above is only a proxy; say so where the reviewer will see it.
      summary: `Year is the author's death year, not the publication year: set it during review. Subjects: ${(r[col.Subjects] || 'none listed').slice(0, 300)}`,
      url: `https://www.gutenberg.org/ebooks/${id}`,
      license: 'public-domain',
      sourceName: 'Project Gutenberg',
    }));
    if (out.length >= max) break;
  }
  return out;
}
