#!/usr/bin/env node
// Checks the database rules for book uploads (migration 0006) against the real
// Supabase project.
//
//   node scripts/check-book-upload-rules.mjs
//
// Signed out, with the publishable key from .env, every way in must be refused,
// and each refusal must be for the reason we expect, not just any error. With
// the secret key from runner/.env it also checks that the bucket, the table and
// the function exist with the right settings. It writes nothing.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ROOT, SUPABASE_ANON_KEY, SUPABASE_URL } from './_env.mjs';

/** The secret key lives in runner/.env, which _env.mjs does not load. */
function secretKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  const file = join(ROOT, 'runner', '.env');
  if (!existsSync(file)) return '';
  const line = readFileSync(file, 'utf8').split('\n').find((l) => l.trim().startsWith('SUPABASE_SERVICE_ROLE_KEY='));
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : '';
}

const url = SUPABASE_URL;
const publishable = SUPABASE_ANON_KEY;
const secret = secretKey();
if (!url || !publishable) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env first.');
  process.exit(1);
}

let failures = 0;
const pass = (name) => console.log(`ok    ${name}`);
const fail = (name, detail) => {
  failures++;
  console.log(`FAIL  ${name}\n      ${detail}`);
};
/** The call must fail, and its message must contain one of the expected reasons. */
function expectRefused(name, error, reasons) {
  if (!error) return fail(name, 'it was allowed');
  const msg = String(error.message ?? error);
  if (reasons.some((r) => msg.toLowerCase().includes(r.toLowerCase()))) return pass(`${name} (refused: "${msg}")`);
  fail(name, `refused, but for an unexpected reason: "${msg}" (expected one of: ${reasons.map((r) => `"${r}"`).join(', ')})`);
}

const anon = createClient(url, publishable, { auth: { persistSession: false } });
const pdf = new Blob([Buffer.from('%PDF-1.4\n%%EOF\n')], { type: 'application/pdf' });

// 1. Upload signed out. Storage answers a policy refusal with the row-level security message.
{
  const { error } = await anon.storage.from('book-uploads').upload('rules-check.pdf', pdf, { upsert: false });
  expectRefused('signed-out upload to book-uploads', error, ['row-level security']);
}

// 2. Queue a book signed out. Execute is revoked from anon, so Postgres refuses
//    before the function runs ("permission denied"). If the grant were ever
//    widened, the function's own check would answer instead ("Only maintainers"),
//    which is also a correct refusal, so both are accepted and named here.
{
  const { error } = await anon.rpc('queue_book_upload', { p_slug: 'rules-check', p_title: 'Rules check' });
  expectRefused('signed-out queue_book_upload', error, ['permission denied for function queue_book_upload', 'Only maintainers can add books']);
}

// 3. Queue an upload job directly, signed out. The ai_jobs insert policy refuses it.
{
  const { error } = await anon.from('ai_jobs').insert({ kind: 'upload', input: { slug: 'rules-check' }, created_by: '00000000-0000-0000-0000-000000000000' });
  expectRefused('signed-out insert of an upload job', error, ['row-level security']);
}

// 4. Write the books table directly, signed out. There is no insert policy at all.
{
  const { error } = await anon.from('pipeline_books').insert({ slug: 'rules-check', title: 'Rules check', created_by: '00000000-0000-0000-0000-000000000000' });
  expectRefused('signed-out insert into pipeline_books', error, ['row-level security']);
}

// 5. Download signed out. With no select policy on the bucket, row-level
//    security hides every object, so Storage answers as if the file did not
//    exist ("Object not found"). That is the refusal for a read; it is the same
//    answer whether or not a file with this name is in the bucket.
{
  const { error } = await anon.storage.from('book-uploads').download('rules-check.pdf');
  expectRefused('signed-out download from book-uploads', error, ['Object not found']);
}

// 6. Reading is not an error under row-level security: rows are filtered out.
//    So these check that nothing comes back, which is the refusal for a read.
//    The bucket is normally empty, so the list check cannot tell "blocked"
//    from "empty"; the download check above is the meaningful one.
{
  const { data, error } = await anon.from('pipeline_books').select('slug').limit(5);
  if (error) fail('signed-out read of pipeline_books', `unexpected error "${error.message}" (expected an empty list)`);
  else if (data.length) fail('signed-out read of pipeline_books', `${data.length} row(s) visible`);
  else pass('signed-out read of pipeline_books returns nothing');
}
{
  const { data, error } = await anon.storage.from('book-uploads').list('', { limit: 5 });
  if (error) fail('signed-out list of book-uploads', `unexpected error "${error.message}" (expected an empty list)`);
  else if (data.length) fail('signed-out list of book-uploads', `${data.length} object(s) visible`);
  else pass('signed-out list of book-uploads returns nothing');
}

// 7. With the secret key: the pieces exist with the right settings.
if (secret) {
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const { data: bucket, error } = await admin.storage.getBucket('book-uploads');
  if (error) fail('bucket book-uploads exists', error.message);
  else {
    const okSettings = bucket.public === false && Number(bucket.file_size_limit) === 52428800 && (bucket.allowed_mime_types ?? []).join(',') === 'application/pdf';
    if (okSettings) pass('bucket book-uploads is private, 50 MB, PDF only');
    else fail('bucket book-uploads settings', JSON.stringify({ public: bucket.public, file_size_limit: bucket.file_size_limit, allowed_mime_types: bucket.allowed_mime_types }));
  }
  const table = await admin.from('pipeline_books').select('slug', { count: 'exact', head: true });
  if (table.error) fail('table pipeline_books exists', table.error.message);
  else pass('table pipeline_books exists');
  // Called with the secret key there is no signed-in user, so the function's own
  // first check must answer: this proves the function exists and refuses non-maintainers.
  const fn = await admin.rpc('queue_book_upload', { p_slug: 'rules-check', p_title: 'Rules check' });
  expectRefused('queue_book_upload exists and refuses a caller who is not a maintainer', fn.error, ['Only maintainers can add books']);
  // The job kind: insert an 'upload' job whose created_by user does not exist.
  // The CHECK constraint runs before the foreign key, so if 'upload' were not an
  // allowed kind the answer would name ai_jobs_kind_check. Getting the foreign
  // key error proves the kind passed; nothing is written either way.
  const kind = await admin.from('ai_jobs').insert({ kind: 'upload', input: { slug: 'rules-check' }, created_by: '00000000-0000-0000-0000-000000000000' });
  expectRefused("ai_jobs accepts kind 'upload' (stopped by the foreign key instead)", kind.error, ['ai_jobs_created_by_fkey']);
} else {
  console.log('skip  secret-key checks (no SUPABASE_SERVICE_ROLE_KEY in runner/.env)');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
