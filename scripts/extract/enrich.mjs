#!/usr/bin/env node
// Stage 3b: enrich drafted events from the internet, source by source.
//
//   npm run extract:enrich -- content/private/<slug>/content.md [--limit N] [--no-model] [--base-url URL]
//
// Reads  src/data/events/imported/<slug>/*.json (the drafts from draft.mjs)
// Writes the same files, with a Wikipedia source, a picture, coordinates and
//        a sentence or two of context when a matching article exists, and
//        <book>/extract/enrich-report.md saying what matched and what did not.
//
// Code decides whether an article is the same event (its Wikidata date must
// fall within two years of the draft's date, or its summary must name the
// year). The local model only turns the article's summary into one or two
// sentences of context, and a sentence that names a year the summary does
// not contain is thrown away and the summary's own words used instead.
import fs from 'node:fs';
import path from 'node:path';
import { loadBook, importedDir, repoRoot } from './common.mjs';
import { batchResolveQids, fetchSummary, politeFetch, wikipediaUrl } from '../wikipedia-import/wikipedia.mjs';
import { fetchWikidata } from '../wikipedia-import/wikidata.mjs';
import { condenseExtract, normalizeDate } from '../wikipedia-import/transform.mjs';

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('Usage: npm run extract:enrich -- <content.md> [--limit N] [--no-model] [--base-url URL]');
  process.exit(1);
}
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const limit = Number(opt('--limit', '0'));
const useModel = !argv.includes('--no-model');
const baseUrl = (process.env.LOCAL_MODEL_URL || opt('--base-url', 'http://localhost:8080')).replace(/\/+$/, '');
const model = opt('--model', process.env.LOCAL_MODEL || 'devstral');
const YEAR_WINDOW = 2;
const today = new Date().toISOString().slice(0, 10);

const book = loadBook(input);
const draftsDir = path.join(importedDir, book.slug);
// The merged candidates still carry the people and place the text named; the
// drafts do not, and those names are the best search terms the event has.
const detailsByTitle = new Map();
for (const dir of ['merged', 'candidates']) {
  const d = path.join(book.extractDir, dir);
  if (!fs.existsSync(d)) continue;
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.json'))) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      for (const c of Array.isArray(raw) ? raw : raw?.events ?? []) {
        const key = String(c.title ?? '').replace(/\s+/g, ' ').trim().replace(/\.$/, '').toLowerCase();
        if (key && !detailsByTitle.has(key)) detailsByTitle.set(key, { people: c.people ?? [], placeName: c.placeName ?? null });
      }
    } catch {
      // draft.mjs reports broken candidate files
    }
  }
  if (detailsByTitle.size) break;
}
const files = fs.existsSync(draftsDir) ? fs.readdirSync(draftsDir).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) {
  console.error(`No drafts in ${path.relative(repoRoot, draftsDir)}. Run extract:draft first.`);
  process.exit(1);
}

const STOP = new Set(['the', 'of', 'in', 'at', 'to', 'a', 'an', 'and', 'on', 'for', 'by', 'with', 'his', 'its', 'al', 'b', 'ibn', 'bin', 'abu', 'abi', 'against', 'from', 'battle', 'death', 'revolt', 'rebellion']);
// Name parts shared by thousands of people; on their own they identify nobody.
const COMMON_NAMES = new Set(['muhammad', 'ali', 'husayn', 'hasan', 'ahmad', 'abdallah', 'umar', 'ibrahim', 'yahya', 'isa', 'musa', 'jafar', 'ismail', 'sulayman', 'salih', 'khalid', 'abd', 'allah', 'rahman', 'malik', 'said', 'yusuf', 'harun', 'tahir', 'turki']);
// The translation's epithets against Wikipedia's Arabic ones: "Bugha the Elder" is "Bugha al-Kabir".
const EPITHETS = [[/\bthe elder\b/g, 'kabir'], [/\bthe younger\b/g, 'saghir'], [/\bthe turk\b/g, 'turki']];
const norm = (s) => EPITHETS.reduce((t, [rx, to]) => t.replace(rx, to), String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[`'ʿʾ‘’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim());
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w && !STOP.has(w)));
const overlap = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n += 1; return n; };
const yearOf = (d) => parseInt(String(d).slice(0, 4), 10);

async function searchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json&formatversion=2`;
  const data = await politeFetch(url, `search/${norm(query).replace(/ /g, '_').slice(0, 80)}.json`);
  return (data?.query?.search ?? []).map((s) => s.title);
}

// The network is not always there; one quiet retry before giving up on a step.
async function attempt(fn, what) {
  try {
    return await fn();
  } catch (first) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      return await fn();
    } catch (second) {
      throw new Error(`${what}: ${second.message}`);
    }
  }
}

const isPerson = (summary) => {
  const d = summary.shortDescription ?? '';
  return /\b(human|person|caliph|emir|vizier|general|governor|scholar|poet|jurist|historian|commander|prince|princess|queen|king|imam|rebel|leader|politician|officer|soldier|slave|eunuch)\b/i.test(d)
    || /\(?\b(?:born|died|c\.|d\.)\s*\d{3,4}/i.test(d) || /\b\d{3,4}\s*[–-]\s*\d{3,4}\b/.test(d);
};

/** Birth and death years of people articles, so a biography can be checked against the event's year. */
async function lifespans(ids) {
  const out = new Map();
  // Wikidata ids are Q followed by digits; anything else is not an id and never reaches the query or the cache file name.
  const qids = ids.filter((q) => /^Q\d{1,12}$/.test(String(q)));
  if (!qids.length) return out;
  const query = `SELECT ?p ?born ?died WHERE { VALUES ?p { ${qids.map((q) => `wd:${q}`).join(' ')} } OPTIONAL { ?p wdt:P569 ?born } OPTIONAL { ?p wdt:P570 ?died } }`;
  const data = await politeFetch('https://query.wikidata.org/sparql', `lifespan/${qids.join('_')}.json`, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'query=' + encodeURIComponent(query) + '&format=json',
  });
  for (const b of data?.results?.bindings ?? []) {
    const q = b.p.value.split('/').pop();
    const y = (v) => (v ? yearOf(normalizeDate(v.value) ?? '') : null);
    out.set(q, { born: y(b.born), died: y(b.died) });
  }
  return out;
}

/** The Wikipedia article for this event: the event itself when one exists (dated within two years),
 *  otherwise an article about one of its named people whose lifetime covers the year, marked as related. */
async function findArticle(event) {
  const year = yearOf(event.startDate);
  const details = detailsByTitle.get(event.title.toLowerCase()) ?? { people: [], placeName: null };
  // The event's own words first, then its people: the translation's spellings
  // ("Bugha the Elder") often differ from Wikipedia's ("Bugha al-Kabir"), and a
  // person's name finds the article the event's title cannot.
  const queries = [`${event.title} ${year}`, ...details.people.slice(0, 2).map((p) => `${p} Abbasid`)];
  const seen = new Set();
  const titles = [];
  for (const q of queries) {
    try {
      for (const t of await attempt(() => searchWikipedia(q), 'search')) if (!seen.has(t)) { seen.add(t); titles.push({ t, from: q === queries[0] ? 'title' : 'person' }); }
    } catch (e) {
      // one failed search does not end the lookup
    }
  }
  if (!titles.length) return { article: null, reason: 'no search results' };
  const peopleTokens = tokens(details.people.join(' '));
  // Rank by words shared with the title or with the people the text named, keep the best five.
  const ranked = titles
    .map(({ t, from }) => ({ t, from, score: overlap(tokens(t), tokens(event.title)) + overlap(tokens(t), peopleTokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  if (!ranked.length) return { article: null, reason: `search results share no word with the event: ${titles.slice(0, 4).map((x) => x.t).join('; ')}` };
  let qids = new Map();
  let wd = new Map();
  let lives = new Map();
  try {
    qids = await attempt(() => batchResolveQids(ranked.map((r) => r.t)), 'Wikidata ids');
    const ids = [...qids.values()].filter(Boolean);
    wd = await attempt(() => fetchWikidata(ids), 'Wikidata claims');
    lives = await attempt(() => lifespans(ids), 'Wikidata lifespans');
  } catch (e) {
    // Without Wikidata the date check falls back to the summary naming the year.
  }
  const rejected = [];
  let related = null;
  for (const { t } of ranked) {
    let summary;
    try {
      summary = await attempt(() => fetchSummary(t), 'summary');
    } catch {
      continue;
    }
    // A page about a name, a list or a disambiguation is never the event or its person.
    if (/\((name|disambiguation|surname|given name)\)$/i.test(t) || /^(list of|timeline of)/i.test(t) || /\b(disambiguation|given name|surname|name)\b/i.test(summary.shortDescription ?? '')) {
      rejected.push(`${t} (${summary.shortDescription || 'a list or a name page'})`);
      continue;
    }
    const qid = qids.get(t);
    const claims = qid ? wd.get(qid) : null;
    const wdYear = claims?.startTime ? yearOf(normalizeDate(claims.startTime) ?? '') : null;
    const dateClose = wdYear !== null && Math.abs(wdYear - year) <= YEAR_WINDOW;
    const yearNamed = new RegExp(`\\b${year}\\b`).test(summary.extract);
    if (isPerson(summary) || !claims) {
      // A biography is not the event, but the article of a person the text names, alive in that year, is useful context.
      const life = qid ? lives.get(qid) : null;
      const alive = life && (life.born === null || life.born <= year) && (life.died === null || life.died >= year - 1);
      // The article must be about one of the people named, not merely share a common name part
      // such as "Muhammad" or "Husayn": every distinctive word of that person's name must be in the title.
      const named = details.people.some((p) => {
        const words = [...tokens(p)].filter((w) => !COMMON_NAMES.has(w));
        const all = [...tokens(p)];
        return (words.length ? words : all).length > 0 && (words.length ? words : all).every((w) => tokens(t).has(w)) && (words.length >= 1 || all.length >= 2);
      });
      if (!related && (yearNamed || (named && alive))) {
        related = { summary, claims: null, title: t, related: true, why: `related article (${summary.shortDescription || 'no description'}): ${yearNamed ? `names ${year}` : `a person the text names, alive in ${year}`}` };
      } else {
        rejected.push(`${t} (${summary.shortDescription || 'not an event'}${yearNamed ? '' : `, does not name ${year}`}${named ? '' : ', not among the people named'})`);
      }
      continue;
    }
    if (dateClose || yearNamed) return { article: { summary, claims, title: t, related: false, why: dateClose ? `Wikidata dates it ${wdYear}` : `its summary names ${year}` }, reason: null };
    rejected.push(`${t} (${wdYear ? `Wikidata dates it ${wdYear}` : 'no date near ' + year})`);
  }
  if (related) return { article: related, reason: null };
  return { article: null, reason: `no article is this event: ${rejected.join('; ')}` };
}

async function contextSentences(event, extract) {
  const body = {
    model,
    temperature: 0,
    max_tokens: 220,
    messages: [
      { role: 'system', content: 'You write one or two short sentences of historical context for a timeline entry, using only the encyclopedia summary given. Add what the entry does not already say. No dates, names or facts that are not in the summary. Plain English.' },
      { role: 'user', content: `Timeline entry: ${event.title} (${event.startDate}). It says: ${event.description}\n\nEncyclopedia summary: ${extract}\n\nReply as JSON {"context": "one or two sentences"}.` },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'context', schema: { type: 'object', properties: { context: { type: 'string' } }, required: ['context'], additionalProperties: false } } },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const text = String(JSON.parse(data.choices?.[0]?.message?.content ?? '{}').context ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 20) throw new Error('empty answer');
    // Every year the model names must be in the summary it was given.
    for (const y of text.match(/\b\d{3,4}\b/g) ?? []) if (!extract.includes(y)) throw new Error(`names ${y}, which the summary does not`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const report = { matched: [], unmatched: [], modelFallback: 0 };
  const todo = limit > 0 ? files.slice(0, limit) : files;
  console.error(`${book.title}: enriching ${todo.length} draft(s) from Wikipedia and Wikidata${useModel ? ` with context written by ${model}` : ''}`);
  for (const [i, f] of todo.entries()) {
    const file = path.join(draftsDir, f);
    const event = JSON.parse(fs.readFileSync(file, 'utf8'));
    if ((event.sources ?? []).some((s) => /wikipedia\.org/.test(s.url ?? ''))) continue; // already enriched
    let found;
    try {
      found = await findArticle(event);
    } catch (e) {
      found = { article: null, reason: `lookup failed: ${e.message}` };
    }
    const { article, reason } = found;
    if (!article) {
      report.unmatched.push(`${event.id}: ${reason}`);
      console.error(`  [${i + 1}/${todo.length}] ${event.id}: no match (${reason})`);
      continue;
    }
    const { summary, claims } = article;
    const added = [];
    const label = article.related ? `Wikipedia (related): ${summary.title}` : `Wikipedia: ${summary.title}`;
    event.sources = [...(event.sources ?? []), { citation: label, url: wikipediaUrl(summary.canonicalTitle ?? summary.title), ...(summary.qid ? { wikidata: summary.qid } : {}), retrieved: today, license: 'CC BY-SA 4.0' }];
    added.push(article.related ? 'related source' : 'source');
    if (!event.media?.length && summary.thumbnail && !article.related) {
      event.media = [{ type: 'image', url: summary.thumbnail, caption: `${summary.title} (Wikipedia)` }];
      added.push('picture');
    }
    // Coordinates come only from an article about the event itself; a person's article has none that apply.
    if (!event.location && !article.related) {
      const coords = claims?.coords ?? summary.coordinates;
      if (coords) {
        event.location = { latitude: Math.round(coords.lat * 1e4) / 1e4, longitude: Math.round(coords.lon * 1e4) / 1e4, name: claims?.locationName ?? summary.title };
        added.push('location');
      }
    }
    let context = null;
    if (useModel) {
      try {
        context = await contextSentences(event, summary.extract);
      } catch (e) {
        report.modelFallback += 1;
        context = null;
      }
    }
    if (!context) context = condenseExtract(summary.extract, 300);
    if (context && !event.description.includes(context.slice(0, 40))) {
      event.description = `${event.description} ${context} (Wikipedia: ${summary.title})`.slice(0, 2000);
      added.push('context');
    }
    fs.writeFileSync(file, JSON.stringify(event, null, 2) + '\n');
    report.matched.push(`${event.id} -> "${summary.title}" (${article.why}): ${added.join(', ')}`);
    console.error(`  [${i + 1}/${todo.length}] ${event.id} -> ${summary.title}: ${added.join(', ')}`);
  }
  const lines = [`# Enrichment report: ${book.title}`, '', `Matched ${report.matched.length} of ${todo.length} draft(s) to a Wikipedia article; ${report.unmatched.length} without a match; ${report.modelFallback} context sentence(s) fell back to the summary's own words.`, ''];
  if (report.matched.length) lines.push('## Matched', '', ...report.matched.map((x) => `- ${x}`), '');
  if (report.unmatched.length) lines.push('## No match', '', ...report.unmatched.map((x) => `- ${x}`), '');
  fs.writeFileSync(path.join(book.extractDir, 'enrich-report.md'), lines.join('\n'));
  console.error(`Done: ${report.matched.length} enriched, ${report.unmatched.length} unmatched. Report: ${path.relative(repoRoot, path.join(book.extractDir, 'enrich-report.md'))}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
