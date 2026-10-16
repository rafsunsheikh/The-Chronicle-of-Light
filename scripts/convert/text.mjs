// Text clean-up shared by every extractor. Ported from Prometheus
// (apps/web/src/lib/extract.ts `tidy`) and its runner's heading detector
// (apps/runner/src/ask.ts `asHeading`), with two additions: Project Gutenberg
// boilerplate stripping and promotion of plain-text headings to Markdown.

/** Strip the debris that survives every extractor: page numbers on their own
 *  line, repeated running headers, form feeds, and runaway blank lines. */
export function tidy(raw) {
  let text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\f/g, '\n\n')
    .replace(/[­​‌‍﻿]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');

  // Rejoin words hyphenated across a line break.
  text = text.replace(/(\w)-\n(\w)/g, '$1$2');

  const lines = text.split('\n');

  // A short line that repeats on many pages is a running header or footer.
  const counts = new Map();
  for (const line of lines) {
    const key = line.trim();
    if (key.length > 3 && key.length < 70) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const boilerplate = new Set(
    [...counts.entries()].filter(([key, n]) => n >= 8 && !key.startsWith('<!--')).map(([key]) => key),
  );

  const kept = lines.filter((line) => {
    const t = line.trim();
    if (/^\d{1,4}$/.test(t)) return false; // bare page number
    if (/^(page\s+)?\d{1,4}\s*(of\s+\d{1,4})?$/i.test(t)) return false;
    if (boilerplate.has(t)) return false;
    return true;
  });

  return kept
    .join('\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Project Gutenberg texts carry a licence header and footer around the work.
 *  Keep only what sits between the START and END markers. */
export function stripGutenberg(text) {
  // Markdown produced from HTML escapes the asterisks (\*\*\*), so allow both.
  const start = /^(?:\\?\*){3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*(?:\\?\*){3}\s*$/im;
  const end = /^(?:\\?\*){3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*(?:\\?\*){3}\s*$/im;
  const s = text.search(start);
  if (s < 0) return { text, stripped: false };
  const afterStart = text.slice(s).replace(start, '');
  const e = afterStart.search(end);
  return { text: e < 0 ? afterStart : afterStart.slice(0, e), stripped: true };
}

/** Title, author and language from the lines above a Gutenberg START marker. */
export function parseGutenbergHeader(text) {
  const head = text.slice(0, 6000);
  const field = (name) => {
    const m = head.match(new RegExp(`^\\**${name}\\**:\\**\\s*(.+?)\\s*$`, 'im'));
    return m ? m[1].replace(/\\([*_])/g, '$1').trim() : null;
  };
  return { title: field('Title'), author: field('Author'), language: field('Language') };
}

const MD_HEADING = /^#{1,6}\s+(.{2,80})$/;

/**
 * Heading shapes seen outside Markdown. Numbered body paragraphs are the trap:
 * "26. Now the general who wins a battle…" opens a sentence, not a section.
 * So a plain-text heading must also sit alone: blank line before and after.
 */
const PLAIN_HEADINGS = [
  /^((?:chapter|book|part|section|canto|act|volume)\s+(?:[ivxlcdm]+|\d{1,3}|[a-z]+)\b[.:—-]?\s*.{0,60})$/i,
  /^((?:[IVXLCDM]{1,7})[.)]\s+.{3,60})$/,
  /^([A-Z][A-Z0-9 .,'’-]{5,55})$/,
];

const blank = (line) => line === undefined || line.trim() === '';

/** Returns the heading text if line i reads as a heading, else null. */
export function asHeading(lines, i) {
  const t = (lines[i] ?? '').trim();
  if (!t || t.length > 80) return null;

  const md = t.match(MD_HEADING);
  if (md) return (md[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);

  if (!blank(lines[i - 1]) || !blank(lines[i + 1])) return null;
  if (/[,;:]$/.test(t)) return null;
  if (t.startsWith('<!--')) return null;

  // A bare numeral ("XVIII.", "IV") numbers a stanza or a verse, not a section.
  if (/^[IVXLCDM]+[.)]?$/.test(t)) return null;

  for (const re of PLAIN_HEADINGS) {
    const m = t.match(re);
    if (m) return (m[1] ?? t).replace(/\s+/g, ' ').trim().slice(0, 80);
  }
  return null;
}

/** Turn plain-text headings ("CHAPTER III", "IV. TACTICAL DISPOSITIONS", a
 *  short capitalised line on its own) into `##` Markdown headings so later
 *  stages can chunk at them and cite them. Existing `#` headings are kept. */
export function promoteHeadings(text) {
  const lines = text.split('\n');
  let promoted = 0;
  const out = lines.map((line, i) => {
    if (MD_HEADING.test(line.trim())) return line;
    const h = asHeading(lines, i);
    if (!h) return line;
    promoted += 1;
    return `## ${h}`;
  });
  return { text: out.join('\n'), promoted };
}

export function countHeadings(text) {
  return (text.match(/^#{1,6}\s+\S/gm) ?? []).length;
}

export function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled';
}

const yamlString = (v) => JSON.stringify(String(v));

/** Minimal YAML front matter. Values are JSON-quoted strings, which YAML accepts. */
export function frontMatter(fields) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${yamlString(v)}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

export const wordCount = (text) => (text.match(/\S+/g) ?? []).length;
