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

## 2. Run the database migration

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the entire contents of
   [`supabase/migrations/0001_contributions.sql`](../supabase/migrations/0001_contributions.sql)
   and click **Run**.
3. This creates the `profiles`, `event_submissions`, and `event_overrides`
   tables, the row-level-security policies, and the `approve_submission` /
   `reject_submission` functions.

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

3. **In Supabase → Authentication → URL Configuration**, add your app origins to
   **Redirect URLs** (one per environment):
   - `http://localhost:5173` (local dev)
   - your Vercel URL once deployed, e.g. `https://your-app.vercel.app`

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

## What's built so far (phases 1–2)

- ✅ Supabase schema + RLS + approval functions
- ✅ Supabase client (degrades gracefully when unconfigured)
- ✅ Google auth, account menu, maintainer role detection

## Still to come (next phases)

- Submitting an edit/new event as a **pending** submission (instead of localStorage)
- Reading approved overrides live from the database
- **My contributions** dashboard
- **Review queue** for maintainers (approve / reject)
- Switching the deploy from GitHub Pages to Vercel (`base` change)
