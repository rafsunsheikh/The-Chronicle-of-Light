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

## Uploading a book (added 2026-11-18)

A maintainer can add a book without editing a manifest: **Books pipeline → Add a book**,
choose the PDF, check the title, author and translator, and press **Upload and convert**.

```mermaid
sequenceDiagram
  participant M as Maintainer's browser
  participant S as Supabase Storage (book-uploads)
  participant D as Supabase database
  participant R as Runner (owner's Mac)
  M->>M: check: a real PDF (starts with %PDF-), 50 MB or less, title not in the list
  M->>S: upload <slug>.pdf with progress (tus, maintainers only)
  M->>D: queue_book_upload(slug, title, author, translator, public)
  D->>D: check maintainer, fields, file present, name free; add pipeline_books row and an 'upload' job
  R->>D: claim the job
  R->>S: download the PDF
  R->>R: check it again, save to BOOKS_DIR/uploads/<slug>.pdf, list it in uploads.json
  R->>S: remove it from the bucket
  R->>R: run the convert stage with pdfdown
  R->>D: board: convert done (pages, words); book waits for Chunk
```

| Piece | Where | Rule |
| --- | --- | --- |
| `book-uploads` bucket | Supabase Storage (migration 0006) | Private, PDF only, 50 MB. Only maintainers may upload, only at a name of lower-case letters, digits and hyphens. Nobody may read, change or delete through the API; the runner uses the secret key. |
| `pipeline_books` table | Supabase (migration 0006) | One row per uploaded book: details, size, state (`uploaded`, `fetched`, `failed`) and the reason when it failed. Maintainers read it; only `queue_book_upload()` and the runner write it. |
| `queue_book_upload()` | Supabase (migration 0006) | The only write the browser makes. Refuses non-maintainers, bad fields, a missing file and a name already used (a failed upload may be replaced). Records the book and its job in one step. |
| `scripts/convert/manifests/uploads.json` | The owner's Mac | Written by the runner, ignored by git, read by the runner like any manifest. |

The runner acts on the job's short name (slug) only (the title in the job is there for the Jobs
tab); it reads everything else from `pipeline_books` and checks it again. A slug that a committed
manifest already uses is refused. When fetching or converting fails, the runner marks the book
failed with the reason and makes sure the PDF is no longer in the bucket, so the same book can be
uploaded again. A malformed slug, a missing book or a duplicate job for a book already fetched
is refused without changing anything. The page shows uploaded books first, with
the states *Waiting for the runner*, *Fetching*, *Converting*, *Converted* (with a **Chunk**
button) and *Upload failed*. Nothing after convert runs by itself.

Known limit: if a file with the same short name is already in the bucket (an earlier try whose
queue call failed), the page queues that stored file rather than uploading again. Choosing a
*different* PDF under the same title in that moment would queue the earlier file, and two
maintainers adding the same new title within seconds could cross their files. A follow-up would
pass the file size to `queue_book_upload` and compare it with the stored file's size.
