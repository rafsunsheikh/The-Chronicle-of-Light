-- ============================================================================
-- Make Supabase the canonical store for the whole event corpus
-- ============================================================================
-- Previously the ~1,121 events lived only as bundled JSON and Supabase held a
-- thin "overrides" layer. This migration introduces a full `events` table that
-- the app reads from directly. The bundled JSON remains as an instant-first-
-- paint fallback and as the target of the periodic GitHub backup.
--
-- Run this AFTER 0001, then seed the table with `npm run seed:supabase`.
-- ============================================================================

create table if not exists public.events (
  id          text primary key,
  payload     jsonb not null,
  -- Path of the source JSON file relative to src/data/events (e.g.
  -- "tabari/event-….json"). Lets the backup job restore the original layout.
  -- Null for events created in-app; the backup defaults those to "<id>.json".
  source_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

alter table public.events enable row level security;

-- World-readable (the app reads the corpus without auth).
drop policy if exists "events public read" on public.events;
create policy "events public read" on public.events
  for select using (true);

-- Only maintainers write directly; approvals go through the RPC below.
drop policy if exists "events maintainer write" on public.events;
create policy "events maintainer write" on public.events
  for all using (public.is_maintainer()) with check (public.is_maintainer());

-- Re-point approval to upsert the canonical `events` table.
create or replace function public.approve_submission(
  submission_id uuid,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s public.event_submissions;
begin
  if not public.is_maintainer() then
    raise exception 'not authorized';
  end if;

  select * into s from public.event_submissions
    where id = submission_id for update;
  if not found then
    raise exception 'submission not found';
  end if;

  update public.event_submissions
    set status      = 'approved',
        review_note = approve_submission.note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = submission_id;

  insert into public.events (id, payload, updated_at, updated_by)
    values (s.event_id, s.payload, now(), auth.uid())
    on conflict (id) do update
      set payload    = excluded.payload,
          updated_at = now(),
          updated_by = auth.uid();
end;
$$;

-- The old overrides table is superseded by `events`.
drop table if exists public.event_overrides;
