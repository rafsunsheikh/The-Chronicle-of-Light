# AI jobs: how a maintainer runs the AI tools

Phase 7 of the roadmap. A maintainer queues a job from the website; a runner
on the owner's machine does the work with Claude on the owner's
subscription; the result arrives as a pull request. Everyone else only ever
sees what gets merged.

## The three parts

| Part | Where it runs | What it holds | What it does |
| --- | --- | --- | --- |
| Admin page, `/#/admin` | The website (Vercel) | Nothing secret: the anon key and the visitor's Google session | Shows the queue and lets a maintainer queue a job or cancel a queued one |
| `ai_jobs` table | Supabase | Job rows: kind, input, status, progress, result | Row-level security: maintainers read and insert, nobody else sees it; the runner updates through the service role |
| Runner, `runner/` | The owner's Mac or home server | The service-role key and the Claude login | Claims one job at a time, converts and reads the source, opens the pull request |

The website never holds a Claude credential, and the runner never accepts
inbound connections. See `runner/README.md` for setup.

## Who may do what

- **Anyone** can open `/#/admin`. A visitor who is not signed in is asked to
  sign in; a signed-in contributor sees "Maintainers only". The page says so
  plainly rather than pretending the route is secret, because the real gate
  is row-level security on the table.
- **Maintainers** (the `maintainer` role on the `profiles` table, the same
  role that unlocks the review queue) see every job, can queue new ones, and
  can cancel a job that has not started.
- **The runner** holds the service-role key and is the only thing that can
  claim, update and finish jobs. The `claim_ai_job()` function is granted to
  the service role alone.

## A job's life

1. A maintainer fills the form: kind (summarise or extract), source (a URL
   or a path to text already converted on the runner machine), title,
   author, optional slug, whether the source is public domain, and for
   extraction an optional chunk range.
2. The row is inserted as `queued`.
3. The runner's next poll claims it (`running`), then posts progress as it
   converts, chunks and reads. Each update refreshes the heartbeat.
4. On success the runner commits the result on a branch
   `ai/<kind>-<slug>-<id>`, pushes it, opens a pull request, and marks the
   row `done` with the pull request link, model and cost. The admin page
   shows "Open the pull request".
5. On failure the row is `failed` with the message. A job whose runner died
   mid-way (no heartbeat for 30 minutes) is picked up again, up to three
   attempts.

## What comes back

- **Summarise:** `content/summaries/<slug>/summary.md` and `meta.json`.
  Summaries are the project's own text, so they can be committed even for
  books that cannot be hosted.
- **Extract:** draft events under `src/data/events/<slug>/`, all
  `confidence: "auto-imported"`, with the extraction report in the pull
  request body. Merging is the review step; drafts can be edited or deleted
  on the branch first.
- With the public domain box ticked, the converted text also lands under
  `content/books/<slug>/` so the reading library can host it.

## Cost

Supabase free tier, GitHub free tier, and the owner's existing Claude
subscription. The runner records tokens and an estimated cost per job and
shows it on the admin page.

## The books pipeline (added 2026-11-17)

The admin page has a second tab, **Books pipeline**, for the source books
listed in `scripts/convert/manifests/*.json`. Each book moves through six
stages, and each stage is a job of its own kind in the same `ai_jobs` table:

| Stage | Job kind | What runs on the owner's machine |
| --- | --- | --- |
| Convert | `convert` | `npm run convert:batch -- <manifest> --only <slug>` (pdfdown) |
| Chunk | `chunk` | `scripts/extract/chunk.mjs` |
| Extract | `extract-local` | `scripts/extract/local.mjs` against the local llama-server |
| Merge | `merge` | `scripts/extract/merge.mjs` |
| Draft | `draft` | `scripts/extract/draft.mjs --from merged` |
| Enrich | `enrich` | `scripts/extract/enrich.mjs` (Wikipedia and Wikidata) |

`all` runs them in order, skipping convert and chunk when their output exists.
A job's input is only `{slug, title, force}`; the runner looks the slug up in
the manifests and refuses anything not listed, so no path or command ever
comes from the queue. Pipeline jobs never touch git: drafts land under
`src/data/events/imported/<slug>/`, and promotion plus `npm run seed:supabase`
stay a person's decision.

The page reads the `pipeline_status` table (migration 0005), one row per book
and stage with the stage's counts: pages, chunks read, events, drafts,
Wikipedia matches, seconds per chunk. The runner writes it as stages finish;
`npm run runner:board` rebuilds it from what is on disk after command-line
runs. The runner needs `BOOKS_DIR`, `PDFDOWN_BIN`, `PDFDOWN_ARGS` and
`LOCAL_MODEL_URL` in `runner/.env` (see `.env.example`).

Progress on the page comes from the job row: the runner reads each script's
progress lines and writes "chunk 18 of 59" with a heartbeat, and the page
estimates the time left from the book's measured seconds per chunk.
