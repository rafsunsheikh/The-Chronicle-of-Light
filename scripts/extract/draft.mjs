#!/usr/bin/env node
// Stage 3: turn the agent's candidate lists into draft event files that match
// src/data/event.schema.json, with sources, gazetteer locations and checked
// connections, plus a review report.
//
//   npm run extract:draft -- content/private/<slug>/content.md
//
// Reads  <book>/extract/book.json and <book>/extract/candidates/*.json
// Writes src/data/events/imported/<slug>/event-YYYY-slug.json (folder rewritten)
//        <book>/extract/report.md
import fs from 'node:fs';
import path from 'node:path';
import {
  CATEGORIES, importedDir, loadBook, loadExistingEvents, loadGazetteer, matchPlace, padDate, repoRoot, slugify,
} from './common.mjs';

const input = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!input) {
  console.error('Usage: npm run extract:draft -- <content.md>');
  process.exit(1);
}
const book = loadBook(input);
const candDir = path.join(book.extractDir, 'candidates');
const chunksIndex = JSON.parse(fs.readFileSync(path.join(book.extractDir, 'chunks.json'), 'utf8'));
const chunkByIndex = new Map(chunksIndex.map((c) => [c.index, c]));

// Nearby existing events at the same gazetteer place make a cheap, honest
// connection suggestion. Kept small on purpose; the reviewer decides.
const NEARBY_YEARS = 25;
const NEARBY_MAX = 2;

const CATEGORY_SYNONYMS = {
  battle: 'military', war: 'military', siege: 'military', campaign: 'military', revolt: 'military', military: 'military',
  political: 'political', succession: 'political', death: 'political', diplomacy: 'political', treaty: 'political',
  religious: 'religious', religion: 'religious',
  cultural: 'cultural', construction: 'cultural', culture: 'cultural',
  scientific: 'scientific', science: 'scientific',
};

// Clear this book's previous drafts first, or their ids would collide with
// the new ones and every rerun would gain a "-2" suffix.
const outDir = path.join(importedDir, book.slug);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const existing = loadExistingEvents({ includeImported: true });
// Heuristic connections only point at reviewed events: anything a person
// wrote or promoted with confidence other than auto-imported. Bulk-imported
// corpora (Tabari) share the same gazetteer names and would swamp the list.
const curated = [...existing.values()].filter((e) => !e._file.startsWith('imported') && e.confidence !== 'auto-imported');
const gaz = loadGazetteer();

const files = fs.existsSync(candDir) ? fs.readdirSync(candDir).filter((f) => f.endsWith('.json')).sort() : [];
if (files.length === 0) {
  console.error(`No candidate files in ${path.relative(repoRoot, candDir)}. Run the extractor agent first.`);
  process.exit(1);
}

const used = new Set(existing.keys());
const drafts = [];
const problems = [];

for (const f of files) {
  const chunkIdx = parseInt(f, 10);
  const chunk = chunkByIndex.get(chunkIdx);
  let list;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(candDir, f), 'utf8'));
    list = Array.isArray(raw) ? raw : raw?.events ?? [];
  } catch (e) {
    problems.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  list.forEach((c, i) => {
    const where = `${f}#${i + 1}`;
    const title = String(c.title ?? '').replace(/\s+/g, ' ').trim().replace(/\.$/, '').slice(0, 200);
    if (title.length < 3) return problems.push(`${where}: missing title`);
    const startDate = padDate(c.startDate);
    if (!startDate) return problems.push(`${where} "${title}": unusable startDate ${JSON.stringify(c.startDate)}`);
    let endDate = c.endDate ? padDate(c.endDate, { end: true }) : null;
    if (endDate && endDate < startDate) endDate = null;
    const parts = String(c.startDate).split('-').length;
    if ((c.datePrecision === 'month' && parts < 2) || (c.datePrecision === 'day' && parts < 3)) {
      problems.push(`${where} "${title}": datePrecision "${c.datePrecision}" but startDate ${JSON.stringify(c.startDate)} is coarser; check the date`);
    }

    const year = startDate.slice(0, 4);
    let id = `event-${year}-${slugify(title)}`;
    for (let n = 2; used.has(id); n++) id = `event-${year}-${slugify(title)}-${n}`;
    used.add(id);

    let description = String(c.description ?? '').replace(/\s+/g, ' ').trim();
    if (description.length < 10) description = String(c.evidence ?? title).replace(/\s+/g, ' ').trim();
    if (c.datePrecision && c.datePrecision !== 'day' && !/\b\d{3,4}\b/.test(description)) {
      description += ` Dated to ${c.datePrecision === 'year' || c.datePrecision === 'approximate' ? 'the year ' : ''}${year} by the source.`;
    }
    description = description.slice(0, 2000);

    const category = CATEGORY_SYNONYMS[String(c.category ?? '').toLowerCase()] ?? 'political';
    if (!CATEGORIES.includes(category)) problems.push(`${where}: unknown category ${c.category}`);

    // Location: gazetteer on the place the text names, then on the title.
    let location = matchPlace(c.placeName, gaz) ?? matchPlace(c.placeHint, gaz) ?? matchPlace(title, gaz);
    const locatedVia = location ? (matchPlace(c.placeName, gaz) ? 'placeName' : matchPlace(c.placeHint, gaz) ? 'placeHint' : 'title') : null;
    if (location) location = { latitude: location.latitude, longitude: location.longitude, name: location.name };

    // Connections: the agent's suggestions must exist; then nearby events at
    // the same place, which the report marks as heuristic.
    const agentConn = (c.relatedEventIds ?? []).filter((x) => typeof x === 'string' && existing.has(x) && x !== id);
    const heuristic = [];
    if (location) {
      const y = parseInt(year, 10);
      const near = curated
        .filter((e) => e.location?.name === location.name && Math.abs(parseInt(e.startDate, 10) - y) <= NEARBY_YEARS)
        .sort((a, b) => Math.abs(parseInt(a.startDate, 10) - y) - Math.abs(parseInt(b.startDate, 10) - y))
        .slice(0, NEARBY_MAX)
        .map((e) => e.id);
      heuristic.push(...near.filter((x) => !agentConn.includes(x)));
    }
    const connections = [...new Set([...agentConn, ...heuristic])];

    const heading = chunk?.heading ? `, "${chunk.heading.replace(/ \(part \d+\)$/, '')}"` : '';
    const citation = `${book.author ? `${book.author}, ` : ''}${book.title}${heading}`;
    const source = { citation };
    if (book.sourceUrl) source.url = book.sourceUrl;
    if (c.page) source.page = String(c.page);
    if (book.converted) source.retrieved = book.converted;

    const record = { id, title, description, startDate };
    if (endDate) record.endDate = endDate;
    if (location) record.location = location;
    record.category = category;
    record.connections = connections;
    record.sources = [source];
    record.confidence = 'auto-imported';

    fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(record, null, 2) + '\n');
    drafts.push({ record, chunk: chunkIdx, located: locatedVia, placeName: c.placeName ?? null, agentConn, heuristic, evidence: c.evidence ?? '', notes: c.notes ?? null, precision: c.datePrecision ?? null });
  });
}

// Review report
const unlocated = drafts.filter((d) => !d.record.location);
const lines = [];
lines.push(`# Extraction report: ${book.title}`, '');
lines.push(`Drafts: ${drafts.length} in \`src/data/events/imported/${book.slug}/\` from ${files.length} candidate file(s).`);
lines.push(`Located: ${drafts.length - unlocated.length}. Not located (need a place or a gazetteer entry): ${unlocated.length}.`);
lines.push(`Connections: ${drafts.filter((d) => d.agentConn.length).length} with agent-suggested, ${drafts.filter((d) => d.heuristic.length).length} with same-place heuristics.`);
if (problems.length) lines.push('', `## Skipped or flagged (${problems.length})`, '', ...problems.map((p) => `- ${p}`));
lines.push('', '## Drafts', '');
for (const d of drafts) {
  const r = d.record;
  lines.push(`### ${r.id}`);
  lines.push(`- ${r.startDate}${r.endDate ? ` to ${r.endDate}` : ''} (${d.precision ?? 'unknown'} precision) · ${r.category} · chunk ${d.chunk}${r.sources[0].page ? ` · page ${r.sources[0].page}` : ''}`);
  lines.push(`- Place: ${r.location ? `${r.location.name} (via ${d.located})` : `NOT LOCATED${d.placeName ? ` (text says "${d.placeName}")` : ''}`}`);
  if (r.connections.length) lines.push(`- Connections: ${r.connections.map((x) => (d.heuristic.includes(x) ? `${x} (heuristic)` : x)).join(', ')}`);
  if (d.notes) lines.push(`- Notes: ${d.notes}`);
  lines.push(`- Evidence: "${String(d.evidence).replace(/\s+/g, ' ').slice(0, 300)}"`, '');
}
lines.push('## Next', '', 'Review each draft, fix or delete, then promote keepers with', '', `    npm run extract:promote -- ${book.slug} --all`, '');
fs.writeFileSync(path.join(book.extractDir, 'report.md'), lines.join('\n'));

console.log(`Wrote ${drafts.length} draft(s) to ${path.relative(repoRoot, outDir)} (${drafts.length - unlocated.length} located, ${problems.length} skipped)`);
console.log(`Report: ${path.relative(repoRoot, path.join(book.extractDir, 'report.md'))}`);
