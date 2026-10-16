# Convert source material to Markdown

Every book, report or article becomes Markdown before any AI tool reads it.
This script does that conversion.

```bash
npm run convert -- path/to/book.pdf
npm run convert -- path/to/book.epub --public
npm run convert -- https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Avicenna
```

## What it accepts

| Input | How it is read |
| --- | --- |
| `.pdf` | pdf.js text layer, one `<!-- page N -->` marker per page, running headers and page numbers stripped, plain-text headings promoted to `##` |
| `.epub` | Spine order from the OPF, each chapter converted from HTML, one `<!-- chapter N: file -->` marker per chapter |
| `.docx` | mammoth to HTML, then to Markdown |
| `.txt` | Project Gutenberg header and footer stripped, headings such as `CHAPTER III` promoted to `##` |
| `.md` | Taken as is |
| `.html` or a URL | Readability picks out the article, then it is converted to Markdown |

A URL is fetched with a polite user agent (override with `CONVERT_USER_AGENT`)
and its format is taken from the response's content type.

## Where output goes

| Flag | Folder | Committed? | Use for |
| --- | --- | --- | --- |
| (none) | `content/private/<slug>/` | No, gitignored | Anything you may not redistribute: your own copies of in-copyright books |
| `--public` | `content/books/<slug>/` | Yes | Public domain and openly licensed texts that the site may host |

Each folder holds `content.md` (YAML front matter, then the text) and
`meta.json` (title, author, language, format, source path or URL, byte size,
SHA-256 of the source, conversion date, word and heading counts).

For a public text, pass its URL rather than a downloaded copy, so `meta.json`
records where it came from. For example the sample under
`content/books/rubaiyat-of-omar-khayyam/` was made with
`npm run convert -- https://www.gutenberg.org/ebooks/246.epub.noimages --public`.

Options: `--slug` sets the folder name, `--title` and `--author` override what
the file reports, `--force` overwrites an existing folder.

## Limits

- **Scanned PDFs do not work.** If the pages are images there is no text to
  extract. Run OCR first. The script stops with a message when almost nothing
  comes out.
- OCR text layers on old scans keep ragged line breaks inside paragraphs.
  Markdown renders single newlines as flowing text and the chunker treats
  them as one paragraph, so this is cosmetic in the file, not in the output.
- Files over 120 MB are refused.
- Heading promotion for PDF and plain text is conservative on purpose: a line
  only becomes a heading when it sits alone between blank lines and looks like
  `Chapter IV`, `IV. Title` or a short capitalised title. Numbered prose is
  left alone.

## Why Markdown

Markdown is plain text with light structure, so one file works for the reading
library, for chunking by heading, and for an agent that must cite where a claim
came from. The page and chapter markers are HTML comments: invisible when
rendered, searchable in the file.
