-- Book uploads: a maintainer uploads a book's PDF from the admin page, and the
-- home runner fetches it, converts it with pdfdown and adds it to the books
-- pipeline, where it waits for chunking.
--
-- The path of an upload:
--   1. The browser uploads <slug>.pdf to the private bucket book-uploads. Only
--      maintainers may upload, only PDFs, only up to 50 MB, only at a name made
--      of lower-case letters, digits and hyphens. Nobody may read, change or
--      delete an object through the API; the runner uses the secret key.
--   2. The browser calls queue_book_upload(), which checks everything again,
--      records the book in pipeline_books and queues an 'upload' job in one
--      transaction. The job carries the slug, plus the title and source (the
--      slug again) so the Jobs tab and the AiJob type work as for every
--      pipeline job; the runner acts on the
--      slug alone and reads everything else from pipeline_books.
--   On any failure the runner also removes the object, so the maintainer can
--   upload again under the same name.
--   3. The runner reads the book row, downloads and checks the file, removes it
--      from the bucket and runs the convert stage.

-- ---------------------------------------------------------------------------
-- The bucket (re-running the migration resets its settings to these)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-uploads', 'book-uploads', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "book-uploads maintainer insert" on storage.objects;
create policy "book-uploads maintainer insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'book-uploads'
  and public.is_maintainer()
  and name ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?\.pdf$'
);

-- ---------------------------------------------------------------------------
-- Uploaded books
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_books (
  slug        text primary key check (slug ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$'),
  title       text not null check (char_length(btrim(title)) between 1 and 300),
  author      text check (author is null or char_length(author) <= 200),
  translator  text check (translator is null or char_length(translator) <= 200),
  is_public   boolean not null default false,
  size_bytes  bigint,
  -- uploaded: in the bucket, waiting for the runner; fetched: on the owner's
  -- machine and in the local manifest; failed: see error.
  state       text not null default 'uploaded' check (state in ('uploaded', 'fetched', 'failed')),
  error       text,
  created_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.pipeline_books enable row level security;

-- Maintainers read the list. Writes happen only through queue_book_upload()
-- and the runner (secret key), so there are no insert, update or delete policies.
drop policy if exists "pipeline_books maintainer read" on public.pipeline_books;
create policy "pipeline_books maintainer read" on public.pipeline_books
for select using (public.is_maintainer());

-- ---------------------------------------------------------------------------
-- The job kind
-- ---------------------------------------------------------------------------
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check
  check (kind in ('summarize', 'extract', 'convert', 'chunk', 'extract-local', 'merge', 'draft', 'enrich', 'all', 'upload'));

-- ---------------------------------------------------------------------------
-- The one call the browser makes after uploading
-- ---------------------------------------------------------------------------
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

  select (metadata ->> 'size')::bigint into v_size
    from storage.objects
   where bucket_id = 'book-uploads' and name = p_slug || '.pdf';
  if not found then
    raise exception 'The PDF has not finished uploading. Upload it again.' using errcode = 'P0002';
  end if;

  -- The upsert is the guard: a new slug inserts; an existing slug is replaced
  -- only when its last attempt failed. Two calls racing on the same new slug
  -- serialise on the primary key, and the second finds a row that is not
  -- 'failed', updates nothing and is refused here.
  insert into public.pipeline_books (slug, title, author, translator, is_public, size_bytes, state, error, created_by, created_at, updated_at)
  values (p_slug, v_title, v_author, v_translator, coalesce(p_is_public, false), v_size, 'uploaded', null, auth.uid(), now(), now())
  on conflict (slug) do update
    set title = excluded.title, author = excluded.author, translator = excluded.translator,
        is_public = excluded.is_public, size_bytes = excluded.size_bytes, state = 'uploaded',
        error = null, created_by = excluded.created_by, updated_at = now()
    where public.pipeline_books.state = 'failed'
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
