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
let cur = { heading: '(opening)', lines: [], pageStart: null, pageEnd: null, chapter: null };
let page = null;
let chapter = null;
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
    cur = { heading: hm[1].trim().slice(0, 80), lines: [line], pageStart: page, pageEnd: page, chapter };
    continue;
  }
  if (cur.pageStart === null && page !== null) cur.pageStart = page;
  if (page !== null) cur.pageEnd = page;
  cur.lines.push(line);
}
push();

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
        chunks.push({ heading: `${s.heading} (part ${n})`, text: part, pageStart: partStartPage, pageEnd: lastPage, chapter: s.chapter });
        part = para;
        partStartPage = lastPage;
      } else {
        part = part ? `${part}\n\n${para}` : para;
      }
    }
    if (part.trim()) chunks.push({ heading: n ? `${s.heading} (part ${n + 1})` : s.heading, text: part, pageStart: partStartPage, pageEnd: lastPage, chapter: s.chapter });
    continue;
  }
  if (acc && acc.text.length + text.length + 2 <= MAX && acc.text.length < MIN) {
    acc.text += `\n\n${text}`;
    acc.pageEnd = s.pageEnd ?? acc.pageEnd;
  } else {
    flush();
    acc = { heading: s.heading, text, pageStart: s.pageStart, pageEnd: s.pageEnd, chapter: s.chapter };
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
    ' -->\n\n';
  fs.writeFileSync(path.join(outDir, `${id}.md`), header + c.text.trim() + '\n');
  return { index: i + 1, file: `extract/chunks/${id}.md`, heading: c.heading, pageStart: c.pageStart, pageEnd: c.pageEnd, chapter: c.chapter, chars: c.text.length };
});

fs.writeFileSync(path.join(book.extractDir, 'chunks.json'), JSON.stringify(index, null, 2) + '\n');
fs.writeFileSync(
  path.join(book.extractDir, 'book.json'),
  JSON.stringify({ slug: book.slug, title: book.title, author: book.author, sourceUrl: book.sourceUrl, converted: book.converted, chunks: index.length }, null, 2) + '\n',
);

const total = chunks.reduce((n, c) => n + c.text.length, 0);
console.log(`Wrote ${chunks.length} chunk(s) to ${path.relative(process.cwd(), outDir)} (${(total / 1000).toFixed(0)}k chars, max ${MAX})`);
console.log(`Candidates go in ${path.relative(process.cwd(), path.join(book.extractDir, 'candidates'))}/NNN.json`);
