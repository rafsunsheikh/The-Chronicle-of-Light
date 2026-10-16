# The home runner

A small Node program that runs on your own machine, polls the Supabase job
queue, executes each job with the Claude Code CLI on your subscription, and
returns the result as a pull request. Nothing connects to your machine: it
only makes outbound requests, so it needs no open port and no tunnel. The
Claude credential never leaves the machine; the website never holds one.

```
  Browser (maintainer)  --insert-->  Supabase ai_jobs  <--claim/progress--  Runner (your Mac)
                                                                                  |
                                                                   claude -p, scripts/convert,
                                                                   scripts/extract, git, gh
                                                                                  |
                                                                                  v
                                                                   Pull request against main
```

## Setup, once

1. **Apply the migration.** In the Supabase SQL editor run
   `supabase/migrations/0004_ai_jobs.sql`. It creates the `ai_jobs` table,
   its row-level-security policies (maintainers read and insert, nobody else
   sees it) and the `claim_ai_job()` function only the service role may call.
2. **Sign in the tools on this machine.** Run `claude` once and complete the
   login. Run `gh auth login` so the runner can push branches and open pull
   requests as you. The repository checkout must have `origin` set.
3. **Configure.** `cp runner/.env.example runner/.env` and fill in the
   Supabase URL and the **service-role** key (Project Settings, API). Point
   `CLAUDE_BIN` at the real binary: `type claude` shows the path if your
   shell wraps it in a function.
4. **Start.**

   ```bash
   npm run runner          # poll forever
   npm run runner:once     # take one job and exit
   ```

   To keep it alive see `com.chronicle.runner.plist.example` (macOS) or
   `chronicle-runner.service.example` (Linux).

## What a job does

Each job gets a fresh git worktree under `.ai-worktrees/` from `origin/main`,
so your own working tree is never touched.

**Summarise.** Converts the source with `npm run convert`, splits it at
headings into chunks of about 120,000 characters, summarises each with
Claude, then synthesises the parts into one summary with sections for the
core argument, themes, chapter-by-chapter notes, people, places and dates,
takeaways and notable passages. The result goes to
`content/summaries/<slug>/summary.md` with a `meta.json` recording model,
tokens and cost. Short books get a single pass.

**Extract.** Converts the source, runs `scripts/extract/chunk.mjs`, sends
each chunk through Claude with the prompts in `scripts/extract/prompts/`,
then runs the draft and promote stages. The drafts land under
`src/data/events/<slug>/` with `confidence: "auto-imported"` and the pull
request body carries the extraction report. Merging the pull request is
the review step.

If the job marked the source public domain, the converted text is also
committed under `content/books/<slug>/` so it can be hosted.

## Safety properties

- Claude runs with tools disabled (`--restricted`, or an explicit deny list
  on older builds), in an empty temporary directory, with the `ANTHROPIC_*`
  variables stripped so it uses the stored login and nothing else.
- One job at a time. Parallel headless sessions contend for the same
  subscription limits.
- Progress updates are heartbeats. A job silent for 30 minutes is handed
  back to the queue; three failed attempts and it stops. Two runners can
  share one queue because the claim is an atomic conditional update.
- The service-role key is read only from `runner/.env`, which is gitignored.

## Trying a job without Supabase

```bash
cat > /tmp/job.json <<'EOF'
{ "kind": "summarize",
  "input": { "source": "https://www.gutenberg.org/ebooks/58977.epub.noimages",
             "title": "The Confessions of Al Ghazzali", "author": "Al-Ghazali", "public": true } }
EOF
node runner/src/index.mjs --local-job /tmp/job.json --no-git
```

`--no-git` writes the result into this checkout instead of a worktree and
opens no pull request. Without it, the local job still creates the branch
and the pull request, which is a good end-to-end test before trusting the
queue.
