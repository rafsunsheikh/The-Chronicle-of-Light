# Open-Source Launch Plan — The Chronicle of Light

**Date:** 2026-05-15
**Author:** MD Rafsun Sheikh
**Status:** Step 1 (Cleanup pass) — in progress

## Framing

For an open-source historical-content project, **the dataset is the asset
and the contribution surface**. That changes a few decisions:

- The static JSON in `src/data/incidents.json` is not just a stepping
  stone toward Dexie/SQLite — it is the *right long-term shape* for OSS,
  because non-technical contributors (historians, students) will submit
  events as PRs editing JSON.
- Don't migrate the data layer away from JSON before going public; instead,
  harden it (schema, validation, per-event files).
- The contribution path for *event additions* matters more than the
  contribution path for *code*.

## Pre-launch hygiene

Done before the first public commit.

### Repo cleanup

- [ ] Add `dist/`, `node_modules/`, `*.log`, `.DS_Store` to `.gitignore`
- [ ] Untrack `dist/` and `node_modules/.vite/` (`git rm -r --cached`)
- [ ] Fix the broken `npm run lint` (eslint referenced in scripts but not
      installed in `devDependencies`)
- [ ] Delete unused deps: `vis-timeline`, `@xyflow/react`,
      `leaflet.timedimension` — all three are still in `package.json` but
      no longer imported after the NMA-timeline and 3D-graph refactors
- [ ] Remove their CSS imports from `src/index.css`

### Legal

- [ ] **MIT license for the code** — most permissive, popular for OSS
- [ ] **CC BY-SA 4.0 for the dataset** (`src/data/`) — Wikipedia-style
      dual licensing for code + content
- [ ] Add `LICENSE` (code) + `LICENSE-DATA` (content) at repo root
- [ ] Note dual licensing in `README.md`
- [ ] Adopt DCO (commit `-s` sign-offs) instead of a CLA — lighter for a
      community project

### Repo metadata files

- [ ] `README.md` — cover letter; screenshot of timeline; quick start;
      link to live demo
- [ ] `CONTRIBUTING.md` — split into *contributing code* and *contributing
      events* (the second is the path most people will use)
- [ ] `CODE_OF_CONDUCT.md` — Contributor Covenant
- [ ] `SECURITY.md` — even just "report to email@…"
- [ ] `.github/ISSUE_TEMPLATE/`
  - `event_correction.md`
  - `event_addition.md`
  - `bug_report.md`
  - `feature_request.md`
- [ ] `.github/PULL_REQUEST_TEMPLATE.md`

## Data strategy for the public phase

Lock the schema and validation **before** going public. Once contributors
are submitting PRs, breaking the schema becomes a coordination problem.

### Per-event file split

- [ ] Split `src/data/incidents.json` → `src/data/events/event-001-*.json`
      (one file per event)
- [ ] Build step concatenates them into the bundle (Node script or
      vite-plugin)

**Why:**
- PRs touch one file — easy to review
- Git blame tells you the history of each event individually
- Merge conflicts disappear

### JSON Schema validation

- [ ] Add `src/data/event.schema.json` mirroring `HistoricalIncident`
- [ ] Validate every event file in CI on every PR (`ajv-cli` or `pajv`)
- [ ] Catches typos, malformed dates, broken `connections` references
      before a human reviewer sees them

### Provenance fields (specific to historical content)

Extend the schema with:

```json
"sources": [
  {
    "citation": "Ibn Ishaq, Sirat Rasul Allah, trans. A. Guillaume",
    "url": "https://...",
    "page": "123"
  }
],
"confidence": "established | contested | legendary",
"perspectives": ["sunni", "shia", "academic"]
```

**Why:** without source attribution, every PR review devolves into a
fight about historical accuracy. With it, the conversation shifts to
"is this source reliable" — a more productive debate.

### Cross-reference validation

- [ ] CI script that asserts every `connections` ID resolves to an
      existing event (currently dropped silently at runtime)

## Project-specific sensitivity

Islamic historical content has scholarly disputes that secular OSS
projects rarely deal with. Get ahead of them:

- [ ] **Scope statement** in the README: which traditions of scholarship
      you draw from, whether you track Sunni/Shia/academic perspectives
      separately, what timeframe you cover
- [ ] **Content-review policy** in `CONTRIBUTING.md`: e.g. "event
      additions require at least one cited source; contested events
      require sources from at least two perspectives"
- [ ] **Recruit a content maintainer early** — someone with
      subject-matter credibility you trust to triage event PRs. The
      longer you wait, the harder it is to step back from being the sole
      arbiter.
- [ ] **Launch with the uncontested skeleton**. The 16 events shipped
      today are mostly safe. Karbala, succession disputes, etc. land
      *after* the perspectives schema is in place.

## CI / automation (GitHub Actions)

- [ ] `build.yml` — `npm ci && npm run build` on every PR
- [ ] `lint.yml` — once ESLint setup is fixed
- [ ] `schema.yml` — validate `src/data/events/*.json` against the schema
- [ ] `connections.yml` — assert referential integrity of `connections`
- [ ] Deploy on push to `main` — GitHub Pages or Vercel
- [ ] PR previews for visual review

A green checkmark next to PRs signals "this project is alive and
well-run."

## Discoverability

- [ ] Repo topics: `islamic-history`, `interactive-timeline`, `react`,
      `educational`, `dataset`
- [ ] Submit to relevant Awesome lists: `awesome-react`,
      `awesome-datasets`, `awesome-history`
- [ ] **Live demo URL** matters more than the README — most people decide
      to star a repo in the first 10 seconds. Deploy to GitHub Pages /
      Vercel and link prominently.

## Execution order

### Step 1 — Cleanup pass (this commit)

- `.gitignore` + untrack tracked build artifacts
- Remove dead deps + their CSS imports
- Fix ESLint
- Add LICENSE files
- Do not change application behavior

### Step 2 — Schema & content infrastructure (next)

- Split `incidents.json` per event
- Write JSON Schema
- CI validation for schema + connections
- The schema is the social contract with contributors — lock it in
  early.

### Step 3 — Community files

- `README.md` rewrite with screenshots + demo link
- `CONTRIBUTING.md` (especially the event-addition path)
- Code of Conduct, Security Policy
- Issue + PR templates

### Step 4 — Final sensitivity passes

- Add `sources`, `confidence`, `perspectives` fields to schema
- Scope statement in README
- Content-review policy

### Step 5 — Quiet launch

- Make the repo public but don't promote it
- Watch what breaks
- Fix it
- *Then* post to relevant communities (r/islam, r/history, HN)

A common mistake is launching to HN before the contribution path is
paved — you get 50 PRs in a weekend and no schema to validate them
against. Pave the path first.

## What's NOT in this plan

- **No migration away from static JSON.** It's the contribution surface.
  Dexie/SQLite/Supabase come *after* the data ships, not before.
- **No CLA.** DCO sign-offs are enough for a hobby/community project.
- **No internationalization yet.** English-only at launch; add i18n once
  the schema is stable.
- **No user accounts, no edit-in-UI flows.** All event edits go through
  GitHub PRs initially.
- **No mobile-specific layout.** Desktop-first; responsive breakpoints
  retained.

## References

- Predecessor plan (NMA timeline): `thoughts/shared/plans/2026-05-15-nma-defining-moments-timeline-implementation.md`
- Contributor Covenant: https://www.contributor-covenant.org/
- MIT license: https://opensource.org/license/mit
- CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
- Developer Certificate of Origin: https://developercertificate.org/
