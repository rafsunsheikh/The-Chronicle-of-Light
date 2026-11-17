#!/usr/bin/env node
// Stage 1: split a converted book into heading-aware chunks an agent can read
// one at a time, each tagged with the page range it covers.
//
//   npm run extract:chunk -- content/private/<slug>/content.md [--max-chars 12000]
//
// Writes <book>/extract/chunks/NNN.md, <book>/extract/chunks.json (index) and
// <book>/extract/book.json (title, author, source) for the later stages.
import fs from 'node:fs';
import path from 'node:path';
import { loadBook } from './common.mjs';

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const opt = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : dflt;
};
if (!input) {
  console.error('Usage: npm run extract:chunk -- <content.md> [--max-chars 12000] [--min-chars 2000]');
  process.exit(1);
}
const MAX = opt('--max-chars', 12000);
const MIN = opt('--min-chars', 2000);

const book = loadBook(input);
const lines = book.body.split('\n');

// Walk the text once, tracking the current heading, page and chapter, and cut
// at headings. Oversized sections are cut again at paragraph breaks.
const sections = [];
let cur = { heading: '(opening)', lines: [], pageStart: null, pageEnd: null, chapter: null, annal: null };
let page = null;
let chapter = null;
// Annalistic histories (al-Tabari) head each year "The Events of the Year 249"
// with "(February 24, 863-February 12, 864)" beneath; a scan often splits that
// into two headings. Every chunk carries the year it sits under, so a passage
// that never restates its date can still be dated to the year.
let annal = null;
let awaitingYear = false;
const push = () => {
  if (cur.lines.join('\n').trim()) sections.push(cur);
};
for (const line of lines) {
  const pm = line.match(/^<!-- page (\d+) -->/);
  if (pm) page = Number(pm[1]);
  const cm = line.match(/^<!-- chapter (\d+)/);
  if (cm) chapter = Number(cm[1]);
  const hm = line.match(/^#{1,3}\s+(.+)$/);
  if (hm) {
    push();
    const heading = hm[1].trim();
    const ym = heading.match(/^the events of the year\s*(\d{1,4})?\s*$/i);
    if (ym) {
      annal = ym[1] ? { ah: Number(ym[1]), ce: null } : null;
      awaitingYear = !ym[1];
    } else if (awaitingYear && /^\d{1,4}$/.test(heading)) {
      annal = { ah: Number(heading), ce: null };
      awaitingYear = false;
    } else {
      awaitingYear = false;
    }
    cur = { heading: heading.slice(0, 80), lines: [line], pageStart: page, pageEnd: page, chapter, annal };
    continue;
  }
  // The year number often sits on its own line under the heading rather than in it.
  if (awaitingYear && /^\d{1,4}$/.test(line.trim())) {
    annal = { ah: Number(line.trim()), ce: null };
    awaitingYear = false;
    cur.annal = annal;
  } else if (annal && annal.ce === null && line.trim() && !/^<!--/.test(line)) {
    // "(FEBRUARY 13, 864-FEBRUARY I, 865)": OCR turns digits into I, l and O; read the years out anyway.
    const inside = line.match(/\(([^)]*)\)/)?.[1] ?? '';
    const years = (inside.replace(/[Il|]/g, '1').replace(/[Oo]/g, '0').match(/\b\d{3,4}\b/g) ?? []).map(Number).filter((y) => y >= 600 && y <= 1600);
    if (years.length) annal = { ...annal, ce: years[0], ceEnd: years[years.length - 1] };
    else annal = { ...annal, ce: Math.round(622 + annal.ah * 0.97), estimated: true };
    cur.annal = annal;
  }
  if (cur.pageStart === null && page !== null) cur.pageStart = page;
  if (page !== null) cur.pageEnd = page;
  cur.lines.push(line);
}
push();

const annalLabel = (a) => (a ? `AH ${a.ah} = ${a.ce}${a.ceEnd && a.ceEnd !== a.ce ? `/${a.ceEnd}` : ''} CE${a.estimated ? ' (estimated)' : ''}` : null);

// Merge short sections forward, split long ones at blank lines.
const chunks = [];
let acc = null;
const flush = () => {
  if (acc && acc.text.trim()) chunks.push(acc);
  acc = null;
};
for (const s of sections) {
  const text = s.lines.join('\n');
  if (text.length > MAX) {
    flush();
    let part = '';
    let partStartPage = s.pageStart;
    let lastPage = s.pageStart;
    let n = 0;
    for (const para of text.split(/\n{2,}/)) {
      const pm = para.match(/<!-- page (\d+) -->/g);
      if (pm) lastPage = Number(pm[pm.length - 1].match(/\d+/)[0]);
      if (part.length + para.length + 2 > MAX && part) {
        n += 1;
        chunks.push({ heading: `${s.heading} (part ${n})`, text: part, pageStart: partStartPage, pageEnd: lastPage, chapter: s.chapter, annal: s.annal });
        part = para;
        partStartPage = lastPage;
      } else {
        part = part ? `${part}\n\n${para}` : para;
      }
    }
    if (part.trim()) chunks.push({ heading: n ? `${s.heading} (part ${n + 1})` : s.heading, text: part, pageStart: partStartPage, pageEnd: lastPage, chapter: s.chapter, annal: s.annal });
    continue;
  }
  if (acc && acc.text.length + text.length + 2 <= MAX && acc.text.length < MIN) {
    acc.text += `\n\n${text}`;
    acc.pageEnd = s.pageEnd ?? acc.pageEnd;
    // A merged chunk keeps the first annal it started under; a year change inside it is in its text.
    acc.annal = acc.annal ?? s.annal;
  } else {
    flush();
    acc = { heading: s.heading, text, pageStart: s.pageStart, pageEnd: s.pageEnd, chapter: s.chapter, annal: s.annal };
  }
}
flush();

const outDir = path.join(book.extractDir, 'chunks');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(path.join(book.extractDir, 'candidates'), { recursive: true });

const index = chunks.map((c, i) => {
  const id = String(i + 1).padStart(3, '0');
  const pages = c.pageStart ? (c.pageEnd && c.pageEnd !== c.pageStart ? `${c.pageStart}-${c.pageEnd}` : String(c.pageStart)) : null;
  const header =
    `<!-- chunk ${id} of ${String(chunks.length).padStart(3, '0')} | book: ${book.title} | heading: ${c.heading}` +
    (pages ? ` | pages ${pages}` : '') +
    (c.chapter ? ` | chapter ${c.chapter}` : '') +
    (c.annal ? ` | year: ${annalLabel(c.annal)}` : '') +
    ' -->\n\n';
  fs.writeFileSync(path.join(outDir, `${id}.md`), header + c.text.trim() + '\n');
  return { index: i + 1, file: `extract/chunks/${id}.md`, heading: c.heading, pageStart: c.pageStart, pageEnd: c.pageEnd, chapter: c.chapter, annal: c.annal ?? null, chars: c.text.length };
});

fs.writeFileSync(path.join(book.extractDir, 'chunks.json'), JSON.stringify(index, null, 2) + '\n');
fs.writeFileSync(
  path.join(book.extractDir, 'book.json'),
  JSON.stringify({ slug: book.slug, title: book.title, author: book.author, sourceUrl: book.sourceUrl, converted: book.converted, chunks: index.length }, null, 2) + '\n',
);

const total = chunks.reduce((n, c) => n + c.text.length, 0);
console.log(`Wrote ${chunks.length} chunk(s) to ${path.relative(process.cwd(), outDir)} (${(total / 1000).toFixed(0)}k chars, max ${MAX})`);
console.log(`Candidates go in ${path.relative(process.cwd(), path.join(book.extractDir, 'candidates'))}/NNN.json`);
