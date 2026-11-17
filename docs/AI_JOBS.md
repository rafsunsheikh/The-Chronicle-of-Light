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
choose the PDF or EPUB (EPUB added 2026-11-18), check the title, author and translator, and
press **Upload and convert**.

```mermaid
sequenceDiagram
  participant M as Maintainer's browser
  participant S as Supabase Storage (book-uploads)
  participant D as Supabase database
  participant R as Runner (owner's Mac)
  M->>M: check: a real PDF (starts with %PDF-) or EPUB (ZIP with the EPUB mimetype first), 50 MB or less, title not in the list
  M->>S: upload <slug>.pdf or <slug>.epub with progress (tus, maintainers only)
  M->>D: queue_book_upload(slug, title, author, translator, public, size)
  D->>D: check maintainer, fields, file present and the same size, name free; add pipeline_books row (with its format) and an 'upload' job
  R->>D: claim the job
  R->>S: download the PDF
  R->>R: check it again by content, save to BOOKS_DIR/uploads/<slug>.<format>, list it in uploads.json
  R->>S: remove it from the bucket
  R->>R: run the convert stage (pdfdown for a PDF, the built-in EPUB reader for an EPUB)
  R->>D: board: convert done (pages, words); book waits for Chunk
```

| Piece | Where | Rule |
| --- | --- | --- |
| `book-uploads` bucket | Supabase Storage (migrations 0006, 0008) | Private, PDF or EPUB, 50 MB. Only maintainers may upload, only at a name of lower-case letters, digits and hyphens. Nobody may read, change or delete through the API; the runner uses the secret key. |
| `pipeline_books` table | Supabase (migrations 0006, 0008) | One row per uploaded book: details, size, format (`pdf` or `epub`), state (`uploaded`, `fetched`, `failed`) and the reason when it failed. Maintainers read it; only `queue_book_upload()` and the runner write it. |
| `queue_book_upload()` | Supabase (migrations 0006, 0007, 0008) | The only write the browser makes. Refuses non-maintainers, bad fields, a missing file, a stored file of a different size, and a name already used (a failed or stopped upload may be replaced). Records the book and its job in one step, one call per name at a time. |
| `scripts/convert/manifests/uploads.json` | The owner's Mac | Written by the runner, ignored by git, read by the runner like any manifest. |

The runner acts on the job's short name (slug) only (the title in the job is there for the Jobs
tab); it reads everything else from `pipeline_books` and checks it again. A slug that a committed
manifest already uses is refused. When fetching or converting fails, the runner marks the book
failed with the reason and makes sure the PDF is no longer in the bucket, so the same book can be
uploaded again. A malformed slug, a missing book or a duplicate job for a book already fetched
is refused without changing anything. The page shows uploaded books first, with
the states *Waiting for the runner*, *Fetching*, *Converting*, *Converted* (with a **Chunk**
button) and *Upload failed*. Nothing after convert runs by itself.

An EPUB is checked by its content, not its name: a ZIP whose first entry is `mimetype`, stored
uncompressed, reading `application/epub+zip`, with `META-INF/container.xml`, at most 5,000 parts
and at most 300 MB unpacked. The runner measures what each part really unpacks to (capped at the
size the part states), so a package that understates a part's size or hides parts in its
directory is refused before conversion; the converter then reads it with JSZip and jsdom, which
run no scripts and load no outside resources. It reads each chapter file once, however often the book's
reading order lists it, and stops past 300 MB of chapter text. Known limit: the 300 MB caps what
is unpacked, not the memory jsdom uses to parse a chapter; a 300 MB chapter of very many tiny
elements could still use several GB while converting. Only maintainers can upload.

If a file with the same short name is already in the bucket (an earlier try whose queue call
failed, or a stopped upload), the page does not upload again; `queue_book_upload` queues the
stored file only when its size matches the chosen file, and otherwise says "A different file is
already stored under this name. Add a word to the title to upload this one." (migration 0008).
An upload stops when its job is cancelled, the runner cannot read it, or the runner goes quiet for
30 minutes before converting (migration 0007); the page then shows *Upload stopped* and the name
can be used again.

Known limit: when a stopped upload's file is still in the bucket and a file of the other format is
uploaded under the same title, the database refuses ("Both a PDF and an EPUB are stored under this
name") and the second file stays in the bucket until removed in the Supabase dashboard; adding a
word to the title uploads it under a new name.
