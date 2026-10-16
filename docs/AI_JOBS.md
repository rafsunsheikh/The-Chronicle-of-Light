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
