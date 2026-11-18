#!/usr/bin/env node
// Stage 2b: sort, ground and merge the candidates of one book before drafting.
//
//   npm run extract:merge -- content/private/<slug>/content.md [--no-model] [--base-url http://localhost:8080]
//
// Reads  <book>/extract/candidates/*.json, chunks.json and the chunk texts
// Writes <book>/extract/merged/NNN.json   cleaned candidates, same shape, per chunk
//        <book>/extract/timeline.md       every kept event in date order
//        <book>/extract/merge-report.md   what was fixed, merged and dropped, and why
//
// The rules live in code. The model (the same local server as local.mjs) is
// asked one yes-or-no question per ambiguous pair, with both records in front
// of it, and any unusable answer falls back to keeping both records.
import fs from 'node:fs';
import path from 'node:path';
import { loadBook, loadExistingEvents, padDate, repoRoot } from './common.mjs';

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('Usage: npm run extract:merge -- <content.md> [--no-model] [--base-url URL] [--model NAME]');
  process.exit(1);
}
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const useModel = !argv.includes('--no-model');
const baseUrl = (process.env.LOCAL_MODEL_URL || opt('--base-url', 'http://localhost:8080')).replace(/\/+$/, '');
const model = opt('--model', process.env.LOCAL_MODEL || 'devstral');

const book = loadBook(input);
const chunksIndex = JSON.parse(fs.readFileSync(path.join(book.extractDir, 'chunks.json'), 'utf8'));
const chunkByIndex = new Map(chunksIndex.map((c) => [c.index, c]));
const candDir = path.join(book.extractDir, 'candidates');
const outDir = path.join(book.extractDir, 'merged');

// ---- text helpers ------------------------------------------------------------
const STOP = new Set(['the', 'of', 'in', 'at', 'to', 'a', 'an', 'and', 'on', 'for', 'by', 'with', 'his', 'its', 'al', 'b', 'ibn', 'bin', 'against', 'from', 'over', 'into', 'as', 'is', 'was']);
const norm = (s) => String(s ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[`'ʿʾ‘’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(' ').filter((w) => w && !STOP.has(w)));
const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared += 1;
  return shared / (a.size + b.size - shared);
};
const PRECISION_RANK = { day: 3, month: 2, year: 1, approximate: 0 };
const yearOf = (d) => parseInt(String(d).slice(0, 4), 10);

// ---- load --------------------------------------------------------------------
const files = fs.existsSync(candDir) ? fs.readdirSync(candDir).filter((f) => f.endsWith('.json')).sort() : [];
if (!files.length) {
  console.error(`No candidate files in ${path.relative(repoRoot, candDir)}. Run extract:local or the agent first.`);
  process.exit(1);
}
const chunkText = new Map();
const textOf = (idx) => {
  if (!chunkText.has(idx)) {
    const c = chunkByIndex.get(idx);
    chunkText.set(idx, c ? norm(fs.readFileSync(path.join(book.dir, c.file), 'utf8')) : '');
  }
  return chunkText.get(idx);
};

const report = { unusable: [], grounded: 0, fromAnnal: [], unquoted: [], mergedByRule: [], mergedByModel: [], keptByModel: [], modelErrors: 0, existing: [] };
let records = [];
for (const f of files) {
  const chunkIdx = parseInt(f, 10);
  let list;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(candDir, f), 'utf8'));
    list = Array.isArray(raw) ? raw : raw?.events ?? [];
  } catch (e) {
    report.unusable.push(`${f}: invalid JSON (${e.message})`);
    continue;
  }
  list.forEach((c, i) => {
    const where = `${f}#${i + 1}`;
    const title = String(c.title ?? '').replace(/\s+/g, ' ').trim();
    if (title.length < 3 || !padDate(c.startDate)) {
      report.unusable.push(`${where}: ${title ? `unusable startDate ${JSON.stringify(c.startDate)}` : 'missing title'}`);
      return;
    }
    records.push({ ...c, title, _chunk: chunkIdx, _where: where, notes: c.notes ?? null });
  });
}

// ---- 1. ground every date in the text it came from ---------------------------
for (const r of records) {
  const text = textOf(r._chunk);
  const basis = norm(r.dateBasis);
  const year = yearOf(r.startDate);
  const quoted = basis.length >= 4 && text.includes(basis);
  const yearInText = new RegExp(`\\b${year}\\b`).test(text);
  if (quoted || yearInText) {
    report.grounded += 1;
    continue;
  }
  const annal = chunkByIndex.get(r._chunk)?.annal;
  if (annal?.ce && Math.abs(year - annal.ce) > 1) {
    const was = r.startDate;
    r.startDate = String(annal.ce).padStart(4, '0');
    r.endDate = null;
    r.datePrecision = 'year';
    r.dateBasis = `annal year ${annal.ah}`;
    r.notes = [r.notes, `date set to the annal year AH ${annal.ah} (${annal.ce} CE); the extractor wrote ${was} with no words from the text to support it`].filter(Boolean).join('. ');
    report.fromAnnal.push(`${r._where} "${r.title}": ${was} -> ${r.startDate}`);
  } else if (annal?.ce) {
    report.grounded += 1; // within a year of the annal: consistent with the text even if not quoted
  } else {
    r.notes = [r.notes, 'date not quoted from the text; check it'].filter(Boolean).join('. ');
    report.unquoted.push(`${r._where} "${r.title}": ${r.startDate}`);
  }
}

// ---- 2. duplicates inside the book -------------------------------------------
function similarity(a, b) {
  const titleScore = jaccard(tokens(a.title), tokens(b.title));
  const pa = new Set((a.people ?? []).map(norm));
  const pb = new Set((b.people ?? []).map(norm));
  let people = 0;
  for (const p of pa) if (p && pb.has(p)) people += 1;
  const samePlace = !!(a.placeName && b.placeName && norm(a.placeName) === norm(b.placeName));
  const sameYear = yearOf(a.startDate) === yearOf(b.startDate);
  const near = Math.abs(yearOf(a.startDate) - yearOf(b.startDate)) <= 1;
  if (!near) return 'different';
  if (titleScore >= 0.5 || (people >= 2 && sameYear && samePlace)) return 'duplicate';
  if (titleScore >= 0.25 || (people >= 1 && sameYear && samePlace)) return 'ambiguous';
  return 'different';
}

function mergeInto(keep, other) {
  const rank = (r) => PRECISION_RANK[r.datePrecision] ?? 0;
  const [a, b] = rank(other) > rank(keep) || (rank(other) === rank(keep) && String(other.evidence).length > String(keep.evidence).length) ? [other, keep] : [keep, other];
  a.people = [...new Set([...(a.people ?? []), ...(b.people ?? [])])];
  a.placeName = a.placeName ?? b.placeName;
  a.placeHint = a.placeHint ?? b.placeHint;
  a.notes = [a.notes, `also reported in chunk ${String(b._chunk).padStart(3, '0')}${b.page ? ` page ${b.page}` : ''} as "${b.title}"`].filter(Boolean).join('. ');
  return a;
}

async function askModel(a, b) {
  const show = (r) => JSON.stringify({ title: r.title, date: r.startDate, place: r.placeName, people: r.people, evidence: String(r.evidence).slice(0, 300) });
  const body = {
    model,
    temperature: 0,
    max_tokens: 200,
    messages: [
      { role: 'system', content: 'You compare two records extracted from one history book. Answer only from the records shown. Two records are the same event when they describe one occurrence (the same battle, death, appointment or journey), not merely related ones.' },
      { role: 'user', content: `Record A: ${show(a)}\nRecord B: ${show(b)}\nAre A and B the same event? Reply as JSON {"duplicate": true or false, "reason": "one sentence"}.` },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'verdict', schema: { type: 'object', properties: { duplicate: { type: 'boolean' }, reason: { type: 'string' } }, required: ['duplicate', 'reason'], additionalProperties: false } } },
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5 * 60 * 1000);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const verdict = JSON.parse(data.choices?.[0]?.message?.content ?? '{}');
    if (typeof verdict.duplicate !== 'boolean') throw new Error('no verdict');
    return verdict;
  } finally {
    clearTimeout(timer);
  }
}

async function dedupe() {
  records.sort((a, b) => String(padDate(a.startDate)).localeCompare(String(padDate(b.startDate))) || a._chunk - b._chunk);
  const kept = [];
  for (const r of records) {
    let merged = false;
    for (let k = kept.length - 1; k >= 0; k--) {
      const other = kept[k];
      if (Math.abs(yearOf(other.startDate) - yearOf(r.startDate)) > 1) break;
      const verdict = similarity(other, r);
      if (verdict === 'duplicate') {
        kept[k] = mergeInto(other, r);
        report.mergedByRule.push(`"${r.title}" (${r._where}) into "${kept[k].title}" (${kept[k]._where})`);
        merged = true;
        break;
      }
      if (verdict === 'ambiguous' && useModel) {
        try {
          const v = await askModel(other, r);
          if (v.duplicate) {
            kept[k] = mergeInto(other, r);
            report.mergedByModel.push(`"${r.title}" (${r._where}) into "${kept[k].title}" (${kept[k]._where}): ${v.reason}`);
            merged = true;
            break;
          }
          report.keptByModel.push(`"${r.title}" (${r._where}) vs "${other.title}" (${other._where}): ${v.reason}`);
        } catch (e) {
          report.modelErrors += 1; // the code rule stands: both records stay
        }
      }
    }
    if (!merged) kept.push(r);
  }
  return kept;
}

// ---- 3. already on the timeline? ---------------------------------------------
function dropExisting(list) {
  const existing = [...loadExistingEvents({ includeImported: true }).values()].filter((e) => !e._file.startsWith(`imported${path.sep}${book.slug}`));
  const byYear = new Map();
  for (const e of existing) {
    const y = yearOf(e.startDate);
    for (const yy of [y - 1, y, y + 1]) byYear.set(yy, [...(byYear.get(yy) ?? []), e]);
  }
  return list.filter((r) => {
    const hit = (byYear.get(yearOf(r.startDate)) ?? []).find((e) => jaccard(tokens(e.title), tokens(r.title)) >= 0.5);
    if (hit) report.existing.push(`"${r.title}" (${r._where}) is already ${hit.id}`);
    return !hit;
  });
}

async function main() {
  if (useModel) {
    const health = await fetch(`${baseUrl}/health`).then((r) => r.json()).catch(() => ({}));
    if (health.status !== 'ok') console.error(`Model server at ${baseUrl} not reachable; ambiguous pairs will both be kept (same as --no-model).`);
  }
  const before = records.length;
  let kept = await dedupe();
  kept = dropExisting(kept);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const byChunk = new Map();
  for (const r of kept) byChunk.set(r._chunk, [...(byChunk.get(r._chunk) ?? []), r]);
  for (const [idx, list] of byChunk) {
    const clean = list.map(({ _chunk, _where, ...rest }) => rest);
    fs.writeFileSync(path.join(outDir, `${String(idx).padStart(3, '0')}.json`), JSON.stringify(clean, null, 2) + '\n');
  }

  const tl = [`# Timeline of candidates: ${book.title}`, '', `${kept.length} events in date order (from ${before} candidates).`, ''];
  for (const r of kept) tl.push(`- ${padDate(r.startDate)} (${r.datePrecision}) ${r.title}${r.placeName ? `, ${r.placeName}` : ''} [chunk ${String(r._chunk).padStart(3, '0')}${r.page ? `, p. ${r.page}` : ''}]`);
  fs.writeFileSync(path.join(book.extractDir, 'timeline.md'), tl.join('\n') + '\n');

  const lines = [`# Merge report: ${book.title}`, ''];
  lines.push(`Candidates: ${before + report.unusable.length}. Unusable: ${report.unusable.length}. Kept after merging: ${kept.length}.`);
  lines.push(`Dates: ${report.grounded} supported by the text, ${report.fromAnnal.length} set to the annal year, ${report.unquoted.length} not quoted (flagged).`);
  lines.push(`Merged: ${report.mergedByRule.length} by rule, ${report.mergedByModel.length} by the model; ${report.keptByModel.length} ambiguous pairs kept apart by the model; ${report.modelErrors} model errors (pairs kept apart).`);
  lines.push(`Dropped as already on the timeline: ${report.existing.length}.`, '');
  const section = (title, items) => { if (items.length) lines.push(`## ${title} (${items.length})`, '', ...items.map((x) => `- ${x}`), ''); };
  section('Unusable', report.unusable);
  section('Dates set to the annal year', report.fromAnnal);
  section('Dates not quoted from the text', report.unquoted);
  section('Merged by rule', report.mergedByRule);
  section('Merged by the model', report.mergedByModel);
  section('Kept apart by the model', report.keptByModel);
  section('Already on the timeline', report.existing);
  lines.push('## Next', '', `    npm run extract:draft -- ${path.relative(repoRoot, book.file)} --from merged`, '');
  fs.writeFileSync(path.join(book.extractDir, 'merge-report.md'), lines.join('\n'));

  console.log(`Kept ${kept.length} of ${before} candidates (${report.mergedByRule.length + report.mergedByModel.length} merged, ${report.existing.length} already on the timeline, ${report.fromAnnal.length} dates set from the annal year)`);
  console.log(`Merged candidates: ${path.relative(repoRoot, outDir)}; timeline: ${path.relative(repoRoot, path.join(book.extractDir, 'timeline.md'))}; report: ${path.relative(repoRoot, path.join(book.extractDir, 'merge-report.md'))}`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
