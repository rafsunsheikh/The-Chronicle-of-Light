// Hosted book texts live in content/books/<slug>/content.md and are committed
// to the repo. Vite turns each one into its own lazily loaded chunk, so a
// visitor downloads a book only when they open its reader page.
const loaders = import.meta.glob<string>('../../content/books/*/content.md', {
  query: '?raw',
  import: 'default',
});

/** Load the Markdown for a library entry's contentPath, e.g.
 *  "content/books/rubaiyat-of-omar-khayyam/content.md". */
export async function loadBookMarkdown(contentPath: string): Promise<string> {
  const key = `../../${contentPath}`;
  const load = loaders[key];
  if (!load) throw new Error(`No hosted text at ${contentPath}`);
  return load();
}

export interface FrontMatter {
  [key: string]: string | number;
}

/** Split the YAML-ish front matter written by scripts/convert from the body. */
export function splitFrontMatter(markdown: string): { fields: FrontMatter; body: string } {
  const m = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fields: {}, body: markdown };
  const fields: FrontMatter = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const raw = kv[2].trim();
    if (raw.startsWith('"')) {
      try {
        fields[kv[1]] = JSON.parse(raw) as string;
      } catch {
        fields[kv[1]] = raw.slice(1, -1);
      }
    } else if (/^\d+$/.test(raw)) fields[kv[1]] = Number(raw);
    else fields[kv[1]] = raw;
  }
  return { fields, body: markdown.slice(m[0].length) };
}
