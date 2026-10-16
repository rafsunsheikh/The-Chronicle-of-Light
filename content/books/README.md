# Hosted book texts

Full texts of books that are public domain or openly licensed, one folder per
book, as `content/books/<slug>/content.md` plus `meta.json`, produced by
`npm run convert -- <file> --public` (see `scripts/convert/README.md`).

A library entry under `src/data/library/` points here through its
`contentPath` field when `hosted` is true. The validator refuses a hosted
entry whose licence does not allow redistribution.

The reader page that renders these files is Phase 6 of the roadmap
(issue #12). Until it exists, library entries stay `hosted: false` even when
their text is already here.

| Folder | Work | Source | Licence |
| --- | --- | --- | --- |
| `rubaiyat-of-omar-khayyam/` | Rubaiyat of Omar Khayyam, FitzGerald's translation | Project Gutenberg eBook 246 (EPUB) | Public domain |
