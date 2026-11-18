#!/usr/bin/env node
// Stage 2 with a local model: read each chunk with a llama.cpp server (the
// one Sultana runs, Devstral by default) and write the same candidate files
// the Claude agent writes, so draft.mjs and promote.mjs work unchanged.
//
//   npm run extract:local -- content/private/<slug>/content.md [--limit N] [--only 003,004] [--force]
//                            [--base-url http://localhost:8080] [--model devstral] [--temperature 0.1]
//
// The loop lives here, not in the model: one chunk per request, JSON forced
// by a grammar, a single retry when the answer is unusable, and a log line
// per chunk in <book>/extract/local-log.jsonl with the time and token counts.
// A chunk that already has a candidate file is skipped, so a stopped run can
// be started again.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBook, repoRoot } from './common.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const input = argv.find((a) => !a.startsWith('--'));
if (!input) {
  console.error('Usage: npm run extract:local -- <content.md> [--limit N] [--only 003,004] [--force] [--base-url URL] [--model NAME]');
  process.exit(1);
}
const opt = (name, fallback) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : fallback);
const baseUrl = (process.env.LOCAL_MODEL_URL || opt('--base-url', 'http://localhost:8080')).replace(/\/+$/, '');
const model = opt('--model', process.env.LOCAL_MODEL || 'devstral');
const temperature = Number(opt('--temperature', '0.1'));
const limit = Number(opt('--limit', '0'));
const only = argv.includes('--only') ? opt('--only', '').split(',').map((s) => s.padStart(3, '0')) : null;
const force = argv.includes('--force');
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000;
const MAX_OUTPUT_TOKENS = 3000;

const book = loadBook(input);
const chunksIndex = JSON.parse(fs.readFileSync(path.join(book.extractDir, 'chunks.json'), 'utf8'));
const candDir = path.join(book.extractDir, 'candidates');
fs.mkdirSync(candDir, { recursive: true });
const logPath = path.join(book.extractDir, 'local-log.jsonl');

const systemPrompt = fs.readFileSync(path.join(__dirname, 'prompts', 'system.md'), 'utf8');
const taskPrompt = fs.readFileSync(path.join(__dirname, 'prompts', 'extract.md'), 'utf8');

// The same fields the Claude agent writes, enforced by the server's grammar so
// the answer is always parseable JSON. Content rules stay in the prompt.
const DATE = { type: ['string', 'null'] };
const EVENT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    startDate: { type: 'string' },
    endDate: DATE,
    datePrecision: { type: 'string', enum: ['day', 'month', 'year', 'approximate'] },
    dateBasis: { type: ['string', 'null'] },
    placeName: { type: ['string', 'null'] },
    placeHint: { type: ['string', 'null'] },
    category: { type: 'string', enum: ['political', 'religious', 'cultural', 'scientific', 'military'] },
    people: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'string' },
    page: { type: ['integer', 'null'] },
    notes: { type: ['string', 'null'] },
  },
  required: ['title', 'description', 'startDate', 'endDate', 'datePrecision', 'dateBasis', 'placeName', 'placeHint', 'category', 'people', 'evidence', 'page', 'notes'],
  additionalProperties: false,
};
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: { events: { type: 'array', items: EVENT_SCHEMA, maxItems: 12 } },
  required: ['events'],
  additionalProperties: false,
};

function userMessage(chunk, text, reminder = '') {
  return [
    taskPrompt.replace(/Write the array to the output path you were given, as JSON, and nothing else\./, 'Reply with a JSON object {"events": [...]} holding the array, and nothing else.'),
    reminder,
    `--- Chunk ${String(chunk.index).padStart(3, '0')} of ${chunksIndex.length}, book: ${book.title}, heading: ${chunk.heading}, pages ${chunk.pageStart ?? '?'} to ${chunk.pageEnd ?? '?'}` +
      (chunk.annal ? `, year: AH ${chunk.annal.ah} = ${chunk.annal.ce} CE` : '') +
      ' ---',
    '',
    text,
  ].filter(Boolean).join('\n\n');
}

// Streamed, because Node's fetch gives up on a response whose headers take
// more than five minutes to arrive, and a long chunk takes the model longer
// than that to answer in one piece. With streaming the headers come at once
// and the answer is gathered token by token.
async function ask(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: MAX_OUTPUT_TOKENS,
        stream: true,
        stream_options: { include_usage: true },
        response_format: { type: 'json_schema', json_schema: { name: 'events', schema: RESPONSE_SCHEMA } },
      }),
    });
    if (!res.ok) throw new Error(`model server answered HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    let text = '';
    let usage = {};
    let finish = null;
    let buffer = '';
    const decoder = new TextDecoder();
    for await (const part of res.body) {
      buffer += decoder.decode(part, { stream: true });
      let nl;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        let event;
        try {
          event = JSON.parse(payload);
        } catch {
          continue;
        }
        text += event.choices?.[0]?.delta?.content ?? '';
        finish = event.choices?.[0]?.finish_reason ?? finish;
        if (event.usage) usage = event.usage;
      }
    }
    return { text, usage, finish };
  } finally {
    clearTimeout(timer);
  }
}

function parseEvents(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  const list = Array.isArray(parsed) ? parsed : parsed?.events;
  if (!Array.isArray(list)) throw new Error('no events array');
  for (const [i, e] of list.entries()) {
    if (typeof e?.title !== 'string' || e.title.trim().length < 3) throw new Error(`event ${i + 1} has no title`);
    if (!/^\d{1,4}(-\d{1,2}){0,2}$/.test(String(e.startDate ?? ''))) throw new Error(`event ${i + 1} "${e.title}" has an unusable startDate ${JSON.stringify(e.startDate)}`);
  }
  return list;
}

async function main() {
  const health = await fetch(`${baseUrl}/health`).then((r) => r.json()).catch((e) => ({ status: `unreachable (${e.message})` }));
  if (health.status !== 'ok') {
    console.error(`Model server at ${baseUrl} is ${health.status}. Start llama-server (or set --base-url) and run again.`);
    process.exit(1);
  }
  let todo = chunksIndex.filter((c) => !only || only.includes(String(c.index).padStart(3, '0')));
  if (!force) todo = todo.filter((c) => !fs.existsSync(path.join(candDir, `${String(c.index).padStart(3, '0')}.json`)));
  if (limit > 0) todo = todo.slice(0, limit);
  console.error(`${book.title}: ${todo.length} chunk(s) to read with ${model} at ${baseUrl}`);
  const started = Date.now();
  let events = 0;
  let failures = 0;
  // One request for one piece of text, with a single retry when the answer is unusable.
  async function readPiece(chunk, text) {
    let list = null;
    let error = null;
    let usage = {};
    let attempts = 0;
    const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage(chunk, text) }];
    let truncated = false;
    while (list === null && attempts < 2 && !truncated) {
      attempts += 1;
      try {
        const answer = await ask(messages);
        usage = answer.usage;
        // An answer cut off at the output limit is not a mistake to retry: the piece is too dense and must be split.
        if (answer.finish === 'length') {
          truncated = true;
          error = 'answer cut off at the output limit';
          break;
        }
        list = parseEvents(answer.text);
      } catch (e) {
        error = e.message;
        messages[1].content = userMessage(chunk, text, `Your previous answer could not be used (${error}). Follow the field list exactly.`);
      }
    }
    return { list, error, usage, attempts, truncated };
  }

  // The prompt caps a chunk at 12 events, and a dense annal chunk holds more:
  // a chunk that comes back full is cut in two at a paragraph break and each
  // half is read on its own, so the cap applies per half.
  const CAP = 12;
  function halves(text) {
    const paras = text.split(/\n{2,}/);
    if (paras.length < 2) return null;
    let cut = 0;
    let size = 0;
    for (let i = 0; i < paras.length; i++) {
      size += paras[i].length;
      if (size >= text.length / 2) {
        cut = i + 1;
        break;
      }
    }
    if (cut === 0 || cut >= paras.length) return null;
    return [paras.slice(0, cut).join('\n\n'), paras.slice(cut).join('\n\n')];
  }

  for (const [n, chunk] of todo.entries()) {
    const id = String(chunk.index).padStart(3, '0');
    const text = fs.readFileSync(path.join(book.dir, chunk.file), 'utf8');
    const t0 = Date.now();
    let { list, error, usage, attempts, truncated } = await readPiece(chunk, text);
    let split = false;
    if ((list && list.length >= CAP) || truncated) {
      const parts = halves(text);
      if (parts) {
        // One at a time: the server has a single slot, and a queued request counts against its timeout.
        const a = await readPiece(chunk, parts[0]);
        const b = await readPiece(chunk, parts[1]);
        if (a.list && b.list) {
          const seen = new Set();
          list = [...a.list, ...b.list].filter((e) => {
            const key = `${e.title.toLowerCase()}|${e.startDate}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          usage = { prompt_tokens: (usage.prompt_tokens ?? 0) + (a.usage.prompt_tokens ?? 0) + (b.usage.prompt_tokens ?? 0), completion_tokens: (usage.completion_tokens ?? 0) + (a.usage.completion_tokens ?? 0) + (b.usage.completion_tokens ?? 0) };
          attempts += a.attempts + b.attempts;
          split = true;
        }
      }
    }
    const seconds = Math.round((Date.now() - t0) / 1000);
    const line = { chunk: id, seconds, attempts, split, promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null, events: list ? list.length : null, error: list ? null : error, at: new Date().toISOString() };
    fs.appendFileSync(logPath, JSON.stringify(line) + '\n');
    if (list) {
      fs.writeFileSync(path.join(candDir, `${id}.json`), JSON.stringify(list, null, 2) + '\n');
      events += list.length;
      console.error(`  [${n + 1}/${todo.length}] chunk ${id}: ${list.length} event(s) in ${seconds} s (${usage.prompt_tokens ?? '?'} in, ${usage.completion_tokens ?? '?'} out)`);
    } else {
      failures += 1;
      console.error(`  [${n + 1}/${todo.length}] chunk ${id}: FAILED after ${attempts} attempt(s): ${error}`);
    }
  }
  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.error(`Done: ${todo.length - failures} chunk(s) read, ${events} candidate event(s), ${failures} failed, ${minutes} min. Candidates in ${path.relative(repoRoot, candDir)}`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
