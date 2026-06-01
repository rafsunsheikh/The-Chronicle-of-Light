-- ============================================================================
-- Contributors leaderboard
-- ============================================================================
-- RLS on `event_submissions` only lets a contributor read their OWN rows, so a
-- plain client-side aggregation would only ever see the current user's data.
-- This SECURITY DEFINER function runs the aggregation server-side and returns
-- ONLY safe, aggregated columns — never raw payloads, notes, or emails — so it
-- is safe to expose publicly (granted to `anon` + `authenticated`).
--
-- Contributors are ranked by APPROVED submission count (quality over volume),
-- with most-recent activity as the tiebreaker. Only people who have submitted
-- at least one change appear (INNER JOIN).
--
-- Run this AFTER 0002.
-- ============================================================================

create or replace function public.contributor_leaderboard()
returns table (
  author_id         uuid,
  display_name      text,
  approved_count    bigint,
  pending_count     bigint,
  rejected_count    bigint,
  total_count       bigint,
  last_contribution timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    -- display_name only — never expose the email of other users publicly.
    coalesce(nullif(p.display_name, ''), 'Anonymous contributor'),
    count(*) filter (where es.status = 'approved'),
    count(*) filter (where es.status = 'pending'),
    count(*) filter (where es.status = 'rejected'),
    count(*),
    max(es.created_at)
  from public.profiles p
  join public.event_submissions es on es.author_id = p.id
  group by p.id, p.display_name
  order by
    count(*) filter (where es.status = 'approved') desc,
    max(es.created_at) desc;
$$;

-- Public read: the leaderboard is visible to everyone, even logged-out.
grant execute on function public.contributor_leaderboard() to anon, authenticated;
