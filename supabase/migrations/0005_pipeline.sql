-- Book pipeline stages as AI jobs, and a status board the runner keeps per
-- book and stage so the admin page can show where every book stands without
-- scanning the job history.
--
-- Stages, in order: convert (PDF to Markdown with pdfdown), chunk, extract
-- (the local model reads each chunk), merge (sort, ground dates, join
-- duplicates), draft (event files under src/data/events/imported/<slug>/),
-- enrich (Wikipedia and Wikidata). "all" runs them in order. Promotion and the
-- database seed stay manual: a person decides what reaches the timeline.

alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('summarize', 'extract', 'convert', 'chunk', 'extract-local', 'merge', 'draft', 'enrich', 'all'));

create table if not exists public.pipeline_status (
  slug        text not null,
  stage       text not null check (stage in ('convert', 'chunk', 'extract-local', 'merge', 'draft', 'enrich')),
  state       text not null default 'pending' check (state in ('pending', 'running', 'done', 'failed')),
  -- counts and timings the runner reports, e.g. {"pages": 202, "chunks": 59, "done": 28, "events": 171, "secondsPerChunk": 177}
  stats       jsonb not null default '{}'::jsonb,
  job_id      uuid references public.ai_jobs (id) on delete set null,
  error       text,
  updated_at  timestamptz not null default now(),
  primary key (slug, stage)
);

alter table public.pipeline_status enable row level security;

-- Maintainers read the board; only the runner (service role, which bypasses
-- row-level security) writes it.
drop policy if exists "pipeline_status maintainer read" on public.pipeline_status;
create policy "pipeline_status maintainer read" on public.pipeline_status
for select using (public.is_maintainer());
