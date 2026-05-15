# Wikipedia → Chronicle of Light importer

A small Node script that turns the linked articles on a Wikipedia timeline
page (default: *Timeline of the history of Islam*) into draft event
records under `src/data/events/imported/`.

## Why this exists

Curating events by hand is slow. Wikipedia + Wikidata already have most
of what we need (date, location, type, image) as structured data. This
script:

1. Reads the linked article titles from a Wikipedia timeline page
   (MediaWiki API, 1 call)
2. Batch-resolves every title to a Wikidata QID
   (MediaWiki `prop=pageprops`, ~7 calls for ~334 titles)
3. Issues **one** SPARQL query against Wikidata that requires both a
   date (P585 or P580) and coordinates (P625 directly or on P276 →
   P625). Non-events (concepts, people, places without a date) drop out
   here
4. Fetches Wikipedia summaries (REST API) **only** for survivors of
   step 3 — that's typically 30–80 calls instead of one-per-link
5. Maps each into the event schema at `src/data/event.schema.json` and
   writes drafts with `confidence: "auto-imported"` for human review

The pipeline is designed so that the slowest stage (per-article REST
calls) only runs on QIDs we already know are real, locatable events.

It is **not** a substitute for editorial review. Auto-imported events
ship with mis-categorizations, wrong dates from Wikidata typos, and
contested claims unflagged. The draft directory exists so a human can
review before promoting.

## Licensing

Wikipedia content is **CC BY-SA 4.0** — the same license as
`src/data/` (see `LICENSE-DATA`). Each draft event includes a
`sources[]` entry pointing to the Wikipedia article + Wikidata QID +
retrieval date, satisfying the attribution requirement.

## Install

Run from repo root — uses the project's existing `package.json`:

```bash
npm install
```

No extra deps; the script uses Node's built-in `fetch` (Node ≥18).

## Set your User-Agent

Wikipedia requires a meaningful UA. Set this before running:

```bash
export IMPORTER_USER_AGENT='The-Chronicle-of-Light-Importer/0.1 (https://github.com/rafsunsheikh/The-Chronicle-of-Light; your-email@example.com)'
```

The script will warn if it's unset.

## Run it

Always start with a dry run on a small batch:

```bash
node scripts/wikipedia-import/index.mjs \
  --page "Early_Muslim_conquests" \
  --max 10 \
  --dry-run
```

Then drop `--dry-run` to write files:

```bash
node scripts/wikipedia-import/index.mjs --page "Early_Muslim_conquests" --max 25
```

### Picking a source page

Not every Wikipedia article is equally event-rich. The default
*Timeline of the history of Islam* article is structured as a **glossary**
of concepts (Caliphate, Sharia, Hadith, …) — its outgoing links don't
point to specific events, so the pipeline only finds ~4 multi-century
**periods** there (Al-Andalus, Islamic Golden Age, etc.).

Articles that heavily wikilink to specific events yield far more:

| Source page                         | Approx. event yield   |
|-------------------------------------|----------------------|
| `Early_Muslim_conquests`            | ~85 events           |
| `Muslim_conquest_of_the_Levant`     | dozens of battles    |
| `List_of_expeditions_of_Muhammad`   | every recorded raid  |
| `Rashidun_Caliphate`                | succession events    |
| `Abbasid_Caliphate`                 | political events     |
| `Crusades`                          | sieges, battles      |

Run the importer once per source page, accumulate drafts in
`src/data/events/imported/`, then review + promote. The `seen` /
`titles` set across runs prevents the same event from being imported
twice (turn off with `--ignore-existing` only on the very first run).

### Flags

| Flag                 | Default                              | Description |
|----------------------|--------------------------------------|-------------|
| `--page`             | `Timeline_of_the_history_of_Islam`   | Wikipedia article whose outgoing links to import |
| `--max`              | `25`                                 | Cap on events to **write** in one run (BFS may discover many more) |
| `--depth`            | `0`                                  | How many recursion hops to take past the seed page. `0` = only the seed page's outgoing links. `1` = also follow links of confirmed events found at depth 0. `2+` = one more hop per level (slow; produces many drafts). |
| `--dry-run`          | off                                  | Print what would be written; don't touch the filesystem |
| `--ignore-existing`  | off                                  | Don't skip articles whose title or Wikidata QID matches an already-curated event. Use on the **first run** to bring real Wikipedia data in even where placeholders exist; reviewer overwrites the placeholders during the imported/ → events/ promotion step. |

### Recursion (--depth)

The default is `--depth 0`: only follow the seed page's outgoing links.
With `--depth 1` (or higher) the importer wraps its 4-stage pipeline in
a **breadth-first crawl**:

```
depth 0: seed page's outgoing links
         ↓ batch-resolve QIDs → SPARQL filter → say 50 events confirmed
depth 1: links from those 50 events
         ↓ batch-resolve QIDs → SPARQL filter → say 300 more events
depth 2: links from those 300 events
         ↓ ... etc.
```

**Important:** only **confirmed events** become the next-depth frontier.
Concept articles like *Allah*, *Caliphate*, *Islam* are dead-ends for
crawling, so the BFS stays focused on the event subgraph and doesn't
drift into "everything Wikipedia knows about." Concept articles still
contribute their links **at the depth they were found**, but we don't
follow links out of *them*.

Performance notes:

- Depth 0 from a small seed: seconds.
- Depth 1 from `Early_Muslim_conquests` (1014 outgoing links): a few
  minutes on first run; subsequent runs are cached.
- Depth ≥ 2: many minutes to hours depending on the seed. Importer
  prints a warning at depth ≥ 2.
- All API responses are cached on disk, so re-runs with same flags are
  effectively free.

## Output

Each run writes files like:

```
src/data/events/imported/
  event-0624-battle-of-badr.json
  event-0680-battle-of-karbala.json
  ...
```

The id format is `event-YYYY-slug`, where `YYYY` is the 4-digit zero-padded
start year (so alphabetical sort = chronological sort) and `slug` is a
hyphenated lowercase derivation of the title. The filename is exactly
`{id}.json`. There is no sequential numbering — each event derives its
own id from its start date and title.

If a derived id collides with another event written in the same run,
the second one is skipped. Collisions with already-curated events are
gated by `--ignore-existing`: by default the importer skips them; pass
the flag on the first run to bring imports in alongside the
placeholders so a reviewer can overwrite them.

## Cache

All HTTP responses are cached on disk under
`scripts/wikipedia-import/.cache/` (gitignored). Re-running the same
command is offline-friendly and adds no Wikipedia load. To force a
refresh, delete the relevant cache file (or the whole cache dir).

## Review workflow

1. Run with `--dry-run` first to spot obvious problems
2. Run for real; new files land in `src/data/events/imported/`
3. Open a review branch and look at each new file:
   - Is the **category** correct? The heuristic is crude
     (battle→military, treaty→political, etc.) and mis-fires often
   - Is the **description** accurate and concise? The Wikipedia extract
     is truncated to ~280 chars; rewrite if it reads awkwardly
   - Is the **date** correct? Wikidata sometimes gives the wrong P31
     date (e.g. modern commemoration date instead of the event date)
   - Does the **location** make sense?
   - Are there obvious **connections** to other events that should be
     filled in?
   - For contested events: set `confidence: "contested"` and add a
     `perspectives` array
4. When an entry is ready: bump `confidence` to `"established"` and
   move the file from `src/data/events/imported/` to
   `src/data/events/`
5. Commit the move + edits as a focused PR (~10 events per PR keeps
   review tractable)

## Validation

Run before committing:

```bash
npm run validate:events
```

This validates every event file (including drafts in `imported/`)
against `src/data/event.schema.json` and checks that all
`connections` IDs resolve to existing events.

## Politeness checklist

- ✅ Identifying `User-Agent` (set via env var)
- ✅ ~0.8 s minimum interval between requests
- ✅ Single batched SPARQL query instead of one-per-item
- ✅ Disk caching so re-runs don't re-hit the APIs
- ❌ No retries on errors (failures are logged; surface to the user)

If you need to import a different timeline page (e.g. a regional or
era-specific timeline), pass `--page` with the article title and the
same logic applies.
