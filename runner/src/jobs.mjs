// What a job does, given a working directory. Both kinds start by converting
// the source to Markdown with scripts/convert. Summarise maps and reduces the
// text through Claude (Prometheus's design) into content/summaries/<slug>/.
// Extract runs scripts/extract's chunk stage, sends each chunk through Claude
// with the extraction prompts, then runs the draft and promote stages so the
// drafts land under src/data/events/<slug>/ for review in the pull request.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { config, repoRoot } from './config.mjs';
import { runClaude } from './claude.mjs';

const node = (dir, args) => execFileSync('node', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const prompt = (name) => readFileSync(join(config.promptsDir, `${name}.md`), 'utf8');
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');

export const slugify = (t) =>
  String(t)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .slice(0, 8)
    .join('-') || 'untitled';

/** Split at headings, then paragraphs, keeping chunks under `limit` chars. */
export function chunkText(markdown, limit = config.chunkChars) {
  const text = markdown.trim();
  if (text.length <= limit) return [text];
  const blocks = text.split(/\n(?=#{1,3} )/g).flatMap((b) => (b.length <= limit ? [b] : b.split(/\n{2,}/g)));
  const chunks = [];
  let cur = '';
  for (const b of blocks) {
    if (b.length > limit) {
      if (cur) {
        chunks.push(cur);
        cur = '';
      }
      for (let i = 0; i < b.length; i += limit) chunks.push(b.slice(i, i + limit));
      continue;
    }
    if (cur.length + b.length + 2 > limit) {
      chunks.push(cur);
      cur = b;
    } else cur = cur ? `${cur}\n\n${b}` : b;
  }
  if (cur.trim()) chunks.push(cur);
  return chunks.filter((c) => c.trim());
}

const stripFrontMatter = (md) => md.replace(/^---\n[\s\S]*?\n---\n?/, '');

/** Get the source into the working directory as Markdown. Returns the content.md path. */
export function convert(dir, input, onProgress) {
  const slug = input.slug || slugify(input.title);
  const destDir = join(dir, input.public ? 'content/books' : 'content/private', slug);
  if (!/^https?:\/\//i.test(input.source)) {
    // A path means the text was already converted on this machine (private
    // material stays out of git), so copy it in as-is.
    const src = join(repoRoot, input.source);
    if (!existsSync(src)) throw new Error(`source not found on the runner machine: ${input.source}`);
    if (src !== join(destDir, 'content.md')) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(src, join(destDir, 'content.md'));
      const meta = join(dirname(src), 'meta.json');
      if (existsSync(meta)) copyFileSync(meta, join(destDir, 'meta.json'));
    }
    return { slug, contentPath: join(destDir, 'content.md') };
  }
  onProgress('converting the source to Markdown');
  const args = ['scripts/convert/index.mjs', input.source, '--slug', slug, '--force'];
  if (input.title) args.push('--title', input.title);
  if (input.author) args.push('--author', input.author);
  if (input.public) args.push('--public');
  node(dir, args);
  return { slug, contentPath: join(destDir, 'content.md') };
}

export async function summarize(dir, input, onProgress) {
  const { slug, contentPath } = convert(dir, input, onProgress);
  const body = stripFrontMatter(readFileSync(contentPath, 'utf8'));
  const system = prompt('system');
  const vars = {
    TITLE: input.title,
    AUTHOR_LINE: input.author ? `Author: ${input.author}` : '',
    AUTHOR_SUFFIX: input.author ? ` of ${input.title} by ${input.author}` : '',
  };
  const chunks = chunkText(body);
  const started = Date.now();
  let cost = 0;
  let inTok = 0;
  let outTok = 0;
  let model = config.model;
  let markdown;

  const tally = (r) => {
    cost += r.costUsd;
    inTok += r.inputTokens;
    outTok += r.outputTokens;
    model = r.model;
  };

  if (chunks.length === 1) {
    await onProgress('reading the whole text in one pass', 0, 1);
    const r = await runClaude(fill(prompt('single'), { ...vars, CONTENT: chunks[0] }), system);
    tally(r);
    markdown = r.text;
  } else {
    // Sequential on purpose: parallel headless sessions contend for the same
    // subscription rate limits and fail noisily.
    const total = chunks.length + 1;
    const parts = [];
    for (const [i, c] of chunks.entries()) {
      await onProgress(`summarising section ${i + 1} of ${chunks.length}`, i, total);
      const r = await runClaude(fill(prompt('map'), { ...vars, INDEX: String(i + 1), TOTAL: String(chunks.length), CONTENT: c }), system);
      tally(r);
      parts.push(r.text);
    }
    await onProgress('synthesising the full summary', chunks.length, total);
    const r = await runClaude(fill(prompt('reduce'), { ...vars, CONTENT: parts.join('\n\n---\n\n') }), system);
    tally(r);
    markdown = r.text;
  }

  const outDir = join(dir, 'content', 'summaries', slug);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'summary.md'), markdown.trim() + '\n');
  const meta = {
    title: input.title,
    author: input.author ?? null,
    source: input.source,
    slug,
    model,
    costUsd: cost,
    inputTokens: inTok,
    outputTokens: outTok,
    chunks: chunks.length,
    durationMs: Date.now() - started,
    generated: new Date().toISOString().slice(0, 10),
    generator: 'chronicle-runner summarize',
  };
  writeFileSync(join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  return {
    slug,
    files: [relative(dir, join(outDir, 'summary.md')), relative(dir, join(outDir, 'meta.json'))],
    model,
    costUsd: cost,
    inputTokens: inTok,
    outputTokens: outTok,
    durationMs: Date.now() - started,
    hostedText: input.public ? relative(dir, contentPath) : null,
  };
}

function parseRange(spec, max) {
  if (!spec) return null;
  const set = new Set();
  for (const part of String(spec).split(',')) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    for (let i = Math.max(1, a); i <= Math.min(max, b); i++) set.add(i);
  }
  return set.size ? set : null;
}

/** The model is told to answer with a JSON array only; tolerate a code fence anyway. */
const extractJson = (text) => {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start < 0 || end < 0) throw new Error('no JSON array in the model output');
  return JSON.parse(t.slice(start, end + 1));
};

export async function extract(dir, input, onProgress) {
  const { slug, contentPath } = convert(dir, input, onProgress);
  await onProgress('chunking the text');
  node(dir, ['scripts/extract/chunk.mjs', contentPath]);
  const bookDir = dirname(contentPath);
  const index = JSON.parse(readFileSync(join(bookDir, 'extract', 'chunks.json'), 'utf8'));
  const wanted = parseRange(input.chunks, index.length);
  const chunks = wanted ? index.filter((c) => wanted.has(c.index)) : index;
  const system = readFileSync(join(dir, 'scripts/extract/prompts/system.md'), 'utf8');
  const instructions = readFileSync(join(dir, 'scripts/extract/prompts/extract.md'), 'utf8');
  const candDir = join(bookDir, 'extract', 'candidates');
  mkdirSync(candDir, { recursive: true });
  const started = Date.now();
  let cost = 0;
  let inTok = 0;
  let outTok = 0;
  let model = config.model;

  for (const [i, c] of chunks.entries()) {
    await onProgress(`extracting events from chunk ${c.index} of ${index.length}`, i, chunks.length + 1);
    const text = readFileSync(join(bookDir, c.file), 'utf8');
    const r = await runClaude(
      `${instructions}\n\nThe chunk follows. Write the JSON array as your entire reply.\n\n--- BEGIN CHUNK ---\n${text}\n--- END CHUNK ---`,
      system,
    );
    cost += r.costUsd;
    inTok += r.inputTokens;
    outTok += r.outputTokens;
    model = r.model;
    writeFileSync(join(candDir, `${String(c.index).padStart(3, '0')}.json`), JSON.stringify(extractJson(r.text), null, 2) + '\n');
  }

  await onProgress('drafting events and validating', chunks.length, chunks.length + 1);
  node(dir, ['scripts/extract/draft.mjs', contentPath]);
  const report = readFileSync(join(bookDir, 'extract', 'report.md'), 'utf8');
  const promotedLog = node(dir, ['scripts/extract/promote.mjs', slug, '--all']).trim();
  const eventsDir = join(dir, 'src', 'data', 'events', slug);
  const files = existsSync(eventsDir) ? readdirSync(eventsDir).map((f) => relative(dir, join(eventsDir, f))) : [];
  return {
    slug,
    files,
    drafts: files.length,
    report,
    promotedLog,
    model,
    costUsd: cost,
    inputTokens: inTok,
    outputTokens: outTok,
    durationMs: Date.now() - started,
    hostedText: input.public ? relative(dir, contentPath) : null,
  };
}
