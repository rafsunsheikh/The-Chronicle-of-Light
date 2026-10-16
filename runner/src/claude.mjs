// One headless Claude turn on the owner's subscription, ported from
// Prometheus. The ANTHROPIC_* variables are stripped so Claude Code uses its
// stored login, the working directory is an empty temp folder so no project
// context leaks in, and tools are disabled: reading a text needs none.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from './config.mjs';

const TOOL_DENYLIST = ['Bash', 'Edit', 'Write', 'Read', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'NotebookEdit', 'Task'];

let restrictedSupport = null;

/** `--restricted` is not in every Claude Code build; probe once and fall back
 *  to naming the tools explicitly, so the same safety property holds. */
function supportsRestricted() {
  restrictedSupport ??= new Promise((resolve) => {
    const probe = spawn(config.claudeBin, ['--help'], { stdio: ['ignore', 'pipe', 'ignore'] });
    let help = '';
    probe.stdout.on('data', (d) => (help += d));
    probe.on('error', () => resolve(false));
    probe.on('close', () => resolve(help.includes('--restricted')));
  });
  return restrictedSupport;
}

/**
 * @returns {Promise<{text: string, model: string, costUsd: number, inputTokens: number, outputTokens: number}>}
 */
export async function runClaude(prompt, systemPrompt, { model = config.model } = {}) {
  const restricted = await supportsRestricted();
  return new Promise((resolve, reject) => {
    const scratch = mkdtempSync(join(tmpdir(), 'chronicle-runner-'));
    const args = ['-p', '--output-format', 'json', '--model', model, '--strict-mcp-config'];
    if (restricted) args.push('--restricted');
    else args.push('--disallowedTools', TOOL_DENYLIST.join(' '));
    if (systemPrompt) args.push('--append-system-prompt', systemPrompt);

    const env = { ...process.env };
    delete env.ANTHROPIC_BASE_URL;
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    const child = spawn(config.claudeBin, args, { cwd: scratch, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    const cleanup = () => rmSync(scratch, { recursive: true, force: true });

    child.on('error', (err) => {
      cleanup();
      reject(new Error(`Could not start Claude Code (${config.claudeBin}): ${err.message}`));
    });
    child.on('close', (code) => {
      cleanup();
      if (code !== 0) {
        return reject(new Error(`Claude exited ${code}: ${(stderr || stdout).trim().slice(0, 400) || 'no output'}`));
      }
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        return reject(new Error(`Claude returned non-JSON output: ${stdout.slice(0, 400)}`));
      }
      if (parsed.is_error) return reject(new Error(`Claude reported an error: ${String(parsed.result ?? parsed.subtype)}`));
      const text = typeof parsed.result === 'string' ? parsed.result.trim() : '';
      if (!text) return reject(new Error('Claude returned an empty result'));

      // Sum usage across every model the run touched; all of it is real usage.
      const usage = parsed.modelUsage ?? {};
      let inputTokens = 0;
      let outputTokens = 0;
      for (const m of Object.values(usage)) {
        inputTokens += Number(m?.inputTokens ?? 0) + Number(m?.cacheReadInputTokens ?? 0) + Number(m?.cacheCreationInputTokens ?? 0);
        outputTokens += Number(m?.outputTokens ?? 0);
      }
      const used = Object.keys(usage).filter((m) => !m.includes('haiku')).at(-1) ?? Object.keys(usage).at(-1) ?? model;
      resolve({
        text,
        model: used,
        costUsd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0,
        inputTokens,
        outputTokens,
      });
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}
