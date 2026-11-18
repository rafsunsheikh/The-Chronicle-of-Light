// Tests for the upload checks and the upload job's failure handling.
// Every test that expects a refusal checks the reason, not only that it threw.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import JSZip from 'jszip';
import { extractEpub } from '../../scripts/convert/extractors.mjs';
import { EPUB_MAX_ENTRIES, MAX_BYTES, checkEpub, checkFile, checkPdf, checkSlug, committedSlugs, manifestWith, runUpload, storeUpload } from '../src/uploads.mjs';

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
    const { filePath, manifestPath } = storeUpload({ book, bytes: pdf(), booksDir, manifestsDir });
    assert.equal(filePath, join(booksDir, 'uploads', 'origins-1.pdf'));
    assert.ok(readFileSync(filePath).subarray(0, 5).equals(Buffer.from('%PDF-')));
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

/** A small EPUB built the way the format requires: "mimetype" first and stored, then the package. */
async function epub({ mimetype = 'application/epub+zip', first = 'mimetype', container = true, extra = 0 } = {}) {
  const zip = new JSZip();
  if (first === 'mimetype') zip.file('mimetype', mimetype, { compression: 'STORE' });
  if (container) {
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  }
  zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Test</dc:title></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
  zip.file('OEBPS/c1.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Chapter</h1><p>Text.</p></body></html>');
  if (first !== 'mimetype') zip.file('mimetype', mimetype, { compression: 'STORE' });
  for (let i = 0; i < extra; i++) zip.file(`OEBPS/x${i}.txt`, '');
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

describe('checkEpub', () => {
  it('accepts a well-formed EPUB', async () => {
    assert.ok(checkEpub(await epub()));
  });
  it('refuses a file that is not a ZIP package', () => {
    assert.throws(() => checkEpub(pdf()), /is not an EPUB \(it is not a ZIP package\)/);
  });
  it('refuses a ZIP whose first entry is not "mimetype"', async () => {
    const bytes = await epub({ first: 'later' });
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(its first entry is not "mimetype"\)/);
  });
  it('refuses a ZIP whose mimetype is not the EPUB one', async () => {
    const bytes = await epub({ mimetype: 'application/zip' });
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(its mimetype entry does not read application\/epub\+zip\)/);
  });
  it('refuses a package without META-INF/container.xml', async () => {
    const bytes = await epub({ container: false });
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(META-INF\/container\.xml is missing\)/);
  });
  it('refuses a package with too many parts, naming the limit', async () => {
    const bytes = await epub({ extra: EPUB_MAX_ENTRIES });
    assert.throws(() => checkEpub(bytes), new RegExp(`has \\d+ parts; the limit is ${EPUB_MAX_ENTRIES}`));
  });
  it('refuses a package that claims to unpack past 300 MB, before unpacking anything', async () => {
    const bytes = Buffer.from(await epub());
    // Raise one entry's recorded size in the ZIP directory; the check reads only that number.
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const dirAt = bytes.readUInt32LE(eocd + 16);
    bytes.writeUInt32LE(400 * 1024 * 1024, dirAt + 24);
    assert.throws(() => checkEpub(bytes), /unpacks to more than 300 MB, the limit/);
  });
});

describe('checkEpub against a package that lies about itself', () => {
  /** The directory entry for one part, found by name. */
  function dirEntry(bytes, name) {
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    let at = bytes.readUInt32LE(eocd + 16);
    for (;;) {
      const len = bytes.readUInt16LE(at + 28);
      if (bytes.toString('utf8', at + 46, at + 46 + len) === name) return at;
      at += 46 + len + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
    }
  }

  it('refuses a part that states a smaller size than it really unpacks to', async () => {
    // The real size is measured, so a small stated size cannot hide a large part.
    const bytes = Buffer.from(await epub());
    const at = dirEntry(bytes, 'OEBPS/c1.xhtml');
    bytes.writeUInt32LE(10, at + 24);
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(its part "OEBPS\/c1\.xhtml" unpacks to a different size than it states\)/);
  });

  it('refuses a directory that holds more parts than its end record declares', async () => {
    // The converter's JSZip would read every part it finds, so hidden parts are refused.
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    bytes.writeUInt16LE(bytes.readUInt16LE(eocd + 10) - 1, eocd + 10);
    bytes.writeUInt16LE(bytes.readUInt16LE(eocd + 8) - 1, eocd + 8);
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(its ZIP directory holds more parts than it declares\)/);
  });

  it('refuses a gap between the directory and its end record, which would shift JSZip to another directory', async () => {
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    // Insert 16 bytes before the end record; the directory's stated place and size stay the same.
    const gapped = Buffer.concat([bytes.subarray(0, eocd), Buffer.alloc(16), bytes.subarray(eocd)]);
    assert.throws(() => checkEpub(gapped), /is not an EPUB \(its ZIP directory does not end at its end record\)/);
  });

  it('refuses an end record that names another disk, which would send JSZip looking for a ZIP64 directory', async () => {
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    bytes.writeUInt16LE(0xffff, eocd + 4);
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(it uses ZIP64 or several disks, which is not supported\)/);
  });

  it('refuses an end record whose comment runs past the end of the file', async () => {
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    bytes.writeUInt16LE(500, eocd + 20);
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(its ZIP end record is damaged\)/);
  });

  it('refuses an end-record signature hidden in the last 21 bytes, where JSZip would look', async () => {
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    // Give the end record a comment and put a second signature inside it, near the very end.
    const comment = Buffer.alloc(12);
    comment.write('PK\u0005\u0006', 4, 'latin1');
    const withComment = Buffer.concat([bytes.subarray(0, bytes.length), comment]);
    withComment.writeUInt16LE(comment.length, eocd + 20);
    assert.throws(() => checkEpub(withComment), /is not an EPUB \(its ZIP end record is damaged\)/);
  });

  it('refuses an encrypted part', async () => {
    const bytes = Buffer.from(await epub());
    const eocd = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
    const dirAt = bytes.readUInt32LE(eocd + 16);
    bytes.writeUInt16LE(bytes.readUInt16LE(dirAt + 8) | 1, dirAt + 8);
    assert.throws(() => checkEpub(bytes), /is not an EPUB \(it is encrypted\)/);
  });

  it('refuses a file too short to hold a ZIP entry, with a plain reason', () => {
    assert.throws(() => checkEpub(Buffer.from('PK\u0003\u0004 short file')), /is not an EPUB \(it is not a ZIP package\)/);
  });
});

describe('checkFile', () => {
  it('refuses a PDF that was uploaded as an EPUB', () => {
    assert.throws(() => checkFile(pdf(), 'epub'), /is not an EPUB \(it is not a ZIP package\)/);
  });
  it('refuses an EPUB that was uploaded as a PDF', async () => {
    const bytes = await epub();
    assert.throws(() => checkFile(bytes, 'pdf'), /is not a PDF \(it does not start with %PDF-\)/);
  });
  it('refuses a format the runner does not accept', () => {
    assert.throws(() => checkFile(pdf(), 'docx'), /"docx" is not a format the runner accepts \(pdf or epub\)/);
  });
});

describe('storeUpload with an EPUB', () => {
  it('stores it as uploads/<slug>.epub and lists that file', async () => {
    const booksDir = tempDir();
    const manifestsDir = manifestsFolder();
    const { filePath, manifestPath } = storeUpload({ book: { slug: 'an-epub', title: 'An EPUB', format: 'epub' }, bytes: await epub(), booksDir, manifestsDir });
    assert.equal(filePath, join(booksDir, 'uploads', 'an-epub.epub'));
    assert.equal(JSON.parse(readFileSync(manifestPath, 'utf8')).items[0].input, 'uploads/an-epub.epub');
  });
});

describe('extractEpub reads each chapter file once', () => {
  it('reads a chapter listed many times in the spine only once', async () => {
    // A tiny package that repeats one chapter would otherwise unpack it once per listing.
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    const refs = Array.from({ length: 50 }, () => '<itemref idref="c1"/>').join('');
    zip.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Repeat</dc:title></metadata><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine>${refs}</spine></package>`);
    zip.file('OEBPS/c1.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><h1>Only once</h1><p>${'word '.repeat(400)}</p></body></html>`);
    const result = await extractEpub(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
    assert.equal(result.units.chapters, 1);
    assert.equal(result.markdown.split('Only once').length - 1, 1);
  });

  it('stops past its text limit, naming the limit', async () => {
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    zip.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
    zip.file('OEBPS/content.opf', '<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata/><manifest><item id="c1" href="c1.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
    zip.file('OEBPS/c1.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><p>${'word '.repeat(1000)}</p></body></html>`);
    const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    // A 1 KB limit stands in for the real 300 MB one.
    await assert.rejects(extractEpub(bytes, () => {}, { maxText: 1024 }), /This EPUB's chapters hold more than 0\.0009765625 MB of text, the limit/);
  });
});
