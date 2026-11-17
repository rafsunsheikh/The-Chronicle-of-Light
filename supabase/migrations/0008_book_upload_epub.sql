-- EPUB uploads, and a size check on files already stored (book-upload
-- delivery, phase 5, 2026-11-18).
--
-- 1. The bucket also accepts EPUB, at <slug>.epub. The runner checks the file
--    by its content before converting it; the converter already reads EPUB.
-- 2. pipeline_books records each book's format, so the runner downloads the
--    right file.
-- 3. queue_book_upload() takes the chosen file's size. When the file stored
--    under that name has a different size (an earlier try, or a stopped
--    upload whose file is still in the bucket), it refuses instead of queuing
--    the old file. It keeps 0007's per-name lock and recovery rule.

update storage.buckets
   set allowed_mime_types = array['application/pdf', 'application/epub+zip']
 where id = 'book-uploads';

drop policy if exists "book-uploads maintainer insert" on storage.objects;
create policy "book-uploads maintainer insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'book-uploads'
  and public.is_maintainer()
  and name ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?\.(pdf|epub)$'
);

alter table public.pipeline_books
  add column if not exists format text not null default 'pdf' check (format in ('pdf', 'epub'));

-- The new size parameter changes the signature, so the old one goes.
drop function if exists public.queue_book_upload(text, text, text, text, boolean);

create or replace function public.queue_book_upload(
  p_slug text,
  p_title text,
  p_author text default null,
  p_translator text default null,
  p_is_public boolean default false,
  p_size bigint default null
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
  v_pdf_size bigint;
  v_epub_size bigint;
  v_size bigint;
  v_format text;
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

  -- One call per name at a time; later statements see the first call's row and job.
  perform pg_advisory_xact_lock(hashtext('queue_book_upload:' || p_slug));

  select (metadata ->> 'size')::bigint into v_pdf_size
    from storage.objects where bucket_id = 'book-uploads' and name = p_slug || '.pdf';
  select (metadata ->> 'size')::bigint into v_epub_size
    from storage.objects where bucket_id = 'book-uploads' and name = p_slug || '.epub';
  if v_pdf_size is not null and v_epub_size is not null then
    raise exception 'Both a PDF and an EPUB are stored under this name. Add a word to the title to upload this one.' using errcode = '23505';
  elsif v_pdf_size is not null then
    v_format := 'pdf';
    v_size := v_pdf_size;
  elsif v_epub_size is not null then
    v_format := 'epub';
    v_size := v_epub_size;
  else
    raise exception 'The file has not finished uploading. Upload it again.' using errcode = 'P0002';
  end if;
  if p_size is not null and p_size <> v_size then
    raise exception 'A different file is already stored under this name. Add a word to the title to upload this one.' using errcode = '23505';
  end if;

  -- The upsert is the guard: a new slug inserts; an existing slug is replaced
  -- only when its last attempt failed or stopped (no live upload job).
  insert into public.pipeline_books (slug, title, author, translator, is_public, size_bytes, format, state, error, created_by, created_at, updated_at)
  values (p_slug, v_title, v_author, v_translator, coalesce(p_is_public, false), v_size, v_format, 'uploaded', null, auth.uid(), now(), now())
  on conflict (slug) do update
    set title = excluded.title, author = excluded.author, translator = excluded.translator,
        is_public = excluded.is_public, size_bytes = excluded.size_bytes, format = excluded.format,
        state = 'uploaded', error = null, created_by = excluded.created_by, updated_at = now()
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

revoke all on function public.queue_book_upload(text, text, text, text, boolean, bigint) from public, anon;
grant execute on function public.queue_book_upload(text, text, text, text, boolean, bigint) to authenticated;
