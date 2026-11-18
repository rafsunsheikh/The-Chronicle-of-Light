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
| `.pdf` | [pdfdown](https://github.com/rafsunsheikh/pdfdown) when it is installed: a layout model puts columns in reading order, joins paragraphs across pages, drops running headers and page numbers, crops figures into `figures/`, reads scanned pages with OCR, and writes one `<!-- page N -->` marker where each page starts. Without pdfdown (or with `--engine pdfjs`): the pdf.js text layer, one marker per page, headers stripped, plain-text headings promoted to `##` |
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
the file reports, `--engine pdfdown|pdfjs` picks the PDF reader (default
`auto`: pdfdown when found), `--force` replaces an existing folder.

## pdfdown

Install it once with `uv tool install pdfdown` (or run a checkout by setting
`PDFDOWN_BIN="uv run --project ~/Projects/pdfdown pdfdown"`). The page markers
need a pdfdown newer than 0.1.5; with an older one the script says so and the
chunks carry no page numbers. `PDFDOWN_ARGS` passes extra options through, for
example `--ocr off` for scans whose text layer is complete (reading a blank
page with OCR can take minutes). `meta.json` keeps what pdfdown reported under
`engine`: pages read with OCR, the clean-up notes, and the problems it could
not fix (leftover hyphens, paragraphs ending mid-sentence), so you know what
to expect before an agent reads the text.

## Many books at once

`npm run convert:batch -- <manifest.json>` converts every book in a manifest
in turn, skipping the ones already done, so an interrupted run can be started
again. `manifests/tabari.json` lists the 40 volumes of The History of
al-Tabari and The Muslim Conquest of Persia with their titles and translators;
its `baseDir` is `${BOOKS_DIR}`, the folder holding the PDFs:

```bash
BOOKS_DIR=~/Projects/islamic_history_timeline_web_app/books \
PDFDOWN_ARGS="--ocr off" \
npm run convert:batch -- scripts/convert/manifests/tabari.json
```

`--only tabari-volume-35` converts one entry, `--force` redoes entries that
exist. These books are in copyright, so the output stays in `content/private/`.

## Limits

- **Scanned PDFs need pdfdown.** With pdf.js alone, image-only pages give no
  text and the script stops with a message; pdfdown reads them with OCR.
- OCR text layers on old scans keep ragged line breaks inside paragraphs with
  the pdf.js engine. Markdown renders single newlines as flowing text and the
  chunker treats them as one paragraph, so this is cosmetic in the file, not
  in the output. pdfdown joins the lines itself.
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
