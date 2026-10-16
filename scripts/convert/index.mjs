#!/usr/bin/env node
// Convert a book, report or article into Markdown before any AI reads it.
//
//   npm run convert -- <file-or-url> [--public] [--slug s] [--title t] [--author a] [--force]
//
// Output: one folder per source holding content.md (YAML front matter +
// Markdown with page/chapter markers) and meta.json (provenance and stats).
//   default   content/private/<slug>/   gitignored: materials you may not redistribute
//   --public  content/books/<slug>/     committed: public domain or openly licensed texts
//
// Formats: pdf, epub, docx, txt, md, html (a file or a URL). Scanned PDFs
// have no text layer and need OCR first; the script says so when it finds
// almost nothing.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { extractDocx, extractEpub, extractHtml, extractPdf, extractPlain } from './extractors.mjs';
import { countHeadings, frontMatter, slugify, wordCount } from './text.mjs';

const VERSION = '0.1.0';
const MAX_BYTES = 120 * 1024 * 1024;
const MIN_CHARS = 200;
const USER_AGENT =
  process.env.CONVERT_USER_AGENT ||
  `The-Chronicle-of-Light-Convert/${VERSION} (https://github.com/rafsunsheikh/The-Chronicle-of-Light)`;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function usage(msg) {
  if (msg) console.error(`Error: ${msg}\n`);
  console.error(
    'Usage: npm run convert -- <file-or-url> [--public] [--slug <slug>] [--title <title>] [--author <author>] [--force]',
  );
  process.exit(msg ? 1 : 0);
}

function parseArgs(argv) {
  const opts = { input: null, isPublic: false, slug: null, title: null, author: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--public') opts.isPublic = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--slug') opts.slug = argv[++i];
    else if (a === '--title') opts.title = argv[++i];
    else if (a === '--author') opts.author = argv[++i];
    else if (a === '--help' || a === '-h') usage();
    else if (a.startsWith('--')) usage(`unknown option ${a}`);
    else if (!opts.input) opts.input = a;
    else usage('only one input at a time');
  }
  if (!opts.input) usage('an input file or URL is required');
  return opts;
}

const isUrl = (s) => /^https?:\/\//i.test(s);

function formatFromName(name) {
  const n = name.toLowerCase().split('?')[0];
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.epub')) return 'epub';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.md') || n.endsWith('.markdown')) return 'md';
  if (n.endsWith('.txt') || n.endsWith('.text')) return 'txt';
  if (n.endsWith('.html') || n.endsWith('.htm')) return 'html';
  return null;
}

function formatFromContentType(ct) {
  const t = (ct || '').toLowerCase();
  if (t.includes('application/pdf')) return 'pdf';
  if (t.includes('application/epub')) return 'epub';
  if (t.includes('wordprocessingml')) return 'docx';
  if (t.includes('text/markdown')) return 'md';
  if (t.includes('text/html') || t.includes('application/xhtml')) return 'html';
  if (t.includes('text/plain')) return 'txt';
  return null;
}

async function load(input) {
  if (isUrl(input)) {
    const res = await fetch(input, { headers: { 'user-agent': USER_AGENT, accept: '*/*' } });
    if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status} for ${input}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const format =
      formatFromContentType(res.headers.get('content-type')) ?? formatFromName(new URL(input).pathname);
    return { buffer, format, name: path.basename(new URL(input).pathname) || 'page', source: { url: input } };
  }
  const file = path.resolve(input);
  if (!fs.existsSync(file)) throw new Error(`no such file: ${input}`);
  const buffer = fs.readFileSync(file);
  return {
    buffer,
    format: formatFromName(file),
    name: path.basename(file),
    // Relative when the file lives in the repo, absolute otherwise.
    source: { path: file.startsWith(repoRoot + path.sep) ? path.relative(repoRoot, file) : file },
  };
}

const titleFromName = (name) =>
  name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const log = (m) => console.error(m);

  const { buffer, format, name, source } = await load(opts.input);
  if (!format) throw new Error(`cannot tell the format of ${name}; supported: pdf, epub, docx, txt, md, html`);
  if (buffer.length > MAX_BYTES) {
    throw new Error(`${name} is ${(buffer.length / 1024 / 1024).toFixed(0)} MB, over the ${MAX_BYTES / 1024 / 1024} MB limit`);
  }
  log(`Reading ${name} (${format}, ${(buffer.length / 1024).toFixed(0)} KB)`);

  const progress = (stage) => log(`  ${stage}`);
  let result;
  if (format === 'pdf') result = await extractPdf(buffer, progress);
  else if (format === 'epub') result = await extractEpub(buffer, progress);
  else if (format === 'docx') result = await extractDocx(buffer);
  else if (format === 'html') result = extractHtml(buffer.toString('utf8'), source.url);
  else result = extractPlain(buffer.toString('utf8'), format);

  if (result.markdown.length < MIN_CHARS) {
    throw new Error(
      'barely any text came out of that file. If it is a scanned PDF, the pages are images and need OCR first.',
    );
  }

  const title = opts.title || result.title || titleFromName(name);
  const author = opts.author || result.author || null;
  const slug = slugify(opts.slug || title);
  const outDir = path.join(repoRoot, 'content', opts.isPublic ? 'books' : 'private', slug);
  if (fs.existsSync(outDir) && !opts.force) {
    throw new Error(`${path.relative(repoRoot, outDir)} already exists; pass --force to overwrite`);
  }

  const converted = new Date().toISOString().slice(0, 10);
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const stats = {
    chars: result.markdown.length,
    words: wordCount(result.markdown),
    headings: countHeadings(result.markdown),
    ...result.units,
  };
  const meta = {
    title,
    author,
    language: result.language ?? null,
    format,
    source: { ...source, name, bytes: buffer.length, sha256, siteName: result.siteName ?? undefined },
    converted,
    converter: `chronicle-convert/${VERSION}`,
    stats,
  };

  const front = frontMatter({
    title,
    author,
    language: meta.language,
    format,
    source: source.url ?? source.path,
    converted,
    pages: result.units.pages,
    chapters: result.units.chapters,
  });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'content.md'), front + result.markdown + '\n');
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');

  log(
    `Wrote ${path.relative(repoRoot, outDir)}/content.md: ${stats.words.toLocaleString()} words, ` +
      `${stats.headings} heading(s)` +
      (stats.pages ? `, ${stats.pages} pages` : '') +
      (stats.chapters ? `, ${stats.chapters} chapters` : ''),
  );
  if (!opts.isPublic) log('  (private output, gitignored; use --public for texts you may redistribute)');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
