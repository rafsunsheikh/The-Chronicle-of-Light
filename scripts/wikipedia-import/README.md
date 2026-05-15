# Wikipedia → Chronicle of Light importer

A small Node script that turns the linked articles on a Wikipedia timeline
page (default: *Timeline of the history of Islam*) into draft event
records under `src/data/events/imported/`.

## Why this exists

Curating events by hand is slow. Wikipedia + Wikidata already have most
of what we need (date, location, type, image) as structured data. This
script:

1. Reads the linked article titles from a Wikipedia timeline page
   (MediaWiki API)
2. Fetches each article's summary + Wikidata QID (REST API)
3. Issues one batched SPARQL query for all QIDs (Wikidata)
4. Maps the result into the event schema at `src/data/event.schema.json`
5. Writes draft files with `confidence: "auto-imported"` for human
   review

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
  --page "Timeline_of_the_history_of_Islam" \
  --max 10 \
  --dry-run
```

Then drop `--dry-run` to write files:

```bash
node scripts/wikipedia-import/index.mjs --max 25
```

### Flags

| Flag       | Default                              | Description |
|------------|--------------------------------------|-------------|
| `--page`   | `Timeline_of_the_history_of_Islam`   | Wikipedia article whose outgoing links to import |
| `--max`    | `25`                                 | Cap on new candidates to fetch in one run |
| `--dry-run`| off                                  | Print what would be written; don't touch the filesystem |

## Output

Each run writes files like:

```
src/data/events/imported/
  event-017-<slug>.json
  event-018-<slug>.json
  ...
```

Files use the next sequential ID after the highest existing
`event-NNN` across both `src/data/events/` and
`src/data/events/imported/`.

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
