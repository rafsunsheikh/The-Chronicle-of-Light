import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Credentials come from Vite env vars (set in .env locally and in the Vercel
// dashboard for production). The app is designed to run *without* them too —
// when unconfigured, `supabase` is null and the UI degrades to read-only:
// base events still render, but auth and contributions are disabled.
const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// supabase-js expects the *bare* project URL (e.g. https://abc.supabase.co) and
// appends /rest/v1, /auth/v1, etc. itself. A common mistake is pasting the REST
// endpoint or leaving a trailing slash, which breaks every request ("No API key
// found"). Normalise defensively so either form works.
const url = rawUrl
  ?.trim()
  .replace(/\/+$/, '')
  .replace(/\/(rest|auth|storage|realtime)\/v1$/i, '');

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        // PKCE returns the auth code in the query string (?code=…) rather than
        // the URL hash, so it doesn't collide with our hash-based router.
        flowType: 'pkce',
      },
    })
  : null;
