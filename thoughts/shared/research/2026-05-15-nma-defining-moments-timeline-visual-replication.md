---
date: 2026-05-15T00:00:00+00:00
researcher: mdrafsunsheikh
git_commit: 47383d18335cf9382c8f11329db14af6b4244fb2
branch: main
repository: The-Chronicle-of-Light
topic: "Replicating the NMA Defining Moments timeline visualisation, design and style"
tags: [research, codebase, timeline, ui-design, nma, vis-timeline, editorial-redesign]
status: complete
last_updated: 2026-05-15
last_updated_by: mdrafsunsheikh
---

# Research: Replicating the NMA "Defining Moments" Timeline Look-and-Feel

**Date**: 2026-05-15
**Researcher**: mdrafsunsheikh
**Git Commit**: `47383d18335cf9382c8f11329db14af6b4244fb2`
**Branch**: main
**Repository**: The-Chronicle-of-Light (Islamic History Timeline Web App)

## Research Question

> Find out how we can implement the exact same visualisation, design and style of
> `https://www.nma.gov.au/defining-moments/defining-moments-timeline` for this
> application.

## Summary

This document maps the current state of the codebase against the visual design
of the NMA *Defining Moments* timeline (as captured in the reference screenshots
in `references/`) and identifies the concrete code changes required to converge
on that design.

Two layers of findings:

1. **Current state** — the project is a Vite + React 18 + TypeScript app using
   **vis-timeline** for the timeline, **react-leaflet** for the map and
   **@xyflow/react** for the connections graph. A first horizontal/editorial
   pass already exists in `src/components/timeline/TimelineView.tsx` and
   `src/components/timeline/timeline.css` (introduced by the
   `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md` plan).
   The timeline still renders inside a half-width grid cell next to the map
   on an indigo header background with category-coloured cards.

2. **NMA target design** (from `references/image*.png`) — a full-viewport,
   horizontally scrolling "river" of image cards on a **dark olive-green
   stage**, with a thin white **year-axis bar** pinned to the top, oversized
   **teal decade labels** punctuating the river, a left-edge **dark navy logo
   panel**, and an **inline detail panel** that slides in over the timeline
   (date kicker → teal headline → body → teal "Read more" pill button).

The path to replication has four buckets of work:

- **Stage / page chrome**: Convert from a card-in-a-grid widget to a
  full-viewport, dark-olive immersive page; add the left navy logo gutter and
  the white year-axis bar.
- **Timeline visualisation**: Replace the default vis-timeline chrome with a
  fully custom horizontal CSS scroller (or aggressively re-style vis-timeline)
  that arranges image cards in two lanes around a centered axis and
  intersperses big teal decade markers.
- **Card design**: Image-led cards with bottom-gradient overlay, kicker date,
  white title; no category colours.
- **Detail panel**: Replace the centered dialog `IncidentDetailModal` with a
  full-bleed inline panel: image left, date + teal title + body + teal pill
  button right; circular close button top-right.

Detailed mapping below.

---

## Current Codebase State

### Stack & build

`package.json:12-31` — React 18.2, vis-timeline 7.7, leaflet 1.9 / react-leaflet
4.2 / leaflet.timedimension (git), @xyflow/react 12, Tailwind 3.4, Vite 5,
TypeScript 5.3. Scripts: `dev`, `build` (= `tsc && vite build`), `preview`,
`lint`. Working `dist/` exists in the repo.

### Page shell

`src/App.tsx:45-112` — single-page layout:

- Header: full-width `bg-indigo-600 text-white p-6` with `<h1>` and tagline
  (`App.tsx:47-50`).
- Filter bar (`App.tsx:53-62`).
- A two-column grid (`grid-cols-1 lg:grid-cols-2`) holding the timeline on the
  left and the map on the right (`App.tsx:64-78`).
- Below that: the connections graph (`App.tsx:80-85`) and a card grid of
  incidents (`App.tsx:87-95`).
- `IncidentDetailModal` rendered conditionally at the bottom
  (`App.tsx:104-110`).

`src/index.css:1-7` — Tailwind + leaflet + leaflet.timedimension + xyflow
stylesheets imported.

`tailwind.config.js:1-11` — default config, no extended theme tokens (no custom
colours/fonts yet).

`index.html:7` — title `Islamic History Timeline`.

### Timeline

`src/components/timeline/TimelineView.tsx:15-160` — the most NMA-aligned
component so far:

- An **era marker row** (`Earlier`, 400, 600, …, 2000) implemented as a
  flexbox of `<button>`s with hairline dividers (`TimelineView.tsx:115-152`).
  Active era flips to `text-slate-900`; an absolutely-positioned `h-0.5` strip
  represents the active indicator (`TimelineView.tsx:148-151`) — but its
  `left-6` is hard-coded so it never moves to the active marker.
- The vis-timeline canvas inside an `overflow-x-auto overflow-y-hidden`
  wrapper (`TimelineView.tsx:154-157`).
- vis-timeline `options` (`TimelineView.tsx:57-90`) enable `horizontalScroll`,
  disable edit, fix `orientation: 'top'`, and define a **custom template**
  (`TimelineView.tsx:77-89`) that injects an HTML card with `.timeline-card`,
  `.timeline-card-image`, `.timeline-card-content`, `.timeline-card-year`,
  `.timeline-card-title`, `.timeline-card-category`.
- Selection handler routes the chosen item back to `onIncidentClick`
  (`TimelineView.tsx:94-103`).

`src/components/timeline/timeline.css` — first editorial pass:

- White cards with `1px solid #e2e8f0`, soft shadow, `min-width: 280px`,
  `max-width: 320px`, hover lift (`timeline.css:1-17`).
- 160px tall cover image (`timeline.css:20-25`).
- Slate kicker / dark-slate title / uppercase lavender-gray category meta
  (`timeline.css:31-55`).
- A **single unified left border** `#475569` (`timeline.css:57-60`) — *but*
  the file still also contains the legacy per-category coloured left borders
  (`.incident-political`, etc., `timeline.css:62-80`), and the vis-timeline
  template emits `className: incident-<category>` on the wrapping `.vis-item`
  (`TimelineView.tsx:54`). Both layers currently coexist.
- Custom webkit scrollbar (`timeline.css:82-98`), generic `.vis-item` hover
  lift (`timeline.css:100-116`), system-font typography on `.vis-item` /
  `.vis-label` / nav buttons (`timeline.css:128-140`).

### Detail modal

`src/components/common/IncidentDetailModal.tsx:18-115` — centred dialog with
black 50% backdrop:

- White rounded card, `max-w-4xl`, vertical scroll.
- Plain `&times;` text close in the header (`IncidentDetailModal.tsx:47-52`).
- Category pill uses `categoryColors` map of Tailwind classes
  (`IncidentDetailModal.tsx:10-16`, used at 56-58).
- Two-column metadata grid (date / location), then description, then a
  two-column related-events list.
- `Escape` closes (`IncidentDetailModal.tsx:23-37`).

There is no "Read more" CTA, no image surface, and no inline/full-page panel
behaviour.

### Filter bar / card / map / graph

- `src/components/common/FilterBar.tsx:24-66` — `bg-gray-100` block with four
  native `<select>`/`<input type="date">` controls in a 4-column grid.
- `src/components/common/IncidentCard.tsx:17-35` — minimal white card with
  title, locale-formatted date, location, and a coloured dot derived from the
  category map (`IncidentCard.tsx:9-15`).
- `src/components/map/MapView.tsx:42-77` — react-leaflet `MapContainer` with
  OSM tiles, `center: [30, 45]`, `zoom: 3`, and a loading spinner first paint.
  `timeRange` filter applied at `MapView.tsx:35-40`.
- `src/components/map/MapMarker.tsx:18-43` — `divIcon` with Tailwind-named
  category colours injected as `bg-*-500` strings into raw HTML (these are
  class names embedded in inline `style`, so they currently render as the
  literal text — a separate issue, but worth noting).
- `src/components/graph/GraphView.tsx:35-109` — React Flow with per-category
  `nodeStyleMap` (`GraphView.tsx:27-33`) and animated edges. Layout uses
  `position: { x: 0, y: 0 }` for every node and relies on `fitView`
  (`GraphView.tsx:54-66, 96-103`) — no layout algorithm wired up.

### Data

`src/types/incident.ts:13-26` — `HistoricalIncident { id, title, description,
startDate, endDate?, location{lat,lng,name}, category(political|religious|
cultural|scientific|military), connections[], learningPath?, media?[], dynasty?,
region? }`.

`src/data/incidents.json` — **16 incidents**, BCE/early-CE dates as ISO
`YYYY-MM-DD` strings (e.g., `"610-10-13"`). vis-timeline accepts these as
`Date`-compatible inputs.

`src/hooks/useIncidents.ts:5-46` — `useState`/`useMemo` based filter store.
Returns `incidents` (filtered) and `allIncidents` (unfiltered) plus
category/region lists; date filter is a single `{start,end}` range.

### Existing plans referencing this work

- `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md` —
  the original library-survey research (vis-timeline, Leaflet, Leaflet.Time-
  Dimension, React Flow, data-source notes).
- `thoughts/shared/plans/2026-05-13-islamic-history-timeline-web-app.md` —
  the original five-phase build plan.
- `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md` —
  the editorial pass already partially implemented; it explicitly
  references the two NMA screenshots and laid out era markers, horizontal
  scroll, unified card colours, full-page modal, and `Read More` button
  as goals.

The Phase 1/2 deliverables of that 2026-05-14 plan ship in the current
codebase; the Phase 3 modal redesign and Phase 4 era-filter wiring are not yet
in (`IncidentDetailModal.tsx` is still the centred dialog and
`useIncidents.ts` has no `selectedEra` state).

---

## NMA "Defining Moments" Timeline — Visual Anatomy

Direct-fetching the NMA page returned 403 to WebFetch, so the analysis below
is drawn from the four reference screenshots committed to
`references/image.png`, `references/image copy.png`, `references/image
copy 2.png`, `references/image copy 3.png`, supplemented by NMA's own
description and the case study by the agency that built it
(see "External References" at the end).

### 1. Overall composition

The timeline takes over the whole viewport. It is **not** a widget embedded in
a normal page — once the user enters the timeline experience, the standard
NMA site chrome disappears and is replaced by a self-contained immersive
canvas.

Three persistent regions:

- **Top bar** — thin (≈48 px) white/cream strip running edge-to-edge. Holds
  the year-axis (left-anchored, scrollable) and a circular close `×` button on
  the far right.
- **Left logo panel** — a narrow dark-navy rectangle pinned to the top-left
  carrying the stacked NMA wordmark. It sits *over* the timeline (not over the
  top bar).
- **Stage** — everything below the top bar. Dark olive/khaki green
  (approximately `#454722` ↔ `#4F5430`, oscillating in a subtle vertical
  gradient). All cards and decade markers live here.

### 2. Time axis (top bar)

- Year labels rendered as small, all-uppercase / proper-cased numerals (e.g.,
  `Earlier`, `1600`, `1700`, `1800`, `1850`, `1900`, `1920`, `1940`, `1960`,
  `1970`, `1980`, `1990`, `2000`, `2010`, `2020`).
- Spacing is **non-uniform** — older eras get larger gaps per century;
  modern decades are denser. This is because the same horizontal pixel
  distance no longer represents the same number of years — the timeline
  bends time to give recent decades more visual real estate (a hallmark of
  museum timelines where modern events dominate the dataset).
- An underline / dot indicator marks the currently-viewed decade.
- Clicking a label jumps the stage to that decade.

### 3. Card "river"

Inside the stage, event cards are arranged in **two horizontal lanes**:

- An **upper lane** sitting above the implied centerline.
- A **lower lane** sitting below it.
- Cards alternate lanes loosely (not a strict zigzag) — when a decade is
  busy the engine packs cards tightly using both lanes to avoid overlap.
- Cards are tightly clustered; there's almost no gutter between adjacent
  cards in the same lane.

Interspersed with the cards, **oversized teal decade labels** (`1600`,
`1700`, `1810`, `1820` …) sit on the centerline itself, in a thin geometric
sans-serif. They're at maybe 56–72 px font-size and tinted that distinctive
teal-cyan. They act as visual chapter markers in the river.

### 4. Event card design

Each card is approximately **180 × 150 px**, rectangular with very slight
rounding (≤ 4 px). Anatomy:

- **Full-bleed background image** — period art, photography or archival
  illustration; some are sepia paintings, some are b/w photos.
- A **dark gradient overlay** from the bottom upward (≈ 60% of card height)
  ensures legibility of text.
- Top of card: small white kicker line with the exact date —
  `1 February 1606`, `16 October 1616`, `20 February 1814`, `16 May 1813`,
  `8 April 1817`. Lowercase day numerals, full month name, year.
- Below the kicker: the title in 2–3 lines of crisp white sans-serif (e.g.,
  *"Dutch explorer Willem Janszoon becomes first European to step ashore on
  the Australian coast"*). Tight leading.
- No category badge, no border, no per-category accent colour.
- Hover/active state (inferred from analogous NMA collections): slight scale
  up + brightness lift.

### 5. Detail panel ("Read more about this moment")

`references/image copy 2.png` captures it. When a card is clicked, the
timeline dims and an **inline detail panel** slides in. It does **not** sit
in a centred dialog — it occupies the entire stage area:

- White / very light grey background.
- **Two-column** layout on desktop:
  - **Left**: a large hero image (~50% of the panel width). Below it, a small
    italic caption with provenance (*"Victoria Pass, Blue Mountains, Eliza
    Thurston, 1851, National Museum of Australia"*).
  - **Right**: text block.
- Text block, top to bottom:
  - **Date kicker** — small uppercase, slate-grey: `16 MAY 1813`.
  - **Headline** — large teal, sans-serif, single line where possible: *"Blue
    Mountains crossing"*. Looks like NMA's house typeface; visually very close
    to **Public Sans** or **Source Sans 3** at the headline weight.
  - **Body paragraphs** — dark grey, generous line-height, justified left.
  - **CTA button** — solid teal pill, white uppercase label
    *"READ MORE ABOUT THIS MOMENT"*, modest letter-spacing, soft rounding.
- Top-right corner: circular grey close button with a thin `×` glyph.
- Closing the panel returns the user to the timeline at the same position.

The "Read more" CTA navigates to the full article page (image copy 3.png),
which is just the **regular NMA Defining Moments article** template —
that page is *not* part of the timeline UI itself, it is the standard
website chrome around a single moment.

### 6. Colour palette (sampled from screenshots)

| Role | Approx hex | Notes |
| --- | --- | --- |
| Stage background | `#4A4B2A` ↔ `#525630` | Dark olive khaki, subtle vertical gradient |
| Top bar background | `#FFFFFF` | With a hairline shadow |
| Top bar text | `#1F2937` / muted slate | Inactive years are lighter |
| Logo panel | `#0C2230` ↔ `#10303C` | Dark navy with a slight teal cast |
| Decade markers | `#2EB6B0` ↔ `#1FA7A4` | Bright teal / cyan |
| CTA / headline teal | `#1B8A87` | Slightly deeper teal |
| Card overlay | `rgba(0,0,0,0.55)` bottom-up gradient |  |
| Card text | `#FFFFFF` | |
| Detail panel background | `#FAFAF7` | Off-white |
| Detail body text | `#222 ↔ #333` | |

### 7. Typography

- **One sans-serif family** for everything. The headline letterforms (the
  large `Blue Mountains crossing`) match **Public Sans** very closely — a
  geometric humanist sans that NMA uses across the site. Body uses the same
  family at regular weight.
- Headline: bold, slightly tighter tracking, teal.
- Card titles: medium, white, normal tracking.
- Year labels: regular, slate, ~14 px in the top bar; ~56 px teal for the
  in-river decade markers.
- Date kickers: small caps or all-uppercase, light tracking.

### 8. Motion & interaction

- The stage scrolls horizontally — wheel and trackpad gestures translate to
  horizontal motion. Drag-to-pan also works.
- Clicking a year in the top bar smoothly animates the stage to that decade.
- The active decade indicator slides across the top bar as you scroll.
- Card click triggers a cross-fade into the detail panel.
- Close on the detail panel reverses the cross-fade.

There is no time-axis tick mark *inside* the stage — decade markers serve
that role visually.

---

## Mapping NMA Design → This Codebase

The user explicitly asked **how to implement** the NMA look. The table below
maps each NMA design element to the file(s) that would change in this repo.

### A. Page chrome → `src/App.tsx`, `tailwind.config.js`, `src/index.css`

| NMA element | Code action |
| --- | --- |
| Full-viewport immersive stage | Replace `<header bg-indigo-600>` and the `container mx-auto p-6` grid in `App.tsx:46-102` with a single full-bleed `<section>` that hosts the timeline (or move the timeline to its own route and keep the current dashboard as a separate page). |
| Dark olive stage background | Add `colors.stage` (and `colors.teal-nma`, `colors.navy-nma`) to `tailwind.config.js:7-9` `theme.extend.colors`. Apply `bg-stage` to the timeline section. |
| Top white year-axis bar | Move the era-marker row out of `TimelineView` into its own `TimelineTopBar` component anchored at `top-0` of the stage; give it `bg-white text-slate-700 border-b`. |
| Left navy logo panel | New `<div>` absolutely positioned `top-0 left-0`, `bg-navy-nma`, holding an SVG/word-mark. |
| Circular close button | Add a `<button>` `top-0 right-0` in the top bar; only meaningful if the timeline becomes its own route. |
| Public Sans typeface | Add `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;700&display=swap">` to `index.html:5`, then `theme.extend.fontFamily.sans = ['Public Sans', ...defaultFontFamily]` in Tailwind, and drop the system-font stack currently hard-coded in `timeline.css:128-140`. |

### B. Top year axis → `TimelineView.tsx:115-152`

The existing era-marker row is the right *structure* but the wrong *style*:

- Replace `text-gray-500 hover:text-gray-700` and `text-slate-900` (active)
  with NMA values: inactive `text-slate-500`, active `text-slate-900 underline
  underline-offset-8 decoration-2 decoration-slate-900`.
- Replace the hairline `<div className="w-px h-4 bg-gray-300" />` separators
  with simple `space-x-6` gaps; NMA has no visible dividers, just space.
- Fix the active indicator strip (`TimelineView.tsx:148-151`): instead of a
  hard-coded `left-6`, compute the offset from the active button's `ref.offsetLeft`
  and animate `transform: translateX(...)`.
- The current marker set goes 400–2000 in century increments. NMA mixes
  centuries (1600, 1700, 1800) with decades from 1850 onward to compress
  modern density. For an Islamic history app this can stay as centuries
  throughout (since most density is pre-modern), so this is one place we
  intentionally diverge.

### C. Card river → `TimelineView.tsx:44-90`, `timeline.css`

vis-timeline gives clustering, zooming and snapping for free, but the
default `.vis-item` styling and lane layout don't look like the NMA river.
Two implementation options:

**Option 1 — Keep vis-timeline, restyle aggressively.**

1. In `timeline.css`, override `.vis-item-overflow`, `.vis-item`, `.vis-time-axis`,
   `.vis-text` and `.vis-panel.vis-background` so the visible grid lines
   disappear and the cards float on the dark olive ground. Specifically:
   - Remove the existing per-category left borders
     (`timeline.css:62-80` `.incident-political`, etc.) — these conflict with
     the NMA uniform-colour rule.
   - Hide `.vis-time-axis .vis-text` (since the top-bar replaces it) but keep
     `.vis-foreground` and `.vis-background` with `background: transparent`.
   - Style `.vis-item` to be borderless, no rounding, with a fixed
     `width: 180px; height: 150px;` (override vis-timeline's natural sizing
     by configuring `template` to render a fully-sized card).
2. Update the `template` function (`TimelineView.tsx:77-89`) so the inner HTML
   matches the NMA card: full-bleed `<img>` plus a `.timeline-card-overlay`
   element holding `.timeline-card-date` (kicker) and
   `.timeline-card-title`. Drop `timeline-card-category` and the explicit
   `timeline-card-year` block — NMA's card shows only a full prose date and
   the title.
3. To get the **two-lane river** look with **decade labels on the centerline**:
   - Use vis-timeline groups with two static groups (`top`, `bottom`); assign
     items to a group by `index % 2` or by an explicit per-incident `lane`
     field.
     `TimelineView.tsx:48-55` would receive `group: index % 2 === 0 ? 'top'
     : 'bottom'`.
   - Add `groups` to the `Timeline` constructor and set
     `groupHeightMode: 'fixed'`.
   - For decade markers: vis-timeline supports `customTimes` and
     `addCustomTime`. Iterate decades over the data range and add one
     `customTime` per decade with a label; style the marker via
     `.vis-custom-time.vis-time-marker-XXXX` to render the large teal numeral
     using a `::after` content property. Alternatively, render an absolutely
     positioned overlay layer of decade labels whose `left` is computed from
     vis-timeline's `range.start/end` via `getWindow()` and a
     resize listener.

**Option 2 — Drop vis-timeline, build a pure CSS scroller.**

This is closer to NMA's actual implementation (NMA's timeline is not
vis-timeline; based on the agency case study it's a bespoke React component).
The plumbing:

1. Compute a linear `x = (incident.startDate.year - minYear) * pxPerYear`
   for each incident.
2. Render a single horizontally-scrolling `<div>` whose width is
   `(maxYear - minYear) * pxPerYear`.
3. Inside it, absolutely-position each card at its `x`, alternating
   `top: 6%` / `top: 56%` for the two lanes (with a packing pass to bump
   `top` when cards collide).
4. Position decade markers as a second pass of absolutely-positioned
   `<span>`s at `x = (decade - minYear) * pxPerYear`, centered vertically.
5. Use `requestAnimationFrame` + `wheel` to translate vertical wheel deltas
   into horizontal scroll (`scrollLeft`).
6. Drive the top year-axis active indicator from `scrollLeft` /
   `pxPerYear`.

This route loses vis-timeline's clustering and zooming but gains complete
visual control. Given how heavily the NMA design diverges from vis-timeline's
defaults, Option 2 is the lower-friction route to a *pixel-identical* match;
Option 1 is the lower-friction route to a *good-enough* match while keeping
vis-timeline's data-binding & zoom.

### D. Card visuals → `timeline.css`

Concrete diff against the current `timeline.css`:

- `.timeline-card`: remove `background: white`, `border: 1px solid #e2e8f0`,
  `border-radius: 8px`, `padding: 0`, `min-width: 280px`, `max-width: 320px`,
  `box-shadow`. Replace with `width: 180px; height: 150px; border-radius:
  2px; overflow: hidden; position: relative;`.
- `.timeline-card-image`: change `height: 160px` to `height: 100%`,
  `width: 100%`, `object-fit: cover`, `position: absolute; inset: 0;`.
- New `.timeline-card-overlay`: `position: absolute; inset: 0; background:
  linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0) 55%); display:
  flex; flex-direction: column; justify-content: flex-end; padding: 10px
  12px;`.
- `.timeline-card-date`: `color: rgba(255,255,255,0.9); font-size: 11px;
  font-weight: 500; margin-bottom: 4px;` — and render a full prose date,
  not just `start.split('-')[0]` (which currently shows only the year). Use
  `Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year:
  'numeric' })`.
- `.timeline-card-title`: keep the 2-line clamp, change colour to `#FFFFFF`,
  font-size 13–14 px, weight 500, line-height 1.25.
- Delete `.timeline-card-category` styling and the `border-left: 3px solid
  #475569` rule (`timeline.css:57-60`), plus all `.incident-*` rules
  (`timeline.css:62-80`).
- Delete `.vis-item` hover transform (`timeline.css:100-116`) since the
  card itself is the hit target.

### E. Decade markers (in-stage)

If you take Option 1: register vis-timeline `customTimes` for each decade,
then in `timeline.css` add

```css
.vis-custom-time {
  border-color: transparent;
}
.vis-custom-time::after {
  content: attr(data-year);
  position: absolute;
  top: 45%;
  font: 600 56px/1 'Public Sans', sans-serif;
  color: #2EB6B0;
  white-space: nowrap;
  pointer-events: none;
}
```

If you take Option 2: a `<DecadeMarker year={...} x={...} />` component
that renders the same teal numeral.

### F. Detail panel → `src/components/common/IncidentDetailModal.tsx`

The NMA detail panel is **inline over the stage**, not a centred dialog. The
file-level rewrite:

- Drop `bg-black bg-opacity-50 flex items-center justify-center z-50 p-4`
  (`IncidentDetailModal.tsx:42`); replace with `fixed inset-0 z-40 bg-stage`
  (matching the stage colour) so the panel feels like a peel layer over the
  timeline.
- Inside, a flex row: left column `<img>` + `<figcaption>`, right column the
  text block.
- Replace the `&times;` text close (`IncidentDetailModal.tsx:47-52`) with a
  circular grey button positioned `absolute top-6 right-6` using
  `<svg viewBox="0 0 24 24"><path d="M6 6L18 18M6 18L18 6" /></svg>`.
- Date kicker: `text-xs uppercase tracking-wider text-slate-500` formatted as
  full prose date.
- Headline: `text-3xl md:text-4xl font-bold text-teal-700` (where
  `text-teal-700` resolves to the `#1B8A87` token).
- Body: keep the description; drop the metadata grid (`IncidentDetailModal.tsx:71-88`),
  the category/dynasty/region pills (`IncidentDetailModal.tsx:55-69`), and the
  related-events block (`IncidentDetailModal.tsx:95-110`) — NMA's detail
  panel keeps it focused; pills and related events live on the full article
  page.
- Below the body: a single teal pill button `bg-teal-700 hover:bg-teal-800
  text-white uppercase tracking-wider px-6 py-3 rounded-full` labelled
  `Read more about this moment`. For now this can be a hash link
  (`#/moment/<id>`) since there's no real article route.

The current `App.tsx:104-110` integration keeps working — only the inner
implementation changes.

### G. Filter bar

The NMA timeline has no visible filter bar — it relies on the year-axis
jumping for navigation. For this app the user might still want category /
region filters, but to converge on the look:

- Move `FilterBar` (`App.tsx:53-62`) out of the timeline page. Either hide it
  behind a `Filters` button in the top bar that opens a sheet, or keep it on
  a separate "Explore" page.

### H. Connections graph and map

NMA's timeline doesn't surface either. For visual parity:

- Move `GraphView` and `MapView` out of `App.tsx:64-85` so they don't share
  the timeline route.
- Optionally keep `MapView` as a secondary "Map" tab/route and `GraphView` as
  the deep-dive on a clicked moment.

### I. Sample data needs

`src/data/incidents.json` events currently have no `media[].url` populated.
The NMA aesthetic is *entirely* image-led — without images the card design
collapses to a black rectangle. Two practical follow-ups:

1. Source one period image per incident (creative-commons paintings,
   manuscript miniatures, photos of architecture, etc.) and add them under
   `public/images/incidents/` with the URL in `media[0].url`.
2. Until that's done, give `.timeline-card-image` a per-category placeholder
   pattern or a tinted-letter fallback (e.g., the incident's first letter
   on a slate background).

---

## Reference Mapping Table (NMA element → file:line to change)

| NMA visual element | File | Line(s) |
| --- | --- | --- |
| Olive stage background | `src/App.tsx` | 46-102 (replace shell) + `tailwind.config.js:7-9` (add colour token) |
| White top year-axis bar | `src/components/timeline/TimelineView.tsx` | 115-152 (restyle), 148-151 (fix active indicator) |
| Left navy NMA-style logo panel | `src/App.tsx` | new sibling of stage |
| Card image + gradient + kicker | `src/components/timeline/TimelineView.tsx` | 77-89 (template), `timeline.css` 1-55 (card styles) |
| Two-lane card layout | `src/components/timeline/TimelineView.tsx` | 48-55 (add `group`), 57-90 (timeline `groups` option) |
| Oversized teal decade labels | `src/components/timeline/TimelineView.tsx` | 57-90 (`customTimes`), `timeline.css` (`.vis-custom-time::after`) |
| Remove category accent colours | `src/components/timeline/timeline.css` | 57-80 (delete `.incident-*` and `border-left: 3px solid #475569`) |
| `IncidentCard` (sidebar/list) — recolour | `src/components/common/IncidentCard.tsx` | 9-15, 31 (drop `categoryColors`) |
| Inline detail panel layout | `src/components/common/IncidentDetailModal.tsx` | 42 (backdrop), 47-52 (close icon), 55-69 (drop pills), 71-88 (drop metadata grid), 95-110 (drop related events) |
| Teal "Read more" CTA | `src/components/common/IncidentDetailModal.tsx` | add new `<button>` below body |
| Public Sans typeface | `index.html:5`, `tailwind.config.js:7-9`, `src/components/timeline/timeline.css:128-140` |

---

## Architecture Documentation (current implementation patterns)

- **Single-page composition**: `App.tsx` is the only route; all four views
  (timeline, map, graph, card grid) render on the same page driven by the
  `useIncidents` hook.
- **Hook-based data store**: `useIncidents` (`useIncidents.ts:5-46`) is the
  single source of truth for filters; consumers read `incidents` (filtered)
  and `allIncidents` (unfiltered).
- **Per-view local UI state**: each view component manages its own ref-based
  imperative library (`vis-timeline` for the timeline, `react-leaflet`'s
  `MapContainer` for the map, React Flow for the graph). Selection events
  bubble up via callback props (`onIncidentClick`, `onNodeClick`).
- **Category colour map duplicated**: the same five-colour category palette
  is hard-coded in four places —
  `IncidentCard.tsx:9-15`, `IncidentDetailModal.tsx:10-16`,
  `GraphView.tsx:27-33`, `MapMarker.tsx:5-11`, and `timeline.css:62-80`.
  Converging on NMA's no-category-accent rule removes all five.
- **Per-category vs unified styling**: the editorial pass introduced unified
  styling (`timeline-card`) but did not delete the legacy per-category left
  borders, so both styling layers currently apply to vis-timeline items.
- **Modal pattern**: `IncidentDetailModal` is rendered at the App root and
  controlled via a `selectedIncident` state (`App.tsx:25, 104-110`).
  `Escape` handling is local to the modal (`IncidentDetailModal.tsx:23-37`).
- **No router**: there is currently no React Router or equivalent — moving
  to an immersive timeline route or a `Read more` article route would
  introduce that dependency.

---

## Historical Context (from `thoughts/`)

- `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`
  — the initial library survey that picked vis-timeline, Leaflet +
  Leaflet.TimeDimension and React Flow.
- `thoughts/shared/plans/2026-05-13-islamic-history-timeline-web-app.md`
  — the 5-phase build plan that produced the current app skeleton.
- `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md`
  — the editorial pass that introduced the era markers, horizontal scroll
  container and unified card CSS. Phase 1 + Phase 2 of that plan are
  implemented; Phase 3 (modal rewrite), Phase 4 (era filter wiring) and
  Phase 5 (a11y) are still open. The references it cites are exactly the
  two `Screenshot 2026-05-14 at 4.36.*.png` files committed alongside the
  more recent `image*.png` captures.

---

## External References

- NMA Defining Moments timeline — `https://www.nma.gov.au/defining-moments/defining-moments-timeline`
- NMA Defining Moments landing — `https://www.nma.gov.au/defining-moments`
- Lightwell case study (agency that built the touchwall/timeline) —
  `https://www.lightwell.com.au/projects/defining-moments/`
- NMA Defining Moments Digital Classroom — `https://digital-classroom.nma.gov.au/`
- Bliss Digital DMDC case study (related React-component library) —
  `https://www.blissdigital.com.au/projects/dmdc/`
- vis-timeline docs — `https://visjs.github.io/vis-timeline/`
- vis-timeline `customTimes` API —
  `https://visjs.github.io/vis-timeline/docs/timeline/#Methods`
- Public Sans typeface — `https://public-sans.digital.gov/`

---

## Open Questions

1. **Routing**: do we want the timeline at its own route (`/timeline`) so we
   can make it a true immersive full-viewport experience, or keep it inside
   the dashboard?
2. **Image sourcing**: which incidents have suitable public-domain hero
   imagery available? The card design fails closed without images.
3. **Time-axis density**: NMA mixes century steps with decade steps after
   1850. Should we mirror that, or stay on uniform centuries for the
   Islamic-history date range (610–present)?
4. **Filtering**: do we keep the existing category/region filters, and if so
   where do they live in the new chrome?
5. **vis-timeline vs custom scroller** (Option 1 vs Option 2 above): how
   close to pixel-perfect do we want to get? The cost of Option 2 is
   re-implementing zoom/cluster.
6. **Map and graph views**: are they kept on the same page (as today) or
   moved to their own routes once the timeline becomes full-viewport?
7. **Article route**: where does the `Read more about this moment` CTA go?
   Do we generate per-incident article pages from `incidents.json`, or
   defer that to Phase N?
