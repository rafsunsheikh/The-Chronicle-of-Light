// Tests for the upload checks and the upload job's failure handling.
// Every test that expects a refusal checks the reason, not only that it threw.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { MAX_BYTES, checkPdf, checkSlug, committedSlugs, manifestWith, runUpload, storeUpload } from '../src/uploads.mjs';

const pdf = (extra = 'body') => Buffer.from(`%PDF-1.7\n${extra}\n%%EOF\n`);
const temps = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'chronicle-upload-test-'));
  temps.push(d);
  return d;
};
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A manifests folder with one committed manifest naming "tabari-volume-01". */
function manifestsFolder() {
  const dir = tempDir();
  writeFileSync(join(dir, 'tabari.json'), JSON.stringify({ baseDir: '${BOOKS_DIR}', items: [{ input: 'a.pdf', slug: 'tabari-volume-01', title: 'Vol 1' }] }));
  return dir;
}

describe('checkSlug', () => {
  it('accepts lower-case letters, digits and hyphens', () => {
    assert.equal(checkSlug('origins-of-the-islamic-state-1', new Set()), 'origins-of-the-islamic-state-1');
  });
  for (const bad of ['', 'Has-Capitals', '-leading', 'trailing-', 'dots.pdf', '../escape', 'a'.repeat(81)]) {
    it(`refuses ${JSON.stringify(bad.slice(0, 20))} as not a valid book name`, () => {
      assert.throws(() => checkSlug(bad, new Set()), /is not a valid book name/);
    });
  }
  it('refuses a slug a committed manifest already uses', () => {
    assert.throws(() => checkSlug('tabari-volume-01', committedSlugs(manifestsFolder())), /already a book in the committed manifests/);
  });
});

describe('committedSlugs', () => {
  it('ignores the uploads manifest itself', () => {
    const dir = manifestsFolder();
    writeFileSync(join(dir, 'uploads.json'), JSON.stringify({ items: [{ slug: 'uploaded-one' }] }));
    const slugs = committedSlugs(dir);
    assert.ok(slugs.has('tabari-volume-01'));
    assert.ok(!slugs.has('uploaded-one'));
  });
});

describe('checkPdf', () => {
  it('accepts a file that starts with %PDF-', () => {
    assert.ok(checkPdf(pdf()));
  });
  it('refuses an empty file as empty', () => {
    assert.throws(() => checkPdf(Buffer.alloc(0)), /The uploaded file is empty/);
  });
  it('refuses a file that does not start like a PDF', () => {
    assert.throws(() => checkPdf(Buffer.from('PK\u0003\u0004 an epub is a zip')), /is not a PDF \(it does not start with %PDF-\)/);
  });
  it('refuses a file over 50 MB, naming its size', () => {
    const big = Buffer.alloc(MAX_BYTES + 1);
    big.write('%PDF-');
    assert.throws(() => checkPdf(big), /is 50\.0 MB; the limit is 50 MB/);
  });
});

describe('manifestWith', () => {
  it('starts a new manifest that reads the books folder from BOOKS_DIR', () => {
    const m = manifestWith(null, { slug: 'a', input: 'uploads/a.pdf', title: 'A' });
    assert.equal(m.baseDir, '${BOOKS_DIR}');
    assert.deepEqual(m.items, [{ slug: 'a', input: 'uploads/a.pdf', title: 'A' }]);
  });
  it('replaces an entry with the same slug instead of adding a second one', () => {
    const first = manifestWith(null, { slug: 'a', input: 'uploads/a.pdf', title: 'Old' });
    const second = manifestWith(first, { slug: 'a', input: 'uploads/a.pdf', title: 'New' });
    assert.equal(second.items.length, 1);
    assert.equal(second.items[0].title, 'New');
  });
});

describe('storeUpload', () => {
  it('writes the PDF under uploads/ and lists it in uploads.json', () => {
    const booksDir = tempDir();
    const manifestsDir = manifestsFolder();
    const book = { slug: 'origins-1', title: 'The Origins of the Islamic State, Part 1', author: 'al-Baladhuri', translator: 'Philip Khuri Hitti', is_public: true };
    const { pdfPath, manifestPath } = storeUpload({ book, bytes: pdf(), booksDir, manifestsDir });
    assert.equal(pdfPath, join(booksDir, 'uploads', 'origins-1.pdf'));
    assert.ok(readFileSync(pdfPath).subarray(0, 5).equals(Buffer.from('%PDF-')));
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.deepEqual(manifest.items, [
      { input: 'uploads/origins-1.pdf', slug: 'origins-1', title: book.title, author: 'al-Baladhuri', translator: 'Philip Khuri Hitti', public: true },
    ]);
  });
  it('refuses to run without a books folder, saying BOOKS_DIR is missing', () => {
    assert.throws(() => storeUpload({ book: { slug: 'x', title: 'X' }, bytes: pdf(), booksDir: '', manifestsDir: manifestsFolder() }), /BOOKS_DIR is not set/);
  });
  it('writes nothing when the file is not a PDF', () => {
    const booksDir = tempDir();
    const manifestsDir = manifestsFolder();
    assert.throws(() => storeUpload({ book: { slug: 'x', title: 'X' }, bytes: Buffer.from('not a pdf'), booksDir, manifestsDir }), /is not a PDF/);
    assert.ok(!existsSync(join(booksDir, 'uploads', 'x.pdf')));
    assert.ok(!existsSync(join(manifestsDir, 'uploads.json')));
  });
});

describe('runUpload failure handling', () => {
  /** A fake source and board that record what the job did. */
  function fakes(overrides = {}) {
    const calls = { removed: [], states: [], board: [] };
    const source = {
      getBook: async (slug) => ({ slug, title: 'A book', is_public: false, state: 'uploaded' }),
      download: async () => Buffer.from('this is an epub, not a pdf'),
      remove: async (slug) => calls.removed.push(slug),
      setState: async (slug, state, error) => calls.states.push({ slug, state, error }),
      ...overrides,
    };
    const setStatus = async (slug, stage, state, opts) => calls.board.push({ slug, stage, state, error: opts?.error ?? null });
    return { calls, opts: { source, report: async () => {}, setStatus } };
  }

  it('refuses a file that is not a PDF, clears the bucket and marks the book and the board failed with the reason', async () => {
    const { calls, opts } = fakes();
    await assert.rejects(runUpload({ id: 'job-1', input: { slug: 'not-a-pdf' } }, opts), /upload failed: The uploaded file is not a PDF/);
    assert.deepEqual(calls.removed, ['not-a-pdf']);
    assert.equal(calls.states.at(-1).state, 'failed');
    assert.match(calls.states.at(-1).error, /is not a PDF/);
    assert.deepEqual(calls.board.at(-1), { slug: 'not-a-pdf', stage: 'convert', state: 'failed', error: calls.states.at(-1).error });
  });

  it('refuses a malformed slug from the queue and touches nothing: no source call, no board write', async () => {
    let fetched = false;
    const { calls, opts } = fakes({ getBook: async () => ((fetched = true), null) });
    await assert.rejects(runUpload({ id: 'job-2', input: { slug: '../../etc/passwd' } }, opts), /upload failed: .* is not a valid book name/);
    assert.equal(fetched, false);
    assert.deepEqual(calls, { removed: [], states: [], board: [] });
  });

  it("refuses a slug that names a committed book, clears the bucket and marks the upload, but never writes that book's board row", async () => {
    // A temporary manifests folder whose committed manifest lists tabari-volume-01.
    const { config } = await import('../src/config.mjs');
    const saved = config.manifestsDir;
    config.manifestsDir = manifestsFolder();
    try {
      const { calls, opts } = fakes();
      await assert.rejects(runUpload({ id: 'job-4', input: { slug: 'tabari-volume-01' } }, opts), /upload failed: "tabari-volume-01" is already a book in the committed manifests/);
      assert.deepEqual(calls.removed, ['tabari-volume-01']);
      assert.equal(calls.states.at(-1).state, 'failed');
      assert.match(calls.states.at(-1).error, /already a book in the committed manifests/);
      assert.deepEqual(calls.board, []);
    } finally {
      config.manifestsDir = saved;
    }
  });

  for (const state of ['fetched', 'failed']) {
    it(`refuses a job for a book that is ${state}, changing nothing`, async () => {
      const { calls, opts } = fakes({ getBook: async (slug) => ({ slug, title: 'A book', state }) });
      await assert.rejects(runUpload({ id: 'job-5', input: { slug: 'already-done' } }, opts), new RegExp(`upload failed: "already-done" is ${state}, not waiting to be fetched; nothing was changed`));
      assert.deepEqual(calls, { removed: [], states: [], board: [] });
    });
  }

  it('refuses a slug with no recorded upload', async () => {
    const { opts } = fakes({ getBook: async () => null });
    await assert.rejects(runUpload({ id: 'job-3', input: { slug: 'never-uploaded' } }, opts), /upload failed: No uploaded book "never-uploaded" is recorded/);
  });

  it('frees the name when the book cannot be read: clears the bucket and marks the book failed with the reason, no board write', async () => {
    const { calls, opts } = fakes({ getBook: async () => { throw new Error('fetch failed'); } });
    await assert.rejects(runUpload({ id: 'job-7', input: { slug: 'unreadable' } }, opts), /upload failed: could not read the uploaded book: fetch failed/);
    assert.deepEqual(calls.removed, ['unreadable']);
    assert.equal(calls.states.at(-1).state, 'failed');
    assert.match(calls.states.at(-1).error, /could not read the uploaded book: fetch failed/);
    assert.deepEqual(calls.board, []);
  });

  it('marks the book failed when convert fails after a successful fetch, with the bucket already cleared', async () => {
    // A temporary BOOKS_DIR and manifests folder keep the real ones untouched.
    // With pdfdown pointed at a missing program the converter falls back to its
    // built-in pdf.js reader, which refuses the stub PDF ("Invalid PDF structure").
    // Nothing is written to content/ because the converter writes only on success.
    const { config } = await import('../src/config.mjs');
    const saved = { booksDir: config.booksDir, manifestsDir: config.manifestsDir, pdfdownBin: config.pdfdownBin };
    Object.assign(config, { booksDir: tempDir(), manifestsDir: manifestsFolder(), pdfdownBin: '/nonexistent/pdfdown-for-test' });
    try {
      const { calls, opts } = fakes({ download: async () => pdf() });
      await assert.rejects(runUpload({ id: 'job-6', input: { slug: 'convert-fails' } }, opts), /convert failed: .*Invalid PDF structure/);
      assert.deepEqual(calls.removed, ['convert-fails']); // removed once, after the fetch
      assert.deepEqual(calls.states.map((s) => s.state), ['fetched', 'failed']);
      assert.match(calls.states.at(-1).error, /convert failed: .*Invalid PDF structure/);
      assert.deepEqual(calls.board.map((b) => `${b.stage}:${b.state}`), ['convert:running', 'convert:running', 'convert:failed']);
    } finally {
      Object.assign(config, saved);
    }
  });
});
