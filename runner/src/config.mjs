// Runner settings from runner/.env (or the environment). No dependency: a
// minimal .env reader is enough, and real environment variables always win
// over the file.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const runnerRoot = resolve(here, '..');
export const repoRoot = resolve(here, '..', '..');

const envFile = resolve(runnerRoot, '.env');
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const expandHome = (p) => p.replace(/^~|^\$HOME/, homedir());

export const config = {
  supabaseUrl: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, ''),
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  claudeBin: expandHome(process.env.CLAUDE_BIN || '~/.local/bin/claude'),
  model: process.env.CLAUDE_MODEL || 'sonnet',
  pollInterval: Number(process.env.POLL_INTERVAL || 15) * 1000,
  staleMinutes: Number(process.env.STALE_MINUTES || 30),
  chunkChars: Number(process.env.CHUNK_CHARS || 120_000),
  gitRemote: process.env.GIT_REMOTE || 'origin',
  baseBranch: process.env.BASE_BRANCH || 'main',
  ghBin: process.env.GH_BIN || 'gh',
  promptsDir: resolve(runnerRoot, 'prompts'),
  worktreesDir: resolve(repoRoot, '.ai-worktrees'),
};

export function requireSupabase() {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    console.error(`Missing ${missing.join(' and ')}. Copy runner/.env.example to runner/.env and fill it in.`);
    process.exit(1);
  }
}

export function assertClaudeInstalled() {
  if (!existsSync(config.claudeBin)) {
    console.error(
      `Claude Code binary not found at ${config.claudeBin}.\n` +
        `Set CLAUDE_BIN in runner/.env to the real binary (your shell 'claude' may be a function; check with 'type claude').`,
    );
    process.exit(1);
  }
}
