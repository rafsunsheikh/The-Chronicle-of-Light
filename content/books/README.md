# Hosted book texts

Full texts of books that are public domain or openly licensed, one folder per
book, as `content/books/<slug>/content.md` plus `meta.json`, produced by
`npm run convert -- <url> --public` (see `scripts/convert/README.md`).

A library entry under `src/data/library/` points here through its
`contentPath` field when `hosted` is true, and the site then offers "Read on
this site" at `/#/library/<id>/read`. The validator refuses a hosted entry
whose licence does not allow redistribution or whose file is missing. Vite
bundles each text as its own lazily loaded chunk, so a visitor downloads a
book only when they open it.

| Folder | Work | Source | Licence |
| --- | --- | --- | --- |
| `rubaiyat-of-omar-khayyam/` | Rubaiyat of Omar Khayyam, FitzGerald's translation | Project Gutenberg eBook 246 | Public domain |
| `book-of-the-thousand-nights-and-a-night-volume-1/` | The Book of the Thousand Nights and a Night, vol. 1, Burton's translation | Project Gutenberg eBook 3435 | Public domain |
| `the-confessions-of-al-ghazzali/` | The Confessions of Al Ghazzali, Claud Field's translation | Project Gutenberg eBook 58977 | Public domain |
| `poems-from-the-divan-of-hafiz/` | Poems from the Divan of Hafiz, Gertrude Bell's translation | Project Gutenberg eBook 74883 | Public domain |
| `the-mesnevi/` | The Mesnevi, Book 1, with the Acts of the Adepts, Redhouse's translation | Project Gutenberg eBook 61724 | Public domain |
| `moorish-literature/` | Moorish Literature, ed. René Basset | Project Gutenberg eBook 10085 | Public domain |
