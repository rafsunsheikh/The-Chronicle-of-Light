# Backend setup — accounts & contributions

The app now supports Google sign-in and a community contribution / approval
workflow backed by **Supabase**. This guide gets the backend running.

You only need to do this once. Until it's done, the app still runs read-only
(events render from the base JSON; sign-in and contributions are hidden).

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → sign in → **New project**.
2. Pick a name, a strong database password, and a region close to your users.
3. Wait for it to finish provisioning (~2 min).

## 2. Run the database migrations

In the Supabase dashboard, open **SQL Editor → New query**, then run each file's
contents in order:

1. [`supabase/migrations/0001_contributions.sql`](../supabase/migrations/0001_contributions.sql)
   — `profiles`, `event_submissions`, RLS policies, and the
   `approve_submission` / `reject_submission` functions.
2. [`supabase/migrations/0002_events_canonical.sql`](../supabase/migrations/0002_events_canonical.sql)
   — the canonical `events` table (the full corpus the app reads from) and
   re-points approval to write into it.

Then **seed the corpus** (see [section 8](#8-seed-the-event-corpus-one-time)).

## 3. Get your API keys

1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
   - ⚠️ Use the **bare** Project URL — `https://YOUR-PROJECT.supabase.co` — **not**
     the REST endpoint (do not include a trailing `/rest/v1/`). supabase-js adds
     those path segments itself.
3. In the project root, copy `.env.example` to `.env` and fill them in:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
   ```

> The anon key is safe to expose in the browser — row-level security is what
> protects the data, not the key.

## 4. Enable Google sign-in

1. **Create Google OAuth credentials** (Google Cloud Console):
   - <https://console.cloud.google.com> → create/select a project.
   - **APIs & Services → OAuth consent screen** → configure (External), add your
     email as a test user while in testing.
   - **APIs & Services → Credentials → Create credentials → OAuth client ID**
     → Application type **Web application**.
   - Under **Authorized redirect URIs**, add the callback Supabase shows you in
     the next step (looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`).
   - Copy the **Client ID** and **Client secret**.

2. **In Supabase → Authentication → Providers → Google**:
   - Toggle it on, paste the Client ID and Client secret, **Save**.
   - Copy the **Callback URL** shown here back into the Google credential's
     Authorized redirect URIs (step 1) if you hadn't already.

3. **In Supabase → Authentication → URL Configuration**:
   - **Site URL** → your deployed app, e.g.
     `https://the-chronicle-of-light.vercel.app`.
     (Leaving this at the default `http://localhost:3000` makes sign-in redirect
     there and fail — Supabase uses the Site URL as the fallback redirect.)
   - **Redirect URLs** → add one per environment, using the `/**` wildcard:
     - `https://the-chronicle-of-light.vercel.app/**` (production)
     - `http://localhost:5173/**` (local dev — note the dev server serves under
       `/The-Chronicle-of-Light/`, which the wildcard covers)

## 5. Run locally

```bash
npm install
npm run dev
```

Open the dev URL, click **Sign in**, complete Google login. You should return
signed in, with your name shown in the top-right account menu.

## 6. Make yourself the maintainer

Your profile row is created automatically on first sign-in. Promote it once via
**SQL Editor**:

```sql
update public.profiles set role = 'maintainer'
where email = 'rafsun.sheikh@audd.digital';
```

Sign out and back in (or refresh) — the account menu will now show a
**Review queue** link.

---

## 7. Deploy to Vercel

1. Push the repo to GitHub (already done).
2. <https://vercel.com> → **Add New → Project** → import this repo.
3. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
4. **Environment Variables** → add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (same values as your `.env`).
5. Deploy. Then add the resulting `https://….vercel.app` URL to Supabase's
   **Redirect URLs** (step 4.3) and to the Google credential's authorized
   redirect URIs if you use a custom domain.

> **Note on `base`:** `vite.config.ts` sets the base path automatically —
> `/` on Vercel (it sets `VERCEL=1` at build time) and
> `/The-Chronicle-of-Light/` for the GitHub Pages deploy. No manual change
> needed; both hosts work from the same config.

---

## 8. Seed the event corpus (one-time)

Loads all ~1,121 JSON event files into the Supabase `events` table, which the
app then reads from. This needs the **service-role key** (it bypasses RLS for
the bulk insert).

1. Supabase → **Project Settings → API → service_role** key. Copy it.
   - ⚠️ This key is a **secret** — never commit it or put it in a `VITE_` var.
2. Run the seed once, locally:

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> npm run seed:supabase
   ```

   (Or add `SUPABASE_SERVICE_ROLE_KEY=…` to your `.env` and just run
   `npm run seed:supabase`.)

3. Verify in **Table editor → events** that ~1,121 rows are present. The app now
   serves the corpus from the database (the bundled JSON remains as an instant
   first-paint and offline fallback).

## 9. Schedule the GitHub backup

A workflow (`.github/workflows/backup-supabase.yml`) mirrors the `events` table
back into `src/data/events/*.json` daily, so the repo stays a recent backup.

1. In **GitHub → repo → Settings → Secrets and variables → Actions**, add:
   - `SUPABASE_URL` — your bare project URL.
   - `SUPABASE_ANON_KEY` — the anon public key (read-only is enough).
2. **Settings → Actions → General → Workflow permissions** → enable
   **Read and write permissions** (so the job can commit).
3. Trigger it once from the **Actions** tab (**Run workflow**) to confirm it
   commits any drift. It then runs daily at 03:00 UTC.

> Cadence is set by the `cron` in the workflow — change it there if you want
> more/less frequent backups.

---

## What's built so far

- ✅ Supabase schema + RLS + approval functions (`0001`)
- ✅ Canonical `events` table — full corpus in the DB (`0002`)
- ✅ Google auth, account menu, maintainer role detection
- ✅ Edits/new events submitted as **pending** submissions
- ✅ App reads the corpus live from the database (bundled JSON = fallback)
- ✅ Seed script + scheduled GitHub backup of the knowledge base

## Still to come (next phases)

- **My contributions** dashboard (your submissions + statuses)
- **Review queue** for maintainers (approve / reject with a diff)
