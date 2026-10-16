# Publishing and cost

How the site is hosted, what it costs, and when that would change. The
short version: everything runs on free tiers, and nothing in the roadmap
needs a paid service.

## Where the site runs

| Piece | Service | Free tier | Monthly cost |
| --- | --- | --- | --- |
| Public site, primary | Vercel (hobby plan) at https://the-chronicle-of-light.vercel.app | 100 GB bandwidth per month, 6,000 build minutes | $0 |
| Public site, mirror | GitHub Pages at https://rafsunsheikh.github.io/The-Chronicle-of-Light/ | 1 GB site, 100 GB bandwidth per month, 10 builds per hour | $0 |
| Build and checks | GitHub Actions | Unlimited minutes for public repositories | $0 |
| Events database, sign-in, contributions | Supabase (free plan) | 500 MB database, 50,000 monthly active users, 1 GB file storage; paused after a week without requests | $0 |
| AI jobs (Phase 7) | The owner's Claude subscription through a home runner | Included in the plan | $0 extra |
| Custom domain (optional) | A registrar | Not applicable | About $10 per year |

Vercel is the primary host because it builds with the Supabase keys set in
its dashboard, so sign-in and the contribution workflow work there. GitHub
Pages builds without those keys and serves the same static bundle in
read-only mode: events render from the bundled JSON, and sign-in is hidden.

## How a deploy happens

1. A pull request is opened against `main`. CI runs lint, build, the event
   validator, the library validator and a size check (below).
2. On merge, two things run from the same commit:
   - **Vercel** builds and deploys automatically (the project is connected to
     the repository; `VERCEL=1` makes `vite.config.ts` use `/` as the base
     path).
   - **GitHub Pages** builds through `.github/workflows/deploy.yml`, which
     runs `npm run build` and publishes `dist/` (base path
     `/The-Chronicle-of-Light/`).
3. Hosted books under `content/books/` ship inside the bundle as lazily
   loaded chunks, so adding a book adds to the site size but not to what a
   visitor downloads unless they open it.

## The size budget

CI fails the build job if `dist/` is larger than 200 MB. That is a fifth of
the GitHub Pages limit, which leaves room for several hundred text-only
books (a typical one is 0.5 to 2 MB as Markdown). Large scans and PDFs are
never committed; they stay on the Internet Archive and are linked.

To check locally:

```bash
npm run build && du -sm dist
```

## The Supabase backup

`.github/workflows/backup-supabase.yml` mirrors the `events` table back into
`src/data/events/*.json` every night so git stays a recent copy of the
corpus. GitHub disables scheduled workflows after sixty days without
repository activity; when that happens the Actions tab shows a banner and
the workflow can be re-enabled with one click, or with:

```bash
gh workflow enable backup-supabase.yml
```

It reads the project URL from the repository **variable** `SUPABASE_URL`
and the anon key from the repository **secret** `VITE_SUPABASE_ANON_KEY`
(the same names the Vercel build uses), falling back to `SUPABASE_URL` and
`SUPABASE_ANON_KEY` as secrets. Every nightly run from June to August 2026
failed with "Missing SUPABASE_URL or SUPABASE_ANON_KEY" because the workflow
asked for secrets under the bare names only; that is fixed, and the schedule
needs re-enabling once the fix is on `main`.

## When to move off the free tiers

Only if one of these happens:

- Monthly bandwidth on either host nears 100 GB. Check the Vercel usage page
  and the GitHub Pages insights.
- The site passes about 800 MB, which the size budget prevents by accident.
- The Supabase database nears 500 MB, or the project keeps getting paused
  for inactivity and that becomes a nuisance. The paid plan starts at $25
  per month.
- A visitor-facing feature needs a server process. Nothing planned does.

## Custom domain

Not bought. The decision is deferred until the content is mature enough to
promote. When it is: buy the domain, add it in the Vercel project settings,
point the DNS where Vercel says, and keep the GitHub Pages address as a
mirror. Vercel issues the TLS certificate for free.
