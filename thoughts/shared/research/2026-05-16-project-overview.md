---
date: 2026-05-16T00:00:00+00:00
researcher: mdrafsunsheikh
git_commit: 6a8e642
branch: main
repository: The-Chronicle-of-Light
topic: "The Chronicle of Light - Project Overview and Architecture Documentation"
tags: [research, codebase, project-overview, architecture, islamic-history]
status: complete
last_updated: 2026-05-16
last_updated_by: mdrafsunsheikh
---

# Research: The Chronicle of Light - Project Overview and Architecture Documentation

**Date**: 2026-05-16
**Researcher**: mdrafsunsheikh
**Git Commit**: `6a8e642`
**Branch**: main
**Repository**: The-Chronicle-of-Light

## Project Summary

**The Chronicle of Light** is an interactive web application for exploring Islamic history through three visualization modalities:

1. **Time-axis timeline** - A horizontally scrolling timeline with NMA-style card river layout
2. **Interactive map** - Geo-located markers using Leaflet with CARTO Voyager tiles
3. **3-D connections graph** - Force-directed visualization using react-force-graph-3d

The project is currently in **pre-launch / private** status, preparing for open-source release under dual licensing (MIT for code, CC BY-SA 4.0 for data).

## Repository Overview

### Project Structure

```
islamic_history_timeline_web_app/
├── src/
│   ├── App.tsx                          ← Top-level shell (stage + secondary section + modal)
│   ├── main.tsx                         ← Vite entry point
│   ├── index.css                        ← Tailwind imports + reduced-motion media query
│   ├── vite-env.d.ts                    ← Vite client types
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── FilterBar.tsx            ← Category / region / date filters
│   │   │   ├── IncidentCard.tsx         ← Card in the "All moments" grid
│   │   │   └── IncidentDetailModal.tsx  ← Full-bleed inline detail panel
│   │   ├── timeline/
│   │   │   ├── TimelineView.tsx         ← Time-axis layout + placement algorithm
│   │   │   ├── TimelineTopBar.tsx       ← Era navigation + red-square indicator
│   │   │   └── timeline.css             ← Stage / rail / card / slot styling
│   │   ├── map/
│   │   │   ├── MapView.tsx              ← Leaflet MapContainer + tile config
│   │   │   └── MapMarker.tsx            ← Per-incident divIcon marker
│   │   └── graph/
│   │       └── GraphView.tsx            ← 3-D force graph + label visibility
│   │
│   ├── hooks/
│   │   └── useIncidents.ts              ← Glob-loads events, filter state, derived lists
│   │
│   ├── types/
│   │   └── incident.ts                  ← HistoricalIncident, Media, Location types
│   │
│   └── data/
│       ├── event.schema.json            ← JSON Schema draft 2020-12
│       └── events/                      ← One JSON file per event (34 events currently)
│           ├── event-0610-revelation-of-the-quran.json
│           ├── event-0622-hijra-migration-to-medina.json
│           └── ...
│
├── scripts/
│   ├── validate-events.mjs              ← Schema + connections cross-ref checker
│   └── wikipedia-import/                ← Wikipedia/Wikidata importer
│       ├── README.md
│       ├── index.mjs
│       ├── wikipedia.mjs
│       ├── wikidata.mjs
│       └── transform.mjs
│
├── thoughts/
│   └── shared/
│       ├── plans/                       ← Implementation plans
│       └── research/                    ← Visual / library research notes
│
├── .github/
│   └── workflows/
│       └── ci.yml                       ← lint, build, validate-events on every PR
│
├── LICENSE                              ← MIT (code)
├── LICENSE-DATA                         ← CC BY-SA 4.0 (src/data/)
├── tailwind.config.js                   ← NMA palette tokens
├── eslint.config.js                     ← ESLint 10 flat config
├── tsconfig.json                        ← Strict TypeScript
└── vite.config.ts                       ← Minimal Vite config
```

## Technology Stack

| Concern | Choice |
|---|---|
| Build / dev server | **Vite 5** + **TypeScript 5** |
| UI | **React 18** functional components + hooks |
| Styling | **Tailwind CSS 3** (Public Sans typeface) |
| Timeline | Bespoke CSS scroller (NMA-style; replaced vis-timeline) |
| Map | **react-leaflet 4** on **Leaflet 1.9**, CARTO Voyager tiles |
| 3-D graph | **react-force-graph-3d** on **Three.js**, with **three-spritetext** for labels |
| Linting | **ESLint 10** flat config |
| Schema validation | **ajv** + **ajv-formats**, run from Node script |
| CI | GitHub Actions: lint, build, validate-events |

No backend. The app is a static SPA — events are bundled into the JS at build time via Vite's `import.meta.glob`.

## Data Model

### TypeScript Interface (`src/types/incident.ts`)

```typescript
interface Location {
  latitude: number;
  longitude: number;
  name: string;
}

interface Media {
  type: 'image' | 'video' | 'document';
  url: string;
  caption?: string;
}

interface HistoricalIncident {
  id: string;
  title: string;
  description: string;
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate?: string;
  location: Location;
  category: 'political' | 'religious' | 'cultural' | 'scientific' | 'military';
  connections: string[]; // Related incident IDs
  learningPath?: string;
  media?: Media[];
  dynasty?: string;
  region?: string;
}
```

### JSON Schema (`src/data/event.schema.json`)

The authoritative shape uses JSON Schema Draft 2020-12. Key validation rules:

- `id` pattern: `^event-[0-9]{4}-[a-z0-9-]+$` (4-digit zero-padded year + slug)
- `startDate` pattern: `^[0-9]{4}-[0-9]{2}-[0-9]{2}$` (always 4-digit year)
- `connections[]` must resolve to existing event IDs
- `confidence` field: `established` | `contested` | `legendary` | `auto-imported`
- `perspectives[]`: `sunni` | `shia` | `ibadi` | `academic` | `secular` (required for contested)

### Naming Convention

- ID format: `event-YYYY-slug` (4-digit zero-padded start year + hyphen + lowercase slug)
- Filename: `{id}.json` — ID, filename, and year prefix must all match
- Years are **always 4-digit zero-padded** (e.g., `0624-03-13` not `624-3-13`)
- This ensures alphabetical sort = chronological sort

## Component Architecture

### Data Flow

1. **`useIncidents` hook** (`src/hooks/useIncidents.ts`) is the single data entry point
   - Uses Vite's `import.meta.glob` to load all `src/data/events/*.json` at build time
   - Sorts numerically by `startDate` (defensive against 3-digit vs 4-digit year inconsistency)
   - Exposes filtered + unfiltered lists
   - Holds filter state: category, region, date range, selected era

2. **`App.tsx`** orchestrates the page layout:
   - Timeline section (full-bleed stage at top)
   - Secondary section (filters, map, graph, card grid)
   - Modal (mounted conditionally when incident selected)

3. **All visualization components** read from the hook's `incidents` prop

### Timeline Component (`src/components/timeline/TimelineView.tsx`)

The timeline uses a bespoke CSS scroller (not vis-timeline) with the following implementation:

**Placement Algorithm** (`placeEra` function):
- Sorts events chronologically within each era
- Computes `idealX = (year - firstYearInEra) × PX_PER_YEAR` for each card
- Assigns top/bottom lane based on which lets the card sit nearest its ideal X without overlapping the previous card in that lane
- Constants: `PX_PER_YEAR = 28`, `LANE_GAP = 16`, `ERA_RIGHT_BUFFER = 24`

**Card Variant Selection**:
- Deterministically randomized per `id` using `hashString(id) % CARD_VARIANTS.length`
- 10 variants with different width/height combinations for visual variety

**Era Grouping**:
- ERAS array: `['earlier', '600', '700', ..., '2000']`
- `bucketize()` function maps ISO date to era ID
- Each era renders with its own tracks width based on placed cards

### Map Component (`src/components/map/MapView.tsx`)

- Uses `react-leaflet` `MapContainer` with center `[30, 45]`, zoom `3`
- CARTO Voyager tiles: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`
- No API key required
- Markers are uniform teal `#1B8A87` divIcons (no per-category color palette)
- Time range filter applied client-side

### Graph Component (`src/components/graph/GraphView.tsx`)

- Uses `react-force-graph-3d` (Three.js + WebGL)
- Nodes: spheres sized by `connections.length`
- Links: directional particles animating from source to target
- Labels: `SpriteText` children with visibility based on camera distance (`LABEL_VISIBLE_DISTANCE = 160`)
- Auto-rotation enabled (`autoRotateSpeed = 0.6`)
- Click-to-fly camera focus on node click
- Category colors: `political=#3B82F6`, `religious=#10B981`, `cultural=#8B5CF6`, `scientific=#F59E0B`, `military=#EF4444`

### Detail Modal (`src/components/common/IncidentDetailModal.tsx`)

- Full-bleed inline panel (not centered dialog)
- Two-column layout: hero image + caption left, text right
- Date kicker in uppercase prose format
- Teal headline (`#1B8A87`)
- Disabled "Read more" CTA button (stub for future article pages)
- Circular `×` close button top-right
- `Escape` key closes modal
- Body overflow hidden when open

### Filter Bar (`src/components/common/FilterBar.tsx`)

- Four-column grid: category select, region select, start date, end date
- All inputs controlled by `useIncidents` state

## Timeline Visual Design (NMA Style)

The timeline replicates the National Museum of Australia *Defining Moments* timeline:

**Stage**:
- Dark olive background (`#4A4B2A`)
- Navy logo gutter on top-left (`#0C2230`)
- Continuous dashed rail at vertical centerline (`#CBD5E1`)

**Top Bar**:
- White background with bottom border
- Era markers: `Earlier`, `600`, `700`, ..., `2000`
- Active era has red-square indicator (`#E2231A`) with `›` character

**Card River**:
- Two lanes (top/bottom) around centerline
- Cards positioned by time on X axis
- Large teal century markers (`#1B8A87`) on centerline
- Cards are either image-based (dark overlay) or text-based (white card)

**Card Styles**:
- Image cards: full-bleed image, gradient overlay, white text
- Text cards: white background, slate text, bottom border
- Deterministic size variant per `id`

## Scripts

### Event Validator (`scripts/validate-events.mjs`)

Validates every event file against the schema and checks connection integrity:

1. Parses each JSON file
2. Validates against `event.schema.json` using `ajv`
3. Checks unique IDs
4. Checks filename matches `id`
5. Checks `id` year prefix matches `startDate` year
6. Checks `endDate` >= `startDate`
7. Checks `sources[]` present for `auto-imported` or `contested` confidence
8. Checks `perspectives[]` present for `contested` confidence
9. Checks all `connections[]` IDs resolve to existing events

### Wikipedia Importer (`scripts/wikipedia-import/`)

Imports events from Wikipedia/Wikidata in a 4-stage pipeline:

1. Reads linked article titles from a Wikipedia timeline page (MediaWiki API)
2. Batch-resolves titles to Wikidata QIDs (MediaWiki `prop=pageprops`)
3. One SPARQL query filters QIDs that have both date (P585/P580) and coordinates (P625)
4. Fetches Wikipedia summaries (REST API) only for survivors

Output: Draft events written to `src/data/events/imported/` with `confidence: "auto-imported"`

Key flags:
- `--page`: Wikipedia article title (default: `Timeline_of_the_history_of_Islam`)
- `--max`: Cap on events to write (default: 25)
- `--depth`: BFS recursion hops (default: 0)
- `--dry-run`: Print without writing
- `--ignore-existing`: Don't skip existing titles/QIDs

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs three jobs in parallel:

| Job | Command | Failing means |
|---|---|---|
| `lint` | `npm run lint` | Code quality / TypeScript issue |
| `build` | `npm run build` | Type error or bundler error |
| `validate-events` | `npm run validate:events` | Schema violation or dangling connection |

All jobs use Node 20, `npm ci` for installs, and run on `pull_request` and pushes to `main`.

## npm Scripts

| Command | Description |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | `tsc && vite build` — type-check then bundle to `dist/` |
| `npm run preview` | Serves `dist/` build locally |
| `npm run lint` | ESLint over `src/` |
| `npm run validate:events` | Schema + connections validation |
| `npm run import:wikipedia` | Run Wikipedia importer |

## Licensing

**Dual licensing**:
- **Code** (everything except `src/data/`): **MIT** (`LICENSE`)
- **Dataset** (`src/data/events/*.json` and schema): **CC BY-SA 4.0** (`LICENSE-DATA`)

CC BY-SA 4.0 was chosen for the dataset because it matches Wikipedia's license. Imported events record their Wikipedia URL in `sources[]`, satisfying attribution requirements.

## Historical Context (from thoughts/)

- `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md` — Initial library survey (vis-timeline, Leaflet, Leaflet.TimeDimension, React Flow)
- `thoughts/shared/plans/2026-05-13-islamic-history-timeline-web-app.md` — Original 5-phase build plan
- `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md` — Editorial pass for NMA-style timeline
- `thoughts/shared/plans/2026-05-15-open-source-launch-plan.md` — Pre-launch OSS checklist
- `thoughts/shared/plans/2026-05-15-nma-defining-moments-timeline-implementation.md` — Phase-by-phase NMA replication plan
- `thoughts/shared/research/2026-05-15-nma-defining-moments-timeline-visual-replication.md` — NMA visual design analysis

## Recent Git History

```
6a8e642 docs: rewrite README for incoming teammates
2d4c6b8 feat(importer): --depth flag adds BFS recursion through Wikipedia link graph
22435aa fix(data): 4-digit year padding + numeric sort to fix chronological ordering
9324e7b fix(timeline): true time-axis positioning so X tracks date
6f0dd0d fix(timeline): chronological column pairing instead of independent lanes
7553a30 refactor(importer): Path 2 — pre-filter via Wikidata before fetching summaries
a320847 refactor(data): year-based event ids + --ignore-existing import flag
6a7409f feat(data): per-event file split + JSON Schema + CI + Wikipedia importer
20b01eb feat: NMA-style timeline + 3D event graph + OSS prep
47383d1 First Comit
```

## Current State Summary

- **34 events** in `src/data/events/`
- **Fully functional** timeline, map, and 3-D graph visualizations
- **CI pipeline** with three green jobs
- **Pre-launch status** — preparing for OSS release
- **No backend** — static SPA with bundled JSON data
- **PR-driven content workflow** — event additions/edit via GitHub PRs

## Code References

| File | Purpose |
|---|---|
| `src/App.tsx` | Top-level shell with stage + secondary section + modal |
| `src/hooks/useIncidents.ts` | Single data entry point with filter state |
| `src/types/incident.ts` | HistoricalIncident TypeScript interface |
| `src/data/event.schema.json` | JSON Schema Draft 2020-12 for event validation |
| `src/components/timeline/TimelineView.tsx` | Time-axis layout with placement algorithm |
| `src/components/timeline/TimelineTopBar.tsx` | Era navigation with red-square indicator |
| `src/components/timeline/timeline.css` | Stage, rail, card, slot styling |
| `src/components/map/MapView.tsx` | Leaflet MapContainer with CARTO tiles |
| `src/components/map/MapMarker.tsx` | Per-incident teal divIcon marker |
| `src/components/graph/GraphView.tsx` | 3-D force graph with SpriteText labels |
| `src/components/common/IncidentDetailModal.tsx` | Full-bleed inline detail panel |
| `src/components/common/FilterBar.tsx` | Category/region/date filters |
| `src/components/common/IncidentCard.tsx` | Card in "All moments" grid |
| `scripts/validate-events.mjs` | Schema + connections validator |
| `scripts/wikipedia-import/index.mjs` | Wikipedia importer orchestrator |
| `tailwind.config.js` | NMA palette tokens |
| `eslint.config.js` | ESLint 10 flat config |
| `.github/workflows/ci.yml` | CI pipeline definition |

## Related Research

- `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md` — Initial library research
- `thoughts/shared/research/2026-05-15-nma-defining-moments-timeline-visual-replication.md` — NMA visual design analysis

## Open Questions

None at this time — this is an overview document. Follow-up research can be added as needed.
