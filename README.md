# The Chronicle of Light

An interactive web application for exploring Islamic history through a
time-axis timeline, a geolocated map of events, and a 3-D force-directed
graph of connections between them. 

> **Status:** open-source. MIT license for code, CC BY-SA 4.0 for the
> dataset. See [Contributing](#contributing) to add events, fix bugs, or
> suggest features.
>
> **Live demo:** https://the-chronicle-of-light.vercel.app
> (also mirrored at https://rafsunsheikh.github.io/The-Chronicle-of-Light/)

## Contents

- [What's here](#whats-here)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Accounts & the contribution workflow](#accounts--the-contribution-workflow)
- [Repo layout](#repo-layout)
- [Available npm scripts](#available-npm-scripts)
- [The data model](#the-data-model)
- [The Islamic Renaissance section and the library](#the-islamic-renaissance-section-and-the-library)
- [Adding or editing an event](#adding-or-editing-an-event)
- [The Wikipedia importer](#the-wikipedia-importer)
- [Converting source material to Markdown](#converting-source-material-to-markdown)
- [Extracting events from a book with Claude](#extracting-events-from-a-book-with-claude)
- [Architecture notes](#architecture-notes)
- [Contributing](#contributing)
- [Continuous integration](#continuous-integration)
- [Licensing](#licensing)
- [Where to find more context](#where-to-find-more-context)

## What's here

**UI features (already working on `main`)**

- **Time-axis timeline** with a continuous dashed rail, teal century
  markers (`Earlier`, `600`, `700`, …, `2000`), and a top bar with a
  small red arrow indicator under the active era. Cards are positioned
  along the X axis by their `startDate` (so closer-in-time events sit
  visually closer); top/bottom lanes are assigned only to avoid overlap.
  Card shapes are deterministically randomized per `id` for visual
  variety.
- **Floating detail page** with a full-bleed two-column NMA-style layout
  (hero image + caption left, date / teal headline / body right). Animates
  in/out and closes on `Escape` or the circular `×`. Includes a
  **Suggest an edit** button for signed-in users.
- **Interactive map** using CARTO Voyager tiles (English place labels
  worldwide, no API key). Markers are category-coloured divIcons; hovering
  a marker shows a small preview card, and clicking the marker or card
  opens the detail page floating over the map.
- **3-D Event Connections graph** rendered by `react-force-graph-3d`
  (Three.js + WebGL): force-directed nodes on a **white** background,
  vivid category-coloured spheres sized by connection degree, animated link
  particles, sprite text labels that fade in as the camera approaches a
  node, click-to-fly camera focus.
- **Global event search** in the nav bar (matches title, description,
  region, dynasty, category, place) plus a **filter bar** (category,
  region, date range) on the map, connections, and "All moments" views.
- **Islamic Renaissance section** (`/#/renaissance`): an introduction to
  the period (about 750 to 1400), nine subject tiles, a filterable grid of
  open books and articles, and the timeline moments in that range. Each
  resource has its own page at `/#/library/<id>`.

**Accounts & contributions**

- **Google sign-in** with an account menu in the nav bar.
- **Propose edits / new events** in-app; submissions are stored as
  *pending* and never change the live data until approved.
- **My contributions** dashboard — your submissions with
  pending/approved/rejected status, plus withdraw.
- **Review queue** (maintainers only) — proposed-vs-current diff with
  approve/reject; approvals go live immediately.
- See [Accounts & the contribution workflow](#accounts--the-contribution-workflow).

**Tooling**

- JSON Schema (`src/data/event.schema.json`) validated against every
  event in CI.
- Cross-reference validator that asserts every `connections[]` ID
  resolves to an existing event.
- Wikipedia → events importer with optional `--depth` recursion through
  the Wikipedia link graph.
- Supabase seed + a scheduled GitHub Action that mirrors the database
  back into the repo.
- ESLint flat config, TypeScript strict mode, GitHub Actions CI.

## Tech stack

| Concern | Choice |
|---|---|
| Build / dev server | **Vite 5** + **TypeScript 5** |
| UI | **React 18** functional components + hooks |
| Styling | **Tailwind CSS 3** (Public Sans typeface) |
| 3-D graph | **react-force-graph-3d** on **Three.js**, with **three-spritetext** for in-scene labels |
| Map | **react-leaflet 4** on **Leaflet 1.9**, CARTO Voyager tiles |
| Timeline | bespoke CSS scroller (NMA-style; replaced an earlier vis-timeline restyle) |
| Backend | **Supabase** (Postgres + Auth + row-level security) via **@supabase/supabase-js** |
| Hosting | **Vercel** (primary) and **GitHub Pages** (mirror); `base` switches automatically |
| Linting | **ESLint 10** flat config (`eslint.config.js`) |
| Schema validation | **ajv** + **ajv-formats**, run from a Node script |
| CI | GitHub Actions: lint, build, validate-events (+ a scheduled Supabase→repo backup) |

The canonical corpus lives in a Supabase `events` table that the app reads
live; the bundled JSON (`import.meta.glob`) provides an instant first paint
and an offline fallback, and is kept in sync by the backup job. With no
Supabase credentials configured the app still runs read-only off the bundled
JSON, with sign-in and contributions hidden.

## Quick start

```bash
# 1. Prerequisites
#    Node.js 20+ (anything ≥ 18 will probably work; CI uses 20)
#    npm (the project commits package-lock.json)

# 2. Clone and install
git clone git@github.com:rafsunsheikh/The-Chronicle-of-Light.git
cd The-Chronicle-of-Light
npm install

# 3. Run the dev server
npm run dev
#    → opens http://localhost:5173 (or 5174 if 5173 is busy)
#    Hot reload picks up edits in src/

# 4. Sanity-check before committing
npm run lint
npm run validate:events
npm run build
```

That's the whole flow for visual/code work — the dev server runs read-only
off the bundled JSON with no env setup. To exercise **sign-in and the
contribution workflow** locally, copy `.env.example` to `.env`, fill in your
Supabase URL + anon key, and follow [`docs/SETUP.md`](docs/SETUP.md).

## Accounts & the contribution workflow

The app reads its corpus from a Supabase `events` table and accepts community
contributions through a moderated workflow:

1. A signed-in user opens an event → **Suggest an edit**, or clicks
   **Add event** on the timeline, and submits the form.
2. The proposal is saved as a **pending** submission (`event_submissions`); it
   does **not** change the live data.
3. The contributor tracks status under **My contributions** (`/dashboard`).
4. A **maintainer** opens the **Review queue** (`/review`), inspects the
   proposed-vs-current field diff, and **approves** (upserts into `events` — live
   at once) or **rejects** with a note.
5. A scheduled GitHub Action mirrors the `events` table back into
   `src/data/events/*.json`, so git stays a recent backup of the corpus.

Roles live on the `profiles` table (`contributor` | `maintainer`); the first
maintainer is promoted with one SQL statement. Full provisioning steps —
Supabase project, migrations, Google OAuth, seeding, Vercel, and the backup
job — are in [`docs/SETUP.md`](docs/SETUP.md).

## Repo layout

```
.
├── src/
│   ├── App.tsx                          ← top-level shell (stage + secondary section + modal)
│   ├── main.tsx                         ← Vite entry
│   ├── index.css                        ← Tailwind imports + reduced-motion media query
│   ├── vite-env.d.ts                    ← Vite client types (for import.meta.glob)
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── NavBar.tsx               ← tabs + global search + account menu
│   │   │   ├── AccountMenu.tsx          ← Google sign-in / account dropdown
│   │   │   ├── FilterBar.tsx            ← category / region / date filters
│   │   │   ├── IncidentCard.tsx         ← card in the "All moments" grid
│   │   │   ├── IncidentDetailModal.tsx  ← floating detail page (+ Suggest an edit)
│   │   │   └── EventFormModal.tsx       ← add/edit form → pending submission
│   │   ├── contrib/
│   │   │   ├── DashboardPage.tsx        ← "My contributions" (status + withdraw)
│   │   │   └── ReviewPage.tsx           ← maintainer review queue (diff + approve/reject)
│   │   ├── timeline/
│   │   │   ├── TimelineView.tsx         ← time-axis layout + placement algorithm
│   │   │   ├── TimelineTopBar.tsx       ← era nav + red-square indicator + Add event
│   │   │   └── timeline.css             ← stage / rail / card / slot styling
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Leaflet MapContainer + tile config
│   │   │   └── MapMarker.tsx            ← category-coloured divIcon + hover card
│   │   └── graph/
│   │       └── GraphView.tsx            ← 3-D force graph + label visibility
│   │
│   ├── hooks/
│   │   ├── useIncidents.ts              ← reads corpus from Supabase (JSON fallback), filter/search state
│   │   └── useHashRoute.ts              ← minimal hash router
│   │
│   ├── lib/
│   │   ├── supabase.ts                  ← Supabase client (null when unconfigured)
│   │   ├── auth.tsx                     ← AuthProvider + useAuth (Google, role)
│   │   ├── submissions.ts               ← create/list/approve/reject/withdraw submissions
│   │   └── eventStore.ts               ← form helpers (slugify, id gen, constants)
│   │
│   ├── types/
│   │   ├── incident.ts                  ← HistoricalIncident, Media, Location types
│   │   └── contribution.ts              ← Profile, EventSubmission, EventOverride types
│   │
│   └── data/
│       ├── event.schema.json            ← JSON Schema draft 2020-12
│       └── events/                      ← one JSON file per event (backup mirror of the DB)
│           ├── event-0610-revelation-of-the-quran.json   (34 at root)
│           └── tabari/…                                   (1,087 imported from al-Tabari)
│
├── scripts/
│   ├── validate-events.mjs              ← schema + connections cross-ref checker
│   ├── seed-supabase.mjs                ← one-time JSON → Supabase events table (service role)
│   ├── backup-from-supabase.mjs         ← Supabase events table → JSON files (used by the Action)
│   ├── _env.mjs                         ← .env loader shared by the Node scripts
│   └── wikipedia-import/                ← Wikipedia/Wikidata importer (see its own README)
│       ├── README.md                    ← detailed usage doc
│       ├── index.mjs                    ← BFS-capable orchestrator
│       ├── wikipedia.mjs                ← MediaWiki + REST API clients
│       ├── wikidata.mjs                 ← SPARQL client (chunked POST)
│       └── transform.mjs                ← Wikidata/summary → schema mapping
│
├── supabase/
│   └── migrations/
│       ├── 0001_contributions.sql       ← profiles, submissions, RLS, approve/reject RPCs
│       └── 0002_events_canonical.sql    ← canonical events table
│
├── docs/
│   └── SETUP.md                         ← backend / accounts / deployment guide
│
├── thoughts/
│   └── shared/
│       ├── plans/                       ← implementation plans (NMA timeline, OSS launch, etc.)
│       └── research/                    ← visual / library research notes
│
├── .github/
│   └── workflows/
│       ├── ci.yml                       ← lint, build, validate-events on every PR
│       └── backup-supabase.yml          ← daily Supabase → repo mirror (+ manual run)
│
├── eslint.config.js                     ← ESLint 10 flat config
├── tsconfig.json / tsconfig.node.json   ← strict TS
├── tailwind.config.js                   ← NMA palette tokens (stage, navy-nma, teal-nma, red-nma, …)
├── vite.config.ts                       ← minimal Vite config
├── LICENSE                              ← MIT (code)
├── LICENSE-DATA                         ← CC BY-SA 4.0 (src/data/)
└── package.json
```

## Available npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload. |
| `npm run build` | `tsc && vite build`. Type-checks then bundles to `dist/`. |
| `npm run preview` | Serves the `dist/` build locally. |
| `npm run lint` | ESLint over `src/`. CI runs the same command. |
| `npm run validate:events` | Checks every JSON file in `src/data/events/` against the schema, asserts unique IDs, filename ↔ id alignment, year-of-id ↔ year-of-startDate match, and that every `connections[]` ID resolves to a real event. |
| `npm run validate:library` | Checks every JSON file in `src/data/library/` against `library.schema.json`, plus the rules the schema cannot express: filename matches id, id year matches `year`, hosted entries have a redistributable licence and an existing `contentPath`, video entries carry a `video` block, and every `relatedEvents` id resolves to a real event. |
| `npm run validate` | Runs both validators. |
| `npm run import:wikipedia` | Run the Wikipedia importer. See `scripts/wikipedia-import/README.md`. |
| `npm run import:library -- --source <wikisource\|gutenberg\|openlibrary\|ia> --query "<q>" --category <cat>` | Finds open books and articles for the Renaissance library and writes drafts to `src/data/library/imported/` (gitignored) for review. See [`scripts/library-import/README.md`](scripts/library-import/README.md). |
| `npm run convert -- <file-or-url>` | Converts a PDF, EPUB, DOCX, TXT, Markdown or HTML source (file or URL) to Markdown with page or chapter markers, into `content/private/<slug>/` (gitignored) or, with `--public`, `content/books/<slug>/`. See [`scripts/convert/README.md`](scripts/convert/README.md). |
| `npm run extract:chunk -- <content.md>` | Splits a converted book into heading-aware chunks under `<book>/extract/chunks/` for the extractor agent. |
| `npm run extract:draft -- <content.md>` | Turns the agent's candidate lists into schema-valid draft events under `src/data/events/imported/<slug>/` (gitignored) plus a review report. |
| `npm run extract:promote -- <slug> --all` | Moves reviewed drafts into `src/data/events/<slug>/` and runs the validator. Add `--established` to flip confidence. |
| `npm run seed:supabase` | One-time: upsert every event JSON file into the Supabase `events` table. Needs `SUPABASE_SERVICE_ROLE_KEY`. See [`docs/SETUP.md`](docs/SETUP.md). |
| `npm run backup:supabase` | Pull the `events` table back into `src/data/events/*.json` (run by the scheduled GitHub Action; also runnable locally). |

## The data model

The canonical corpus is the Supabase `events` table; each row's `payload` is
one event object. The app fetches the table (paginated) and sorts numerically
by `startDate`. The same events are also stored **one file per event** at
`src/data/events/{id}.json` — bundled via Vite's `import.meta.glob` for an
instant first paint and offline fallback, and kept in sync with the table by
the [backup job](#accounts--the-contribution-workflow). The per-event JSON is
still the format you edit in PRs and the schema below applies to both.

### Schema

The authoritative shape is `src/data/event.schema.json` (JSON Schema
Draft 2020-12). The TypeScript type in `src/types/incident.ts` mirrors
it. Required fields:

```jsonc
{
  "id": "event-0624-battle-of-badr",
  "title": "Battle of Badr",
  "description": "First major military victory for Muslims against the Quraysh of Mecca.",
  "startDate": "0624-03-13",
  "endDate": "0624-03-13",
  "location": {
    "latitude": 26.5933,
    "longitude": 39.0267,
    "name": "Badr, Saudi Arabia"
  },
  "category": "military",
  "connections": ["event-0622-hijra-migration-to-medina"]
}
```

Optional fields the schema accepts:

- `learningPath`, `dynasty`, `region`
- `media[]` — image / video / document URLs
- `sources[]` — provenance records (citation, url, page, wikidata QID,
  retrieved date, license). Required when `confidence` is
  `"auto-imported"` or `"contested"`.
- `confidence` — `established` | `contested` | `legendary` |
  `auto-imported`. Importer-written events ship as `auto-imported`;
  reviewers flip to `established`.
- `perspectives[]` — `sunni` | `shia` | `ibadi` | `academic` | `secular`.
  Required when `confidence` is `contested`.

### Naming convention

- `id` is `event-YYYY-slug` (4-digit zero-padded start year + a
  hyphen-lowercase slug derived from the title).
- The filename is exactly `{id}.json` — id ↔ filename ↔ filename's year
  prefix ↔ startDate's year prefix are all enforced by the validator.
- Years are **always 4-digit zero-padded** (e.g., `0624-03-13` not
  `624-3-13`). This makes filename alphabetical sort match chronological
  sort, and avoids the lexicographic ordering bug that comes from
  mixing 3-digit and 4-digit year strings.

## The Islamic Renaissance section and the library

`/#/renaissance` is a top-level tab. It introduces the Islamic Golden Age
(roughly 750 to 1400) and lists **library resources**: books, reports,
articles, videos and courses about the period, each filed under one or more
of nine subjects (science and mathematics, astronomy, medicine, philosophy
and theology, literature and poetry, art and architecture, translation
movement, institutions, geography and travel). Clicking a moment on that
page opens the same detail panel as the timeline.

Resources follow the same rules as events: **one JSON file per resource**
at `src/data/library/{id}.json`, loaded with `import.meta.glob` by
`src/hooks/useLibrary.ts`, validated in CI against
`src/data/library.schema.json` by `npm run validate:library`. Unlike
events, resources live only in git; there is no Supabase table for them.

```jsonc
{
  "id": "lib-0830-the-algebra-of-al-khwarizmi",   // lib-YYYY-slug, YYYY = year
  "type": "book",                                  // book | report | article | video | course
  "title": "The Algebra of Mohammed ben Musa (al-Khwarizmi)",
  "creators": ["Muhammad ibn Musa al-Khwarizmi", "Frederic Rosen (translator)"],
  "year": 830,                                     // year the work was written or first published
  "language": "en",                                // language of the linked edition
  "categories": ["science-and-mathematics", "translation-movement"],
  "summary": "One paragraph in plain words.",
  "url": "https://archive.org/details/algebraofmohamme00khuwrich",
  "license": "public-domain",                      // see the schema for the full list
  "hosted": false,                                 // true only when the full text is in content/books/
  "source": { "name": "Internet Archive", "retrieved": "2026-10-16" },
  "relatedEvents": ["event-0830-house-of-wisdom-established"],
  "confidence": "established"                      // or auto-imported, for unreviewed drafts
}
```

**Videos.** A resource of type `video` carries `video: { provider, id }`
for YouTube, the Internet Archive or PeerTube. The `VideoEmbed` component
shows a poster image and a play button, and only creates the provider's
player (YouTube through `youtube-nocookie.com`) after the visitor clicks, so
opening a page sets no third-party cookies. An event can carry a video too:
a `media[]` entry of type `video` whose `url` is a YouTube, Archive or
PeerTube link plays in the detail panel. Videos are embedded and linked,
never downloaded or re-hosted, which is what the providers' terms allow.

**Reading library.** A resource with `hosted: true` and a `contentPath`
under `content/books/` can be read on the site at `/#/library/<id>/read`.
The reader renders the Markdown with a table of contents built from its
headings, shows the licence and source at the top, and offers the Markdown
for download. Each book is a separate lazily loaded chunk. Six public domain
books are hosted at the moment; the full list is in
[`content/books/README.md`](content/books/README.md).

**Licensing rule.** A resource is linked to its source unless its licence
allows redistribution, in which case its full text may be committed under
`content/books/` and `hosted` set to `true`. The validator refuses a hosted
entry whose licence does not allow it. Books from shadow libraries are not
accepted.

Adding a resource is the same pull-request workflow as adding an event:
create the file, run `npm run validate:library`, open a PR. To find
candidates, `npm run import:library` searches Wikisource (the 1911
Britannica), the Project Gutenberg catalogue, Open Library and the Internet
Archive and writes drafts to `src/data/library/imported/` (gitignored). A
reviewer writes each summary, confirms the licence and promotes with
`node scripts/library-import/promote.mjs`; the promote step refuses a draft
whose summary is still the placeholder. See
[`scripts/library-import/README.md`](scripts/library-import/README.md).

The roadmap for this section (open resource importer, video embeds, a
reading library, AI extraction) is tracked in
[issue #15](https://github.com/rafsunsheikh/The-Chronicle-of-Light/issues/15).

## Adding or editing an event

There are two paths:

**In-app (recommended for content contributors).** Sign in, open an event and
click **Suggest an edit**, or **Add event** on the timeline. Your submission is
queued for maintainer review; once approved it goes live and is later mirrored
back into the repo by the backup job. See
[Accounts & the contribution workflow](#accounts--the-contribution-workflow).
No local setup required — just an account on the live site.

**PR-driven (for code contributors editing the JSON directly).** The
per-event JSON files remain editable in git; this is the path below. Note the
files are a backup mirror of the database, so coordinate larger direct edits
with a maintainer to avoid being overwritten by a sync, or apply them through
the seed/backup tooling.

**To add an event:**

1. Pick a stable `id`: `event-YYYY-some-slug` (4-digit year + slug).
2. Create `src/data/events/{id}.json` containing the fields above.
3. Run `npm run validate:events` locally — it should report `✓ N
   event(s) validated, connections intact`. If it complains, fix what
   it says and re-run.
4. (Optional) `npm run dev` and verify the card shows up on the
   timeline / map / 3-D graph.
5. Open a PR. CI runs lint + build + validate-events.

**To edit an event:**

1. Edit the JSON file directly. Don't rename it unless you're also
   updating `id`, `startDate`'s year, and every `connections[]`
   reference that points to the old id.
2. Run `npm run validate:events`.
3. PR.

**To delete an event:**

1. Delete the file.
2. Grep for the id in other files' `connections[]` and remove those
   references. The validator will fail if any orphan references remain.
3. PR.

## The Wikipedia importer

For bulk seeding, `scripts/wikipedia-import/` walks the Wikipedia link
graph from a seed article, batch-resolves each linked article to a
Wikidata QID, runs one SPARQL query to filter down to QIDs that have
both a date and coordinates, then fetches Wikipedia REST summaries only
for the survivors. Drafts are written to `src/data/events/imported/`
(gitignored) with `confidence: "auto-imported"`.

Quick start:

```bash
export IMPORTER_USER_AGENT='The-Chronicle-of-Light-Importer/0.1 (https://github.com/rafsunsheikh/The-Chronicle-of-Light; your-email@example.com)'

# dry-run on the default seed at depth 1
npm run import:wikipedia -- --depth 1 --max 20 --dry-run

# real run when the dry-run output looks reasonable
npm run import:wikipedia -- --depth 1 --max 20
```

Then review the drafts (delete obvious false positives, fix
mis-categorized events, fill in `connections[]`, flip `confidence` to
`established`) and move the keepers from `src/data/events/imported/`
to `src/data/events/`. Open a PR with batches of ~10 promoted events at
a time.

**Full documentation** including all flags, recursion behaviour,
caching, politeness checklist, and the review workflow:
[`scripts/wikipedia-import/README.md`](scripts/wikipedia-import/README.md).

## Converting source material to Markdown

Every book, report or article becomes Markdown before any AI tool reads it,
and the same Markdown feeds the reading library. `scripts/convert/` does the
conversion:

```bash
npm run convert -- path/to/book.pdf                 # private: content/private/<slug>/
npm run convert -- path/to/book.epub --public       # public domain: content/books/<slug>/
npm run convert -- https://en.wikisource.org/wiki/1911_Encyclop%C3%A6dia_Britannica/Avicenna
```

Each output folder holds `content.md` (YAML front matter, then the text with
`<!-- page N -->` or `<!-- chapter N -->` markers so later stages can cite a
position) and `meta.json` (title, author, language, source, SHA-256, word and
heading counts). PDF text comes from the file's text layer, with running
headers and page numbers stripped and plain-text headings such as
`CHAPTER III` promoted to `##`. EPUB chapters follow the spine order. Web
pages go through Readability so only the article survives. Project Gutenberg
licence boilerplate is removed and the title and author are read from its
header.

Private output is gitignored: use it for your own copies of books you may
not redistribute. Only public domain and openly licensed texts go under
`content/books/` with `--public`. Scanned PDFs without a text layer need OCR
first; the script stops with a message when almost nothing comes out.
Full options and limits: [`scripts/convert/README.md`](scripts/convert/README.md).

## Extracting events from a book with Claude

A dedicated Claude Code agent reads a converted book one chunk at a time and
drafts timeline events from it. The pipeline lives in `scripts/extract/`
and runs from the `/extract_events` command:

```
npm run convert -- <book>                 Markdown with page markers
npm run extract:chunk -- <content.md>     chunks the agent can read one at a time
/extract_events <content.md>              one history-extractor agent per chunk -> candidates JSON
npm run extract:draft -- <content.md>     draft event files + extract/report.md
npm run extract:promote -- <slug> --all   move keepers into src/data/events/<slug>/
```

The agent (`.claude/agents/history-extractor.md`) follows two prompt files
under `scripts/extract/prompts/`: it reports only what the text states, dates
every event to at least the year in the Common Era, keeps the author's
spellings, and quotes the sentence that supports each event. The draft stage
gives each event a stable id, a `sources[]` entry naming author, title,
section and page, a location from the gazetteer at
`books/the_history_of_al_tabari/gazetteer.json`, and `connections` that the
validator checks. Drafts carry `confidence: "auto-imported"`.

Humans promote, machines draft: drafts are gitignored and nothing reaches
`src/data/events/` until someone reviews `extract/report.md` and runs the
promote step. Full details: [`scripts/extract/README.md`](scripts/extract/README.md).

## Architecture notes

A few things that aren't obvious from the file tree:

**`useIncidents` is the single data entry point.** It renders the bundled
JSON (globbed by Vite at build time) immediately, then fetches the full corpus
from the Supabase `events` table — paginated past PostgREST's 1,000-row cap —
and swaps it in. If Supabase is unreachable or the table is empty, it keeps the
bundled fallback. The hook sorts numerically by `startDate`, exposes filtered +
unfiltered lists, holds filter + search state, and exposes `refreshEvents()`
(called after an approval). All visualisation components read from this one
source.

**Timeline placement is data-driven.** `TimelineView.tsx::placeEra`
sorts events chronologically, then greedily walks them left-to-right,
computing each card's `idealX = (year − firstYearInEra) × PX_PER_YEAR`
and assigning whichever lane (top / bottom) lets the card sit nearest
its ideal X without overlapping the previous card in that lane.
Constants at the top of the file (`PX_PER_YEAR`, `LANE_GAP`,
`ERA_RIGHT_BUFFER`) tune visual density. Card shapes are picked
deterministically from a hash of `id` so they don't shuffle on rerender.

**The 3-D graph uses two layers per node**: the base sphere from
`react-force-graph-3d` (sized by `connections.length`), plus a
`SpriteText` label child added via `nodeThreeObjectExtend`. A
`controls.change` listener plus a per-frame polling interval show or
hide each label based on its distance to the camera, so labels appear
as you zoom in and disappear when you zoom out.

**The map renders CARTO Voyager tiles** (`{s}.basemaps.cartocdn.com/
rastertiles/voyager/...`) instead of vanilla OpenStreetMap so place
names are in English worldwide. No API key required. Markers are
category-coloured divIcons with a hover preview card (an interactive
Leaflet `Tooltip`); clicking the marker or the card opens the detail page,
which is layered above Leaflet's panes with a high `z-index`.

**Contributions are server-backed, auth-gated, and moderated.**
`lib/supabase.ts` lazily creates the client (or `null` when unconfigured);
`lib/auth.tsx` wraps the app in an `AuthProvider`. Edits/new events become rows
in `event_submissions` (status `pending`); approval runs the `approve_submission`
Postgres RPC (security-definer) which upserts into `events`. Row-level security
enforces that contributors only see their own submissions while maintainers see
all — see `supabase/migrations/`.

**CI is three Actions jobs** (`.github/workflows/ci.yml`): `lint`,
`build`, and `validate-events`, all on `pull_request` and pushes to
`main`. Each installs deps via `npm ci` with the Node 20 cache, runs
the corresponding npm script, and fails the PR on any non-zero exit. A
separate scheduled workflow (`backup-supabase.yml`) mirrors the database
into the repo daily.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute
events, code, or documentation. In short:

- **Content** is easiest contributed **in-app** — sign in and use
  *Suggest an edit* / *Add event*; a maintainer approves it. No git needed.
- The dataset is also editable via **PRs** — event additions, corrections,
  or `connections[]` enrichment (see the note in
  [Adding or editing an event](#adding-or-editing-an-event)).
- Code PRs: keep them focused. Run lint, build, and validate-events
  before pushing.
- Cite sources for new events. Mark contested events with
  `confidence: "contested"` and list `perspectives[]`.
- All PRs and submissions require maintainer approval before going live.

## Continuous integration

GitHub Actions runs three jobs in parallel on every push to `main` and
every PR:

| Job | What it does | Failing means |
|---|---|---|
| `lint` | `npm run lint` (ESLint 10 over `src/`) | code quality / TS issue |
| `build` | `npm run build` (`tsc && vite build`) | type error or bundler error |
| `validate-events` | `npm run validate:events` | a JSON file in `src/data/events/` doesn't match the schema, or a `connections[]` reference is dangling |

Workflow file: `.github/workflows/ci.yml`. All three must be green
before merge.

## Licensing

This project uses **dual licensing**:

- **Code** (everything except `src/data/`) → **MIT** (`LICENSE`)
- **Dataset** (`src/data/events/*.json` and the schema) → **Creative
  Commons Attribution-ShareAlike 4.0** (`LICENSE-DATA`)

CC BY-SA 4.0 was chosen for the dataset because it matches the license
on Wikipedia content — events imported via `scripts/wikipedia-import/`
record their Wikipedia URL in `sources[]`, satisfying the attribution
requirement. Anyone reusing the dataset must continue to ShareAlike.

## Where to find more context

If something in the codebase looks odd, the planning / research notes
in `thoughts/` usually explain why:

- `thoughts/shared/plans/2026-05-15-open-source-launch-plan.md` — full
  pre-public-release checklist and rationale.
- `thoughts/shared/plans/2026-05-15-nma-defining-moments-timeline-implementation.md`
  — phase-by-phase plan for the timeline redesign (NMA-style layout,
  randomized cards, red era indicator).
- `thoughts/shared/research/2026-05-15-nma-defining-moments-timeline-visual-replication.md`
  — visual reference research and design decisions.
- `scripts/wikipedia-import/README.md` — flag reference, recursion
  semantics, suggested seed pages, review workflow.
- [`docs/PUBLISHING.md`](docs/PUBLISHING.md): where the site runs, what it costs (nothing), the CI size budget, the Supabase backup, and when any of that would change.

For per-component design rationale (e.g., why timeline X positions are
computed instead of grid-based, why the 3-D graph uses Sprite labels
instead of HTML), check the comments at the top of the relevant file —
non-obvious decisions are documented inline.

## Acknowledgments

- **National Museum of Australia** — *Defining Moments* timeline
  (`https://www.nma.gov.au/defining-moments/defining-moments-timeline`)
  whose visual design this project deliberately echoes. References were
  used to set palette, typography, and the two-lane card-on-rail layout.
- **Wikipedia** and **Wikidata** contributors — source for event
  metadata via the importer. CC BY-SA 4.0; attribution recorded in each
  imported event's `sources[]`.
- **CARTO** — Voyager basemap tiles used by the map view.
