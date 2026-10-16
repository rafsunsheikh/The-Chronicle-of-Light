import { marked, type Tokens } from 'marked';

export interface TocEntry {
  id: string;
  text: string;
  level: number;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEntities = (html: string) =>
  html
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'section';

/**
 * Render trusted Markdown (our own converted public domain texts) to HTML and
 * collect a table of contents. Headings get stable ids so the contents list
 * can link to them; duplicate headings get a numeric suffix. Raw HTML in the
 * source (page-marker comments) is dropped rather than rendered.
 */
export function renderBook(markdown: string): { html: string; toc: TocEntry[] } {
  const toc: TocEntry[] = [];
  const seen = new Map<string, number>();
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }: Tokens.Heading) => {
    const text = renderer.parser.parseInline(tokens);
    const plain = decodeEntities(text.replace(/<[^>]+>/g, ''));
    let id = slug(plain);
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n > 1) id = `${id}-${n}`;
    if (depth <= 3) toc.push({ id, text: plain, level: depth });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.html = () => '';
  // Converted EPUBs keep links into their own files (page numbers in a
  // contents list, footnote anchors). Those targets do not exist here, so
  // only web links stay links; the rest render as plain text.
  renderer.link = ({ href, tokens }: Tokens.Link) => {
    const text = renderer.parser.parseInline(tokens);
    if (!/^https?:\/\//i.test(href)) return text;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  };
  const html = marked.parse(markdown, { async: false, gfm: true, breaks: false, renderer }) as string;
  return { html, toc };
}

export const readingMinutes = (markdown: string) => Math.max(1, Math.round((markdown.match(/\S+/g)?.length ?? 0) / 220));
