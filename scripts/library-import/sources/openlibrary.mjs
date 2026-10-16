// Open Library: searches works that have a public scan on the Internet
// Archive, and links to that scan. Licence is public domain only when the
// first publication is before 1900; later scans are "unknown" for review.
import { fetchJson, inferLicense, makeRecord, toLanguage } from '../lib.mjs';

export async function search({ query, max, type, categories }) {
  const fields = 'key,title,author_name,first_publish_year,ia,language,public_scan_b,first_sentence,subject';
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&has_fulltext=true&public_scan_b=true&limit=${max}&fields=${fields}`;
  const data = await fetchJson(url);
  return (data.docs ?? [])
    .filter((d) => d.first_publish_year && d.title)
    .map((d) => {
      const ia = d.ia?.[0];
      const link = ia ? `https://archive.org/details/${ia}` : `https://openlibrary.org${d.key}`;
      return makeRecord({
        title: d.title,
        creators: d.author_name ?? [],
        year: d.first_publish_year,
        language: toLanguage(d.language?.[0]),
        categories,
        type: type || 'book',
        summary: Array.isArray(d.first_sentence) ? d.first_sentence[0] : d.first_sentence ?? null,
        url: link,
        license: inferLicense({ year: d.first_publish_year }),
        sourceName: ia ? 'Internet Archive (via Open Library)' : 'Open Library',
        sourceUrl: `https://openlibrary.org${d.key}`,
      });
    });
}
