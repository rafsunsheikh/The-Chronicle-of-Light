// Internet Archive advanced search over texts. Reads the item's licence URL
// when there is one; otherwise public domain only for pre-1900 items.
import { fetchJson, inferLicense, makeRecord, toLanguage, toYear } from '../lib.mjs';

export async function search({ query, max, type, categories }) {
  const q = `(${query}) AND mediatype:texts`;
  const fl = ['identifier', 'title', 'creator', 'year', 'date', 'language', 'licenseurl', 'description', 'publisher']
    .map((f) => `fl%5B%5D=${f}`).join('&');
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&${fl}&rows=${max}&sort%5B%5D=downloads+desc&output=json`;
  const data = await fetchJson(url);
  return (data.response?.docs ?? [])
    .map((d) => {
      const year = toYear(d.year ?? d.date);
      if (!year || !d.title) return null;
      const desc = Array.isArray(d.description) ? d.description[0] : d.description;
      return makeRecord({
        title: Array.isArray(d.title) ? d.title[0] : d.title,
        creators: Array.isArray(d.creator) ? d.creator : d.creator ? [d.creator] : [],
        year,
        language: toLanguage(d.language),
        categories,
        type: type || 'book',
        summary: desc ? String(desc).replace(/<[^>]+>/g, ' ') : null,
        url: `https://archive.org/details/${d.identifier}`,
        license: inferLicense({ licenseUrl: d.licenseurl, year }),
        sourceName: 'Internet Archive',
      });
    })
    .filter(Boolean);
}
