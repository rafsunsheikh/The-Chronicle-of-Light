// One extractor per input format. Each returns { markdown, title, author,
// language, units } where `units` counts pages (PDF) or chapters (EPUB).
// Location markers are HTML comments (`<!-- page 12 -->`,
// `<!-- chapter 3: text/ch03.xhtml -->`) so they survive Markdown rendering
// invisibly and later stages can cite a position.
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { parseGutenbergHeader, promoteHeadings, stripGutenberg, tidy } from './text.mjs';

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});
// Images and scripts carry nothing a reader or an agent can use.
turndown.remove(['script', 'style', 'noscript', 'iframe']);

const domParser = () => new JSDOM('').window.DOMParser;

export async function extractPdf(buffer, onProgress = () => {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: true,
    verbosity: 0,
  });
  const doc = await loadingTask.promise;
  const meta = await doc.getMetadata().catch(() => null);
  const info = meta?.info ?? {};

  const pages = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    // pdf.js gives positioned fragments. Group them into lines by their y
    // coordinate, then treat a vertical gap clearly larger than the page's
    // usual line spacing as a paragraph break. Within a paragraph, lines are
    // joined with single newlines, which Markdown renders as flowing text.
    // Fragments of one line on a skewed scan can sit a few units apart, so the
    // same-line tolerance scales with the text height rather than a fixed 2.
    const lines = [];
    let current = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      const tolerance = Math.max(2, (item.height || 0) * 0.6);
      if (current && Math.abs(y - current.y) <= tolerance) {
        const needsSpace = current.text && !current.text.endsWith(' ') && !item.str.startsWith(' ');
        current.text += (needsSpace ? ' ' : '') + item.str;
      } else {
        current = { y, text: item.str };
        lines.push(current);
      }
    }
    const gaps = lines.slice(1).map((l, i) => Math.abs(lines[i].y - l.y)).filter((g) => g > 0).sort((a, b) => a - b);
    const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    let out = '';
    for (const [i, line] of lines.entries()) {
      if (i > 0) {
        const gap = Math.abs(lines[i - 1].y - line.y);
        out += typical > 0 && gap > typical * 1.5 ? '\n\n' : '\n';
      }
      out += line.text.trim();
    }
    pages.push(`<!-- page ${n} -->\n${out.trim()}`);
    page.cleanup();
    if (n % 25 === 0 || n === doc.numPages) onProgress(`page ${n} of ${doc.numPages}`);
  }
  await loadingTask.destroy();

  const { text } = promoteHeadings(tidy(pages.join('\n\n')));
  return {
    markdown: text,
    title: info.Title?.trim() || null,
    author: info.Author?.trim() || null,
    language: null,
    units: { pages: doc.numPages },
  };
}

export async function extractEpub(buffer, onProgress = () => {}) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const Parser = domParser();
  const parser = new Parser();

  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('Not a valid EPUB: META-INF/container.xml is missing');
  const opfPath = parser
    .parseFromString(containerXml, 'application/xml')
    .querySelector('rootfile')
    ?.getAttribute('full-path');
  if (!opfPath) throw new Error('Not a valid EPUB: no OPF declared');

  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) throw new Error(`Not a valid EPUB: ${opfPath} is missing`);
  const opf = parser.parseFromString(opfXml, 'application/xml');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const metaText = (sel) => opf.querySelector(sel)?.textContent?.trim() || null;
  const title = metaText('metadata > title') ?? metaText('title');
  const author = metaText('metadata > creator') ?? metaText('creator');
  const language = metaText('metadata > language') ?? metaText('language');

  const manifest = new Map();
  for (const item of opf.querySelectorAll('manifest > item, item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, href);
  }
  const spine = [...opf.querySelectorAll('spine > itemref, itemref')]
    .map((ref) => manifest.get(ref.getAttribute('idref') ?? ''))
    .filter(Boolean);

  const chapters = [];
  for (const [i, href] of spine.entries()) {
    const path = decodeURIComponent(opfDir + href.split('#')[0]);
    const html = await zip.file(path)?.async('text');
    if (!html) continue;
    const dom = new JSDOM(html, { contentType: 'application/xhtml+xml' });
    const d = dom.window.document;
    d.querySelectorAll('script, style, nav[epub\\:type="toc"], nav[*|type="toc"]').forEach((el) => el.remove());
    const body = d.querySelector('body');
    if (body?.textContent?.trim()) {
      chapters.push(`<!-- chapter ${i + 1}: ${href} -->\n${turndown.turndown(body.innerHTML)}`);
    }
    onProgress(`chapter ${i + 1} of ${spine.length}`);
  }
  if (chapters.length === 0) throw new Error('No readable chapters found in this EPUB');

  // Gutenberg EPUBs carry the same licence header and footer as their text files.
  const { text: body } = stripGutenberg(chapters.join('\n\n'));

  return {
    markdown: tidy(body),
    title,
    author,
    language,
    units: { chapters: chapters.length },
  };
}

export async function extractDocx(buffer) {
  const { default: mammoth } = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ buffer });
  return {
    markdown: tidy(turndown.turndown(html)),
    title: null,
    author: null,
    language: null,
    units: {},
  };
}

/** A web page: Readability finds the article, turndown converts it. */
export function extractHtml(html, url) {
  const dom = new JSDOM(html, { url });
  const d = dom.window.document;
  const language = d.documentElement.getAttribute('lang') || null;
  const article = new Readability(d).parse();
  const contentHtml = article?.content ?? d.body?.innerHTML ?? '';
  const title = article?.title?.trim() || d.title?.trim() || null;
  let markdown = tidy(turndown.turndown(contentHtml));
  // Readability drops the page's own H1; put the title back so the file has a
  // top-level heading to chunk under.
  if (title && !/^# /m.test(markdown)) markdown = `# ${title}\n\n${markdown}`;
  return {
    markdown,
    title,
    author: article?.byline?.trim() || null,
    language,
    units: {},
    siteName: article?.siteName ?? null,
    excerpt: article?.excerpt ?? null,
  };
}

export function extractPlain(text, format) {
  if (format === 'md') {
    return { markdown: text.replace(/\r\n?/g, '\n').trim(), title: null, author: null, language: null, units: {} };
  }
  const { text: body, stripped } = stripGutenberg(text);
  const header = stripped ? parseGutenbergHeader(text) : { title: null, author: null, language: null };
  const { text: markdown, promoted } = promoteHeadings(tidy(body));
  return {
    markdown,
    title: header.title,
    author: header.author,
    language: header.language,
    units: { gutenbergBoilerplateStripped: stripped, headingsPromoted: promoted },
  };
}
