// Wikisource: public domain texts. The default mode walks the 1911
// Encyclopaedia Britannica by article-title prefix, which is the richest free
// reference set for the period. `--query` is the article prefix, e.g. "Rhazes".
import { fetchJson, makeRecord } from '../lib.mjs';

const API = 'https://en.wikisource.org/w/api.php';
const EB_PREFIX = '1911 Encyclopædia Britannica/';

export async function search({ query, max, type, categories }) {
  const prefix = query.startsWith(EB_PREFIX) ? query : EB_PREFIX + query;
  const url = `${API}?action=query&list=prefixsearch&pssearch=${encodeURIComponent(prefix)}&pslimit=${max}&format=json`;
  const data = await fetchJson(url);
  // prefixsearch is fuzzy ("Rhazes" also returns "Hayes"), so keep only
  // titles that really start with the prefix once accents and case are gone.
  const fold = (t) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['\u2018\u2019\u02bf\u02be]/g, '').toLowerCase();
  const want = fold(prefix);
  const hits = (data?.query?.prefixsearch ?? []).filter((h) => fold(h.title).startsWith(want));
  return hits.map((h) => {
    const article = h.title.slice(EB_PREFIX.length);
    const pageUrl = `https://en.wikisource.org/wiki/${encodeURIComponent(h.title).replace(/%2F/g, '/')}`;
    return makeRecord({
      title: `${article} (Encyclopaedia Britannica, 1911)`,
      creators: ['Encyclopaedia Britannica, eleventh edition'],
      year: 1911,
      language: 'en',
      categories,
      type: type || 'article',
      summary: null,
      url: pageUrl,
      license: 'public-domain',
      sourceName: 'Wikisource',
      sourceUrl: pageUrl,
    });
  });
}
