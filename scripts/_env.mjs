import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader for the Node scripts (the app itself uses Vite's env
// handling). Loads .env then .env.local without overwriting vars already set in
// the real environment — so CI secrets always win over local files.
function parseEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

parseEnvFile(join(root, '.env'));
parseEnvFile(join(root, '.env.local'));

// Accept either the VITE_-prefixed names (shared with the app) or bare ones.
export const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  ''
)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|auth|storage|realtime)\/v1$/i, '');

export const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const EVENTS_DIR = join(root, 'src', 'data', 'events');
export const ROOT = root;
