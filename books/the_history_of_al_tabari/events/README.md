# Datable events extracted from *The History of al-Tabari*

Three-stage pipeline (run from `..`):

```
parse_events.py     cleaned_text/      -> events/events.json          (titles + dates)
link_descriptions.py events.json       -> events/events.linked.json   (+ description, + leidenPage)
enrich_events.py    events.linked.json -> events/events.enriched.json (+ location + category)
connect_events.py   events.enriched.json (in place) + events/sequences.json  (+ connections)
to_app_events.py    events.enriched.json -> src/data/events/tabari/*.json  (web-app schema)
```

The final stage converts each event into the web app's per-file `HistoricalEvent`
schema (category 8→5 mapping, zero-padded dates, `event-YYYY-slug` ids, remapped
connections, provenance in `sources`) so the React/Leaflet timeline+map+graph UI
renders them. After re-running the pipeline: `python3 to_app_events.py` then, from
the repo root, `npm run validate:events && npm run build`.

- `link_descriptions.py` locates each event's narrative by matching its title to
  a body section heading (sequentially, since the ToC and body share order) and
  pulls the opening sentences as a `description`. Print page numbers don't survive
  into the body (the header cleaner stripped them), so matching — not page lookup
  — is how events are linked.
- `enrich_events.py` resolves place names against the local curated gazetteer
  `../gazetteer.json` (built by `../build_gazetteer.py`) — **no external geocoding
  service** — first from the title, then from the description, and tags each event
  with a category by keyword rules.

## Files

- `events.json` — base events from the parser, sorted by Hijri year then volume.
- `events_by_volume/Volume_NN.json` — the base events split per volume.
- `events.linked.json` — base events + `description` (intermediate).
- **`events.enriched.json`** — the dataset the app should consume: every event
  plus `description`, `location` (when geocoded), and `category`/`tags`.
- `../gazetteer.json` — 123 medieval Islamic-world places (name, type, modern
  name, lat/lon, aliases).
- `sequences.json` — 87 narrative threads `{id, type: person|place, label,
  eventIds[]}` (events sharing a distinctive figure or a location, in order).

## What's in it

**1,091 events** spanning **AH 1–301 (622–914 CE)** — the full chronological
reach of al-Tabari's annals, from the Hijra to the early 10th century.

al-Tabari is an *annalistic* chronicle: from the Hijra onward it is organized
year-by-year ("The Events of the Year N"), and each volume's Table of Contents
lists the named episodes of every year with page numbers. The parser mines that
ToC for event titles and anchors each to a Gregorian date taken from the body
year-headings.

Volumes that are pre-Hijra narrative (1–6: Creation → Sasanids → pre-Islamic
Arabia) or biographical/reference (39: Companions; 40: Index) are not annalistic
and yield no events — expected, not a gap.

## Record schema

```jsonc
{
  "id": "tabari-v13-16-008",        // tabari-v<volume>-<hijriYear>-<seq>
  "title": "The Report about the Battle of Jalula'...",
  "description": "According to ...", // opening of the narrative (or "" if unlinked)
  "titleMatchTokens": 4,             // leading title tokens that aligned to the body heading
  "hijriYear": 16,                   // AH, derived from the CE date (OCR-robust)
  "ceLabel": "637–638",              // human-readable CE label
  "startDate": "637",                // ISO: "YYYY" or "YYYY-MM-DD"
  "endDate": "638",                  // ISO or null
  "datePrecision": "year-range",     // see below
  "location": {                      // null if no place resolved from the title
    "name": "Jalula",
    "lat": 34.27, "lon": 45.16,
    "type": "battle",                // city | region | battle | river | site
    "modern": "Jalawla, Iraq",
    "matchedVia": "locative"         // 'locative' (after at/in/near) | 'mention' | 'description'
  },
  "category": "battle",              // primary category (below)
  "tags": ["battle"],                // all categories whose keywords matched
  "sequenceIds": ["person:al-hajjaj-b-yusuf-691", "place:al-kufah-640"],
  "connections": [                   // neighbours in each shared thread
    {"id": "...", "relation": "previous", "via": "al-Hajjaj b. Yusuf (691–722 CE)", "viaType": "person"},
    {"id": "...", "relation": "next",     "via": "al-Kufah (640–877 CE)",          "viaType": "place"}
  ],
  "source": {
    "work": "The History of al-Tabari",
    "volume": "13",
    "page": 36,                      // print page in the SUNY volume
    "leidenPage": 1391,              // Leiden-edition page where the section starts (when found)
    "ceRaw": "637/638"               // raw CE string from the body heading
  }
}
```

### Coverage (1,087 events)

- **Dated:** 100% (208 day-exact, 728 year-range, 110 year, 41 estimated).
- **Described:** 667 (61%) linked to their body narrative.
- **Geocoded:** 463 (42%) — 199 locative + 133 mention (from title) + 131 from
  the description.
- **Categories:** `battle` 228 · `succession` 120 · `death` 118 · `revolt` 70 ·
  `religion` 52 · `construction` 4 · `diplomacy` 4 · `general` 491.

### Geocoding notes

Matching is whole-word on a normalized form (diacritics stripped, `al-`/`the`
dropped), so a place never matches inside a longer word — e.g. "Marw" (Merv)
never matches inside "Marwan". Verified: zero Marw/Marwan false positives;
reference coordinates exact. Title matches (`locative`/`mention`) are highest
precision; `description` matches use the first place named in the opening
narrative and are slightly looser for biographical sections — filter on
`location.matchedVia` if you need only the strongest.

### `datePrecision` values

| value               | meaning                                                   | count |
|---------------------|-----------------------------------------------------------|-------|
| `day`               | exact start (and often end) day, e.g. `750-08-08`         | 208   |
| `year-range`        | CE start & end year from the body heading                 | 728   |
| `year`              | single CE year from the body heading                      | 89    |
| `year-from-toc`     | CE year taken from the Table-of-Contents anchor           | 21    |
| `estimated-from-AH` | no CE found; Gregorian year estimated from the Hijri year | 45    |

Date integrity has been validated: every event falls in 622–914 CE and the
AH↔CE offset is within the expected lunar/solar drift (median 0.27 yr, max 0.6).

### Connections / sequences

**517 events (47%) belong to at least one thread.** Person threads use only
distinctive figures (regnal epithets like `al-Mansur`, or full ibn-chains like
`Marwan b. Muhammad`); bare common names (`Marwan`, `'Abd al-Malik`) are excluded
because they recur across unrelated people. A thread also splits when consecutive
events are >45 yr apart, so a reused name separates into distinct threads. Place
threads group all events at one location chronologically.

## Known limitations & next steps

- **Description linkage is 61%.** The rest are events whose body section has no
  heading that prefix-matches the ToC title (narrative-style volumes weave events
  into continuous prose) — those keep `description: ""`.
- **~45 titles (≈4%) carry a trailing fragment** from two ToC entries that OCR
  merged onto one line (e.g. `"Affair of Abu Qays / 114 Expeditions..."`). The
  date and category are unaffected.
- **Sparse-ToC volumes** (e.g. Vol 29) list mostly bare years with few named
  episodes, so they contribute few events; the per-year narrative still lives in
  `../cleaned_text/` and could be segmented into year-container records later.
- The gazetteer is hand-curated and approximate (region entries use a centroid).
  Add places/aliases in `../build_gazetteer.py` and re-run the pipeline.
