-- Book uploads that stopped without the runner marking them failed can be
-- uploaded again (final review of the book-upload delivery, 2026-11-18).
--
-- An upload job can end with its book still 'uploaded': the job was cancelled,
-- the runner could not read the book, or the runner stopped until the job ran
-- out of attempts. Before this migration the name was then taken for good.
--   1. Upload jobs can no longer be cancelled from the Jobs tab; the runner
--      always finishes or fails them itself.
--   2. queue_book_upload() may replace a row that is 'failed', or 'uploaded'
--      with no live upload job (queued, or running with a heartbeat in the last
--      30 minutes, the runner's own stale limit). Keep these 30 minutes equal to
--      STALE_MINUTES in runner/.env and UPLOAD_STALE_MS in PipelinePanel.tsx.

drop policy if exists "ai_jobs maintainer cancel" on public.ai_jobs;
create policy "ai_jobs maintainer cancel" on public.ai_jobs
for update using (public.is_maintainer() and status = 'queued' and kind <> 'upload')
with check (public.is_maintainer() and status = 'cancelled' and kind <> 'upload');

create or replace function public.queue_book_upload(
  p_slug text,
  p_title text,
  p_author text default null,
  p_translator text default null,
  p_is_public boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_translator text := nullif(btrim(coalesce(p_translator, '')), '');
  v_size bigint;
  v_done text;
  v_job uuid;
begin
  if auth.uid() is null or not public.is_maintainer() then
    raise exception 'Only maintainers can add books.' using errcode = '42501';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$' then
    raise exception 'The book''s short name must be lower-case letters, digits and hyphens, up to 80 characters.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 300 then
    raise exception 'The title must be between 1 and 300 characters.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_author, '')) > 200 or char_length(coalesce(v_translator, '')) > 200 then
    raise exception 'Author and translator must be 200 characters or fewer.' using errcode = '22023';
  end if;

  -- One call per name at a time. Each later statement takes a fresh snapshot,
  -- so a second call for the same name sees the first call's row and job.
  perform pg_advisory_xact_lock(hashtext('queue_book_upload:' || p_slug));

  select (metadata ->> 'size')::bigint into v_size
    from storage.objects
   where bucket_id = 'book-uploads' and name = p_slug || '.pdf';
  if not found then
    raise exception 'The PDF has not finished uploading. Upload it again.' using errcode = 'P0002';
  end if;

  -- The upsert is the guard: a new slug inserts; an existing slug is replaced
  -- only when its last attempt failed or stopped (no live upload job). The lock
  -- above makes a second call for the same name see the first call's live job
  -- and be refused.
  insert into public.pipeline_books (slug, title, author, translator, is_public, size_bytes, state, error, created_by, created_at, updated_at)
  values (p_slug, v_title, v_author, v_translator, coalesce(p_is_public, false), v_size, 'uploaded', null, auth.uid(), now(), now())
  on conflict (slug) do update
    set title = excluded.title, author = excluded.author, translator = excluded.translator,
        is_public = excluded.is_public, size_bytes = excluded.size_bytes, state = 'uploaded',
        error = null, created_by = excluded.created_by, updated_at = now()
    where public.pipeline_books.state = 'failed'
       or (public.pipeline_books.state = 'uploaded'
           and not exists (
             select 1 from public.ai_jobs j
              where j.kind = 'upload'
                and j.input ->> 'slug' = p_slug
                and (j.status = 'queued'
                     or (j.status = 'running' and j.heartbeat_at > now() - interval '30 minutes'))))
  returning slug into v_done;
  if v_done is null then
    raise exception 'A book with this name has already been added.' using errcode = '23505';
  end if;

  insert into public.ai_jobs (kind, input, created_by)
  values ('upload', jsonb_build_object('slug', p_slug, 'title', v_title, 'source', p_slug), auth.uid())
  returning id into v_job;

  return v_job;
end;
$$;

revoke all on function public.queue_book_upload(text, text, text, text, boolean) from public, anon;
grant execute on function public.queue_book_upload(text, text, text, text, boolean) to authenticated;
