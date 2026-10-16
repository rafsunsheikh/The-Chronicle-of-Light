# Extract events from a book

Four stages turn a converted book into timeline events. A script does the
mechanical parts; a Claude agent does the reading; a person decides what
ships.

```
npm run convert -- <book>            content/<private|books>/<slug>/content.md
npm run extract:chunk -- <content.md>   -> <book>/extract/chunks/NNN.md + chunks.json
/extract_events <content.md>            -> <book>/extract/candidates/NNN.json   (the agent, one chunk each)
npm run extract:draft -- <content.md>   -> src/data/events/imported/<slug>/*.json + <book>/extract/report.md
npm run extract:promote -- <slug> --all -> src/data/events/<slug>/*.json, then validate
```

## Stage by stage

**Chunk** (`chunk.mjs`). Cuts the Markdown at headings, merges short sections
and splits long ones at paragraph breaks, so each chunk is under about 12,000
characters. Every chunk file starts with a comment naming the book, the
heading and the page range, and keeps the `<!-- page N -->` markers inside.

**Extract** (the `history-extractor` agent, driven by `/extract_events`). One
agent per chunk reads `prompts/system.md` and `prompts/extract.md`, then the
chunk, and writes a JSON array of candidate events: title, description,
date and its precision, the words the date came from, the place as the text
spells it, category, people, a verbatim evidence quote and the page. The
agent never reads other chunks and never writes anywhere else.

**Draft** (`draft.mjs`). Builds one file per candidate that matches
`src/data/event.schema.json`:

- `id` is `event-YYYY-slug`, unique against every existing event.
- Dates are zero-padded; year-only dates become 1 January and the
  description says the source dates it to the year.
- `location` comes from the gazetteer at
  `books/the_history_of_al_tabari/gazetteer.json`, matched on the place the
  text names, then the place hint, then the title. No external geocoding.
  Unlocated drafts are listed in the report.
- `sources[0]` cites author, title, section heading and page, with the
  source URL and retrieval date when the book came from a URL.
- `connections` keeps the agent's suggestions that point at real events, then
  adds up to two curated events at the same place within 25 years, marked
  "heuristic" in the report.
- `confidence` is `auto-imported`.

The imported folder for the book is rewritten on every run. It is gitignored,
so drafts never reach the site or CI, but `npm run validate:events` does
check them locally and the dev server shows them.

**Promote** (`promote.mjs`). Moves the drafts you keep to
`src/data/events/<slug>/`, optionally flipping confidence to `established`,
and runs the validator. Open a pull request with the result.

## Reviewing

Read `<book>/extract/report.md`. For each draft check the date against the
evidence quote, confirm the place, and trim the description. Delete drafts
that are background rather than events. A place the gazetteer lacks is best
fixed by adding it to the gazetteer and re-running `extract:draft`, which
fixes every draft that names it.

## Running the model elsewhere

The prompts are plain Markdown so a headless runner (Phase 7) can send the
same system and per-chunk text through `claude -p` and write the same
candidate files. Nothing in `draft.mjs` depends on who produced them.
