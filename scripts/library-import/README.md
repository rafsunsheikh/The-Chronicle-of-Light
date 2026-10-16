# Library importer

Collects open books, reports and articles into drafts for the Islamic
Renaissance library. A script finds candidates; a person reviews each one,
writes its summary and confirms its licence; then it is promoted.

```bash
npm run import:library -- --source wikisource --query "Rhazes" --category medicine
npm run import:library -- --source gutenberg --query "moors spain" --category art-and-architecture
npm run import:library -- --source openlibrary --query "literary history of persia" --category literature-and-poetry
npm run import:library -- --source ia --query 'creator:(browne) AND title:(arabian medicine)' --category medicine
node scripts/library-import/promote.mjs --all --established
```

## Sources

| `--source` | What it searches | Licence it records |
| --- | --- | --- |
| `wikisource` | 1911 Encyclopaedia Britannica articles by title prefix on Wikisource | public-domain |
| `gutenberg` | The Project Gutenberg catalogue (one CSV, cached for a week), every query word against title and subjects | public-domain in the United States; confirm the author's death year for elsewhere |
| `openlibrary` | Open Library works with a public scan, linking to the scan on the Internet Archive | public-domain before 1900, otherwise unknown |
| `ia` | Internet Archive advanced search over texts, Lucene syntax allowed | from the item's licence URL, or public-domain before 1900, otherwise unknown |

Drafts land in `src/data/library/imported/<source>/` (gitignored) with
`confidence: "auto-imported"` and a placeholder summary. The site never reads
that folder. Responses are cached for a day under `scripts/library-import/.cache/`.

## Reviewing a draft

1. Open the link. Confirm it is the work you expect and that it is readable.
2. Confirm the licence. "unknown" must become a real value or the draft is
   deleted. Nothing is hosted; this is about linking honestly.
3. Replace the placeholder summary with one plain paragraph: what the work
   is, who wrote it, why a reader of this section would care. The promote
   step refuses a draft whose summary is still the placeholder.
4. Check `year`, `language`, `categories`, and add `relatedEvents` ids where
   an event on the timeline matches.
5. Promote in batches of about ten per pull request.

## Why not DOAB or OAPEN

Both directories of open access books refuse API requests from some
addresses. Their books can still be added by hand with a `cc-by` or similar
licence when the book page states it.
