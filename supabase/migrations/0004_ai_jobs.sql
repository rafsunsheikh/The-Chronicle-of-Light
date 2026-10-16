-- AI job queue for maintainer-triggered runs (summarise a book, extract events).
--
-- Maintainers queue jobs from the admin page with the anon key under RLS.
-- The home runner polls with the service-role key, which bypasses RLS, and
-- claims one job at a time through claim_ai_job(), an atomic conditional
-- update, so several runners can share the queue safely (the same pattern as
-- Prometheus). Results come back as a pull request, so the public site stays
-- static; the row only records status, progress and where the PR is.

create table if not exists public.ai_jobs (
  id             uuid primary key default gen_random_uuid(),
  kind           text not null check (kind in ('summarize', 'extract')),
  -- {source, title, author, slug, public, chunks}
  input          jsonb not null,
  status         text not null default 'queued'
                 check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  stage          text,
  progress_done  integer not null default 0,
  progress_total integer not null default 0,
  attempts       integer not null default 0,
  error          text,
  -- {prUrl, branch, files, model, costUsd, inputTokens, outputTokens, durationMs}
  result         jsonb,
  created_by     uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  heartbeat_at   timestamptz,
  finished_at    timestamptz
);

create index if not exists ai_jobs_status_created_idx on public.ai_jobs (status, created_at);

alter table public.ai_jobs enable row level security;

-- Maintainers see every job; nobody else sees any.
drop policy if exists "ai_jobs maintainer read" on public.ai_jobs;
create policy "ai_jobs maintainer read" on public.ai_jobs
for select using (public.is_maintainer());

-- Only a maintainer may queue a job, and only as themselves.
drop policy if exists "ai_jobs maintainer insert" on public.ai_jobs;
create policy "ai_jobs maintainer insert" on public.ai_jobs
for insert with check (public.is_maintainer() and created_by = auth.uid());

-- A maintainer may cancel a job that has not started. Every other change
-- (claim, progress, result) is the runner's, through the service role.
drop policy if exists "ai_jobs maintainer cancel" on public.ai_jobs;
create policy "ai_jobs maintainer cancel" on public.ai_jobs
for update using (public.is_maintainer() and status = 'queued')
with check (public.is_maintainer() and status = 'cancelled');

-- Claim the oldest queued job, or a running job whose runner has gone quiet
-- for stale_minutes and that has not already failed three times. Progress
-- updates refresh heartbeat_at, so a long but healthy job is never stolen.
create or replace function public.claim_ai_job(stale_minutes integer default 30)
returns setof public.ai_jobs
language sql
security definer
set search_path = public
as $$
  update public.ai_jobs
     set status = 'running',
         claimed_at = now(),
         heartbeat_at = now(),
         attempts = attempts + 1,
         stage = 'claimed',
         error = null
   where id = (
     select id from public.ai_jobs
      where status = 'queued'
         or (status = 'running'
             and heartbeat_at < now() - make_interval(mins => stale_minutes)
             and attempts < 3)
      order by created_at
      limit 1
      for update skip locked
   )
  returning *;
$$;

-- Only the runner (service role) may claim. Signed-in users cannot.
revoke all on function public.claim_ai_job(integer) from public, anon, authenticated;
grant execute on function public.claim_ai_job(integer) to service_role;
