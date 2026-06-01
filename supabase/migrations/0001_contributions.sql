-- ============================================================================
-- Community contributions + maintainer moderation
-- ============================================================================
-- Run this in the Supabase SQL editor (or via the Supabase CLI) once, against
-- a fresh project. It creates:
--   • profiles          – one row per auth user, carries the role
--   • event_submissions – proposed edits/creations awaiting review
--   • event_overrides    – approved, live event data the app reads
-- plus row-level security and the approve/reject RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  role         text not null default 'contributor'
                 check (role in ('contributor', 'maintainer')),
  created_at   timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Convenience: is the *current* request coming from a maintainer?
create or replace function public.is_maintainer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'maintainer'
  );
$$;

-- ----------------------------------------------------------------------------
-- event_submissions
-- ----------------------------------------------------------------------------
create table if not exists public.event_submissions (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null,                       -- target / new event id
  type         text not null check (type in ('edit', 'create')),
  status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
  payload      jsonb not null,                      -- full proposed event object
  author_id    uuid not null references public.profiles (id) on delete cascade,
  author_email text,
  note         text,                                -- submitter's note
  review_note  text,                                -- maintainer's note
  reviewed_by  uuid references public.profiles (id),
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists event_submissions_author_idx
  on public.event_submissions (author_id);
create index if not exists event_submissions_status_idx
  on public.event_submissions (status);

-- ----------------------------------------------------------------------------
-- event_overrides (approved, live data the app merges over the base JSON)
-- ----------------------------------------------------------------------------
create table if not exists public.event_overrides (
  event_id   text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id)
);

-- ----------------------------------------------------------------------------
-- Row-level security
-- ----------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.event_submissions enable row level security;
alter table public.event_overrides   enable row level security;

-- profiles: a user can read their own row; maintainers can read all.
-- (No client-side update policy → role can only be changed via SQL, preventing
--  privilege escalation.)
drop policy if exists "profiles read own or maintainer" on public.profiles;
create policy "profiles read own or maintainer" on public.profiles
  for select using (id = auth.uid() or public.is_maintainer());

-- event_submissions
drop policy if exists "submissions insert own" on public.event_submissions;
create policy "submissions insert own" on public.event_submissions
  for insert with check (author_id = auth.uid());

drop policy if exists "submissions read own or maintainer" on public.event_submissions;
create policy "submissions read own or maintainer" on public.event_submissions
  for select using (author_id = auth.uid() or public.is_maintainer());

-- A contributor may withdraw their own *pending* submission.
drop policy if exists "submissions withdraw own pending" on public.event_submissions;
create policy "submissions withdraw own pending" on public.event_submissions
  for delete using (author_id = auth.uid() and status = 'pending');

-- Maintainers may update submissions (status changes also flow via RPC below).
drop policy if exists "submissions maintainer update" on public.event_submissions;
create policy "submissions maintainer update" on public.event_submissions
  for update using (public.is_maintainer()) with check (public.is_maintainer());

-- event_overrides: world-readable (the app reads these without auth);
-- only maintainers write directly (approval RPC is security definer).
drop policy if exists "overrides public read" on public.event_overrides;
create policy "overrides public read" on public.event_overrides
  for select using (true);

drop policy if exists "overrides maintainer write" on public.event_overrides;
create policy "overrides maintainer write" on public.event_overrides
  for all using (public.is_maintainer()) with check (public.is_maintainer());

-- ----------------------------------------------------------------------------
-- Approval / rejection RPCs
-- ----------------------------------------------------------------------------
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

  insert into public.event_overrides (event_id, payload, updated_at, updated_by)
    values (s.event_id, s.payload, now(), auth.uid())
    on conflict (event_id) do update
      set payload    = excluded.payload,
          updated_at = now(),
          updated_by = auth.uid();
end;
$$;

create or replace function public.reject_submission(
  submission_id uuid,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_maintainer() then
    raise exception 'not authorized';
  end if;

  update public.event_submissions
    set status      = 'rejected',
        review_note = reject_submission.note,
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = submission_id;
  if not found then
    raise exception 'submission not found';
  end if;
end;
$$;

grant execute on function public.is_maintainer()                  to anon, authenticated;
grant execute on function public.approve_submission(uuid, text)   to authenticated;
grant execute on function public.reject_submission(uuid, text)    to authenticated;

-- ============================================================================
-- After your first Google sign-in, promote yourself to maintainer:
--
--   update public.profiles set role = 'maintainer'
--   where email = 'rafsun.sheikh@audd.digital';
-- ============================================================================
