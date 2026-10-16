#!/usr/bin/env node
// The Chronicle of Light home runner. Polls the Supabase ai_jobs queue with
// the service-role key, runs one job at a time on the owner's Claude
// subscription, and returns each result as a pull request.
//
//   npm run runner              poll forever
//   npm run runner:once         drain one job and exit
//   node runner/src/index.mjs --local-job job.json [--no-git]
//       run a job described in a JSON file without Supabase; --no-git skips
//       the worktree, commit and pull request and writes into this checkout
import { readFileSync } from 'node:fs';
import { assertClaudeInstalled, config, repoRoot, requireSupabase } from './config.mjs';
import { commitAll, createWorktree, openPullRequest, pushBranch, removeWorktree } from './git.mjs';
import { extract, slugify, summarize } from './jobs.mjs';
import * as queue from './queue.mjs';

const args = process.argv.slice(2);
const once = args.includes('--once');
const localIndex = args.indexOf('--local-job');
const localJob = localIndex >= 0 ? JSON.parse(readFileSync(args[localIndex + 1], 'utf8')) : null;
const noGit = args.includes('--no-git');
let stopping = false;

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`[${stamp()}] ${m}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function prBody(job, result) {
  const kindLabel = job.kind === 'summarize' ? 'AI summary' : 'AI-extracted events';
  const lines = [
    `## ${kindLabel}: ${job.input.title}`,
    '',
    `Queued from the admin panel (job \`${job.id}\`). Produced by the home runner with ${result.model} at about $${result.costUsd.toFixed(2)} of subscription usage in ${Math.round(result.durationMs / 1000)} s.`,
    '',
    `Source: ${job.input.source}`,
    '',
  ];
  if (job.kind === 'extract') {
    lines.push(
      `${result.drafts} draft event(s) under \`src/data/events/${result.slug}/\`, all \`confidence: "auto-imported"\`. Merging this pull request is the review step: delete or fix any draft before merging.`,
      '',
      '<details><summary>Extraction report</summary>',
      '',
      result.report,
      '',
      '</details>',
    );
  } else {
    lines.push(`Summary at \`content/summaries/${result.slug}/summary.md\`.`);
    if (result.hostedText) lines.push(`The source text is also hosted at \`${result.hostedText}\` because the job marked it public domain.`);
  }
  return lines.join('\n');
}

async function runJob(job, report) {
  const slug = job.input.slug || slugify(job.input.title);
  const short = String(job.id).slice(0, 8);
  const branch = `ai/${job.kind}-${slug}-${short}`;
  const dir = noGit ? repoRoot : createWorktree(branch);
  const onProgress = async (stage, done = 0, total = 0) => {
    log(`  ${stage}`);
    await report(stage, done, total);
  };
  try {
    const result = job.kind === 'summarize' ? await summarize(dir, job.input, onProgress) : await extract(dir, job.input, onProgress);
    if (noGit) {
      log(`Done (no git): ${result.files.length} file(s) written in this checkout`);
      return { ...result, branch: null, prUrl: null };
    }
    await onProgress('committing and opening a pull request');
    const scope = job.kind === 'summarize' ? 'feat(summaries)' : 'feat(events)';
    if (!commitAll(dir, `${scope}: ${job.kind} ${job.input.title} (AI job ${short})`)) {
      throw new Error('the job produced no file changes');
    }
    pushBranch(dir, branch);
    const prUrl = openPullRequest(dir, {
      title: `${job.kind === 'summarize' ? 'AI summary' : 'AI-extracted events'}: ${job.input.title}`,
      body: prBody(job, result),
      labels: job.kind === 'extract' ? ['history'] : [],
    });
    return { ...result, branch, prUrl };
  } finally {
    if (!noGit) removeWorktree(dir, branch);
  }
}

async function handle(job, { local = false } = {}) {
  log(`Claimed ${job.id} (${job.kind}): "${job.input.title}"${job.attempts > 1 ? ` attempt ${job.attempts}` : ''}`);
  const started = Date.now();
  const report = local
    ? async () => {}
    : (stage, done, total) => queue.progress(job.id, stage, done, total).catch((e) => log(`  (progress update failed: ${e.message})`));
  try {
    const result = await runJob(job, report);
    const summary = {
      prUrl: result.prUrl,
      branch: result.branch,
      files: result.files,
      model: result.model,
      costUsd: result.costUsd,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      durationMs: result.durationMs,
      drafts: result.drafts,
    };
    if (!local) await queue.complete(job.id, summary);
    log(`Done ${job.id} in ${Math.round((Date.now() - started) / 1000)} s: ${result.prUrl ?? 'no PR'} (~$${result.costUsd.toFixed(2)})`);
    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`FAILED ${job.id}: ${message}`);
    if (local) process.exitCode = 1;
    else await queue.fail(job.id, message).catch(() => {});
    return null;
  }
}

async function main() {
  assertClaudeInstalled();
  if (localJob) {
    const job = { id: localJob.id ?? `local-${Date.now()}`, kind: localJob.kind, input: localJob.input ?? localJob, attempts: 1 };
    await handle(job, { local: true });
    return;
  }
  requireSupabase();
  log('Chronicle runner starting');
  log(`  Supabase ${config.supabaseUrl}`);
  log(`  Claude   ${config.claudeBin} (model: ${config.model})`);
  try {
    const { pending } = await queue.ping();
    log(`  Queue    ${pending} job(s) pending`);
  } catch (err) {
    console.error(
      `\nCannot reach Supabase: ${err.message}\nCheck SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in runner/.env, and that migration 0004_ai_jobs.sql has been applied.`,
    );
    process.exit(1);
  }
  let idleLogged = false;
  while (!stopping) {
    try {
      const job = await queue.claim();
      if (job) {
        idleLogged = false;
        await handle(job);
        if (once) return;
        continue;
      }
      if (once) {
        log('Queue empty, exiting (--once)');
        return;
      }
      if (!idleLogged) {
        log('Nothing queued, waiting for work');
        idleLogged = true;
      }
    } catch (err) {
      log(`Poll error: ${err.message}`);
    }
    await sleep(config.pollInterval);
  }
  log('Runner stopped');
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    log('Shutting down after the current job…');
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
