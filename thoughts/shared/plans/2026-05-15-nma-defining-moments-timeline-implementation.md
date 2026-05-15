# NMA Defining Moments Timeline – Implementation Plan

## Overview

Replicate the National Museum of Australia *Defining Moments* timeline
visualisation, design and style inside the existing Islamic History
Timeline web app. The end product is a full-bleed, dark olive timeline
section with a thin white year-axis bar, two-lane card river, oversized
teal decade markers, an inline detail panel, and a unified colour scheme
that drops the legacy per-category accents.

Single-page application (no router); the timeline is the visual hero with
filters / map / graph relocated beneath it.

## Current State Analysis

Repo is on `main` at `47383d18335cf9382c8f11329db14af6b4244fb2`. React 18 +
Vite + Tailwind 3.4 + vis-timeline 7.7 + react-leaflet 4.2 + @xyflow/react 12.
Build is `tsc && vite build`; lint is `eslint src --ext ts,tsx`; no test
framework wired up.

Relevant files (already analysed in
`thoughts/shared/research/2026-05-15-nma-defining-moments-timeline-visual-replication.md`):

- `src/App.tsx:45-112` — indigo header + `container mx-auto` grid with
  timeline beside map; modal mounted at root.
- `src/components/timeline/TimelineView.tsx:15-160` — era marker row,
  vis-timeline canvas, card template with `.timeline-card` etc.
- `src/components/timeline/timeline.css` — editorial first pass; still
  carries legacy `.incident-*` per-category left borders.
- `src/components/common/IncidentDetailModal.tsx:18-115` — centred dialog
  with category pills, two-column metadata grid, related events.
- `src/components/common/IncidentCard.tsx`, `FilterBar.tsx`,
  `MapView.tsx`, `MapMarker.tsx`, `GraphView.tsx` — five sites duplicate the
  same five-colour category palette.
- `src/hooks/useIncidents.ts:5-46` — `useState`/`useMemo` filter store;
  no `selectedEra` field yet.
- `src/data/incidents.json` — 16 incidents, none populate `media[].url`.
- `tailwind.config.js:1-11` — default, no theme tokens.
- `index.html:7` — no font link.

### Key Discoveries

- A partial editorial pass already exists from
  `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md`
  (Phases 1–2 shipped; Phases 3–5 open). We extend that pass; we do not
  start over.
- vis-timeline supports `groups` (lanes) and `customTimes` (in-stage
  markers), which together cover the NMA "two-lane river + decade
  markers" without needing a custom CSS scroller.
- The category colour map is duplicated across five files
  (`IncidentCard.tsx:9-15`, `IncidentDetailModal.tsx:10-16`,
  `GraphView.tsx:27-33`, `MapMarker.tsx:5-11`, `timeline.css:62-80`).
  Going to the NMA uniform palette deletes all five copies.
- `MapMarker.tsx:21` injects Tailwind class names as bg-color strings into
  inline HTML — currently broken; the NMA recolour fixes this incidentally
  by switching to literal hex values.

## Desired End State

A single-route React app where:

- The viewport opens onto a dark olive timeline stage with a white year-axis
  bar at top and a navy logo gutter on the left.
- Image cards (with a tinted-letter SVG fallback for incidents that lack
  imagery) sit in two lanes either side of an implied centerline.
- Large teal century numerals (`700`, `800`, …, `2000`) sit on the centerline
  as chapter markers.
- Clicking a card swaps in a full-bleed two-column detail panel: hero image
  + caption on the left, date kicker / teal headline / body / disabled
  "Read more about this moment" pill on the right; circular `×` closes.
- Beneath the stage, the filter bar, map and connections graph render in a
  toned-down secondary section.
- Year markers in the top bar are clickable and reflect the
  `selectedEra` filter (already plumbed through `useIncidents`).

### Verification

- `npm run build` completes with no TypeScript or bundle errors.
- `npm run lint` passes.
- `npm run dev` loads, the stage paints olive within 1 s, and all
  7 phases pass the manual checks listed below.

## What We're NOT Doing

- **No React Router.** Single page; the timeline expands within the
  existing `App.tsx` shell. A dedicated `/timeline` route is deferred.
- **No Option 2 (bespoke CSS scroller).** We restyle vis-timeline; a
  pixel-identical rewrite is deferred.
- **No real `Read more` article pages.** The CTA is a stub for now.
- **No image acquisition.** Tinted-letter SVG fallback; real CC imagery
  is a parallel data task tracked separately.
- **No CMS, search, multi-language, mobile-specific layout.** Desktop
  first; existing responsive breakpoints retained.
- **No new categories.** The existing five (`political | religious |
  cultural | scientific | military`) remain in data; we simply stop
  surfacing them as colour.

## Implementation Approach

Seven small, independently shippable phases. Each one keeps the build
green and leaves the app usable. The order moves outward → inward:
chrome → axis → river → cards → detail panel → secondary content →
polish. Phases 3 and 5 are the visually load-bearing ones; the others
are scaffolding around them.

---

## Phase 1: Theme Tokens & Page Chrome

### Overview

Introduce the NMA palette and Public Sans typeface as Tailwind tokens.
Replace the indigo header in `App.tsx` with the dark olive stage, navy
logo gutter, and top-bar slot. Keep the existing components mounted
underneath so the app still works while later phases land.

### Changes Required

#### 1. Tailwind theme tokens
**File**: `tailwind.config.js`
**Changes**: Add NMA colour and font-family tokens.

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          DEFAULT: '#4A4B2A',
          light: '#525630',
        },
        'navy-nma': '#0C2230',
        'teal-nma': {
          DEFAULT: '#1B8A87',
          bright: '#2EB6B0',
        },
        panel: '#FAFAF7',
      },
      fontFamily: {
        sans: ['"Public Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

#### 2. Load Public Sans
**File**: `index.html`
**Changes**: Add Google Fonts link before the title and apply the body class.

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <title>The Chronicle of Light</title>
  </head>
  <body class="font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

#### 3. Page shell rewrite
**File**: `src/App.tsx`
**Changes**: Drop the indigo header; render a full-bleed stage section
containing the timeline. Move filters / map / graph / card grid into a
separate `<section>` below the stage.

```tsx
return (
  <div className="min-h-screen bg-panel font-sans">
    {/* Immersive timeline stage */}
    <section className="relative bg-stage min-h-[600px]">
      {/* Navy logo gutter (top-left, overlays stage) */}
      <div className="absolute top-0 left-0 z-20 bg-navy-nma text-white px-4 py-3 w-40">
        <div className="text-[10px] tracking-widest uppercase opacity-70">The</div>
        <div className="font-bold leading-tight">Chronicle<br />of Light</div>
      </div>

      <TimelineView
        incidents={incidents}
        onIncidentClick={handleIncidentClick}
        selectedEra={selectedEra}
        onEraChange={setSelectedEra}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />
    </section>

    {/* Secondary content section */}
    <section className="container mx-auto p-6 space-y-6">
      <FilterBar ... />
      <MapView ... />
      <GraphView ... />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {incidents.map(...)}
      </div>
    </section>

    {selectedIncident && (
      <IncidentDetailModal ... />
    )}
  </div>
);
```

#### 4. Wire `selectedEra` from the hook
**File**: `src/hooks/useIncidents.ts`
**Changes**: Add `selectedEra` state alongside the other filters so
Phase 2's clickable year axis has a home. No filtering logic added in
this phase — just the state slot.

```ts
const [selectedEra, setSelectedEra] = useState<string | undefined>(undefined);

// ... in the returned object:
return {
  ...,
  selectedEra,
  setSelectedEra,
};
```

Then update `src/App.tsx` to destructure `selectedEra` / `setSelectedEra`
from `useIncidents()` (remove the local `useState` for `selectedEra` at
`App.tsx:26`).

### Success Criteria

#### Automated Verification
- [x] Type-check + bundle succeed: `npm run build`
- [ ] Lint passes: `npm run lint` *(blocked: eslint is referenced by the `lint` script but not installed in `devDependencies`; pre-existing project gap, surfaced for follow-up)*
- [x] `tailwind.config.js` exports the new `stage`, `navy-nma`,
      `teal-nma`, `panel` colours: `node -e "import('./tailwind.config.js').then(m => console.log(JSON.stringify(m.default.theme.extend.colors)))"`

#### Manual Verification
- [ ] `npm run dev` paints a dark-olive stage above the secondary
      section.
- [ ] Public Sans is the rendered font (inspect computed style on `<h1>`
      or any title).
- [ ] Navy "Chronicle of Light" gutter sits in the stage's top-left
      corner and overlays the stage colour.
- [ ] Map, graph, filter bar and card grid are still functional below
      the stage (visual regressions OK at this point — Phase 6 tones them).

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: Year-Axis Top Bar

### Overview

Extract the era-marker row out of `TimelineView.tsx` into its own
`TimelineTopBar` component, restyle to the NMA white-on-stage bar with a
sliding underline indicator, and wire clicks to `setSelectedEra` (visually
only — actual filtering lands in Phase 6 where filters relocate).

### Changes Required

#### 1. Create the top bar component
**File**: `src/components/timeline/TimelineTopBar.tsx` (new)

```tsx
import React, { useEffect, useRef, useState } from 'react';

interface EraMarker {
  year: string;
  label: string;
}

const ERA_MARKERS: EraMarker[] = [
  { year: 'earlier', label: 'Earlier' },
  { year: '600',  label: '600'  },
  { year: '700',  label: '700'  },
  { year: '800',  label: '800'  },
  { year: '900',  label: '900'  },
  { year: '1000', label: '1000' },
  { year: '1100', label: '1100' },
  { year: '1200', label: '1200' },
  { year: '1300', label: '1300' },
  { year: '1400', label: '1400' },
  { year: '1500', label: '1500' },
  { year: '1600', label: '1600' },
  { year: '1700', label: '1700' },
  { year: '1800', label: '1800' },
  { year: '1900', label: '1900' },
  { year: '2000', label: '2000' },
];

interface TimelineTopBarProps {
  selectedEra?: string;
  onEraChange: (era: string) => void;
  onClose?: () => void;
}

export const TimelineTopBar: React.FC<TimelineTopBarProps> = ({
  selectedEra,
  onEraChange,
  onClose,
}) => {
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    if (!selectedEra) return;
    const el = buttonRefs.current[selectedEra];
    if (!el) return;
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [selectedEra]);

  return (
    <div className="relative bg-white border-b border-slate-200 h-12 flex items-center pl-44 pr-12">
      <nav
        role="navigation"
        aria-label="Era navigation"
        className="flex items-center space-x-7 overflow-x-auto whitespace-nowrap"
      >
        {ERA_MARKERS.map((era) => (
          <button
            key={era.year}
            ref={(el) => { buttonRefs.current[era.year] = el; }}
            onClick={() => onEraChange(era.year)}
            className={`text-sm font-medium transition-colors ${
              selectedEra === era.year
                ? 'text-slate-900'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {era.label}
          </button>
        ))}
      </nav>

      {selectedEra && indicator.width > 0 && (
        <div
          className="absolute bottom-0 h-0.5 bg-slate-900 transition-all duration-200"
          style={{ left: indicator.left, width: indicator.width }}
        />
      )}

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close timeline"
          className="absolute top-1/2 right-4 -translate-y-1/2 w-8 h-8 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6L18 18M6 18L18 6" />
          </svg>
        </button>
      )}
    </div>
  );
};
```

#### 2. Remove the inline era row from `TimelineView.tsx`
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: Delete `eraMarkers` (`TimelineView.tsx:24-42`) and the
in-component nav block (`TimelineView.tsx:115-152`). Render
`<TimelineTopBar />` at the start of the JSX. Trim props that move to
the top bar.

```tsx
import { TimelineTopBar } from './TimelineTopBar';

// ... inside the return:
return (
  <div className="relative w-full">
    <TimelineTopBar selectedEra={selectedEra} onEraChange={onEraChange ?? (() => {})} />
    <div className="overflow-x-auto overflow-y-hidden">
      <div ref={timelineRef} className="h-[520px] min-w-full" />
    </div>
  </div>
);
```

#### 3. Increase stage height
**File**: `src/App.tsx`
**Changes**: Bump `min-h-[600px]` to `min-h-[572px]` (48 px top bar + 520 px
canvas + 4 px headroom) so the stage hugs the timeline cleanly. Pure visual
tweak — keep it on the stage `<section>`.

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] No usage of `eraMarkers` remains in `TimelineView.tsx`:
      `grep -n 'eraMarkers' src/components/timeline/TimelineView.tsx` returns nothing.

#### Manual Verification
- [ ] White top bar spans the stage width, sitting above the dark olive
      canvas.
- [ ] Era buttons (`Earlier`, `600`, `700`, …, `2000`) are visible,
      slate-coloured, with hairline gaps (no vertical dividers).
- [ ] Clicking a year flips it to slate-900 and a black underline
      slides smoothly underneath it.
- [ ] Navy logo gutter still overlays the stage at top-left (the top bar
      sits behind it because we set `pl-44`).

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Card River — Two Lanes & Decade Markers

### Overview

This is the heaviest visual phase. Reconfigure vis-timeline to render
items in two lanes around a centerline, intersperse oversized teal
century markers on the centerline, hide vis-timeline's default chrome
(time axis text, grid lines), and rewrite the item template + CSS to
match the NMA card.

### Changes Required

#### 1. Two lanes via `groups`
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: Add two static groups (`top`, `bottom`) and assign each
incident's `group` deterministically — odd indices go to `top`, even to
`bottom`, so cards alternate lanes naturally.

```tsx
// inside useEffect, replacing TimelineView.tsx:48-55
const items = incidents.map((incident, index) => ({
  id: incident.id,
  content: incident.title,
  start: incident.startDate,
  end: incident.endDate || undefined,
  group: index % 2 === 0 ? 'top' : 'bottom',
}));

const groups = [
  { id: 'top',    content: '' },
  { id: 'bottom', content: '' },
];
```

Update the Timeline constructor call (`TimelineView.tsx:92`):

```tsx
timelineInstance.current = new Timeline(timelineRef.current, items, groups, options);
```

Note: removing `className: incident-<category>` from the item-mapping
loop above also removes the legacy hook for per-category borders.

#### 2. Decade markers via `customTimes`
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: After constructing the Timeline, register one `customTime`
per century in the data range.

```tsx
const CENTURY_MARKERS = [600, 700, 800, 900, 1000, 1100, 1200, 1300,
                        1400, 1500, 1600, 1700, 1800, 1900, 2000];

CENTURY_MARKERS.forEach((year) => {
  timelineInstance.current!.addCustomTime(
    new Date(`${year}-01-01`),
    `century-${year}`
  );
  timelineInstance.current!.setCustomTimeMarker(`${year}`, `century-${year}`, false);
});
```

#### 3. Card template rewrite
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: Replace the template function (`TimelineView.tsx:77-89`)
with the NMA-style full-bleed image card. Date is rendered as full prose
via `Intl.DateTimeFormat`.

```tsx
const formatProseDate = (iso: string): string => {
  // Handle pre-1000 dates that JS Date misparses by zero-padding.
  const [y, m, d] = iso.split('-');
  const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m ?? '1', 10) - 1, parseInt(d ?? '1', 10)));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
    timeZone: 'UTC',
  }).format(date);
};

// inside options:
template: (item: any, _element: HTMLElement, data: any) => {
  const incident = incidents.find((i) => i.id === item.id);
  const imageUrl = incident?.media?.[0]?.url;
  const proseDate = formatProseDate(item.start as string);
  const initial = (incident?.title || '?').charAt(0).toUpperCase();
  const fallbackHue = Math.abs(
    [...(incident?.id ?? '')].reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)
  ) % 360;

  return `
    <div class="timeline-card">
      ${imageUrl
        ? `<img src="${imageUrl}" alt="" class="timeline-card-image" />`
        : `<div class="timeline-card-fallback" style="--hue:${fallbackHue}">
             <span>${initial}</span>
           </div>`
      }
      <div class="timeline-card-overlay">
        <div class="timeline-card-date">${proseDate}</div>
        <div class="timeline-card-title">${item.content}</div>
      </div>
    </div>
  `;
}
```

#### 4. CSS rewrite
**File**: `src/components/timeline/timeline.css`
**Changes**: Replace the entire current file. The new file: drops every
`.incident-*` rule, deletes the unified slate border, sizes cards to
180×150, paints the overlay gradient, styles the century markers, and
hides vis-timeline's default time axis and group separator chrome.

```css
/* ============================================================
   Card
   ============================================================ */
.timeline-card {
  width: 180px;
  height: 150px;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
  background: #1F1F1F;
}

.timeline-card:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}

.timeline-card-image,
.timeline-card-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.timeline-card-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    hsl(var(--hue), 22%, 28%),
    hsl(var(--hue), 22%, 18%)
  );
  color: rgba(255, 255, 255, 0.85);
  font: 700 56px/1 'Public Sans', sans-serif;
}

.timeline-card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 10px 12px;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.75) 0%,
    rgba(0, 0, 0, 0) 55%
  );
  color: #fff;
}

.timeline-card-date {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.9);
  margin-bottom: 4px;
}

.timeline-card-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ============================================================
   Stage / vis-timeline chrome overrides
   ============================================================ */
.vis-timeline {
  border: none;
  background: transparent;
  color: #fff;
}

.vis-panel.vis-background,
.vis-panel.vis-center,
.vis-panel.vis-left,
.vis-panel.vis-right {
  background: transparent;
  border: none;
}

.vis-time-axis .vis-text,
.vis-time-axis .vis-grid {
  display: none;
}

.vis-labelset .vis-label {
  display: none;
}

.vis-foreground .vis-group {
  border: none;
}

.vis-item {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}

.vis-item.vis-selected {
  outline: 2px solid #2EB6B0;
  outline-offset: 2px;
  background: transparent;
}

/* ============================================================
   Century markers (in-stage, on the centerline)
   ============================================================ */
.vis-custom-time {
  background: transparent;
  border: none;
  pointer-events: none;
  width: 0;
}

.vis-custom-time .vis-custom-time-marker {
  position: absolute;
  top: 50%;
  transform: translate(8px, -50%);
  color: #2EB6B0;
  font: 600 56px/1 'Public Sans', sans-serif;
  white-space: nowrap;
  pointer-events: none;
}

/* ============================================================
   Stage scrollbar
   ============================================================ */
.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}
.overflow-x-auto::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.06);
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}
```

#### 5. Item-className cleanup
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: The mapping in step 1 already drops
`className: incident-<category>`. Verify no other site re-adds it.

#### 6. vis-timeline options tweaks
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: In the `options` object, set
`stack: false` (we now use groups for lane assignment) and bump
`margin.item` so cards don't kiss.

```ts
const options: TimelineOptions = {
  orientation: 'top',
  horizontalScroll: true,
  stack: false,
  zoomMin: 1000 * 60 * 60 * 24 * 365,
  zoomMax: 1000 * 60 * 60 * 24 * 365 * 1400,
  editable: { add: false, updateTime: false, remove: false },
  selectable: true,
  showCurrentTime: false,
  onMove: (item: any, callback: (item: any) => void) => callback(item),
  margin: { item: 12, axis: 30 },
  template: /* …from step 3… */,
};
```

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] No `.incident-` rules remain in CSS:
      `grep -n '.incident-' src/components/timeline/timeline.css` returns nothing.
- [x] No `className: 'incident-'` in TS:
      `grep -n "incident-\${" src/components/timeline/TimelineView.tsx` returns nothing.

#### Manual Verification
- [ ] Cards render as 180×150 image tiles with a bottom gradient and
      white prose-date kicker + title overlay.
- [ ] Cards split visibly into two lanes (top / bottom of the stage).
- [ ] Teal century numerals (`600`, `700`, …, `2000`) sit on the centerline.
- [ ] Mouse wheel scrolls horizontally; clicking a card still opens the
      (old, Phase 5–pending) modal.
- [ ] No category accent colours appear anywhere on the timeline.

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Image Fallback Hardening

### Overview

Phase 3 already wires a tinted-letter fallback into the template. This
phase verifies it across all 16 incidents, ensures the hue distribution
is readable, and adds a tiny visual test page so we can eyeball every
fallback at once.

### Changes Required

#### 1. Confirm fallback paint
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: None expected. Verify the fallback path triggers when
`incident.media?.[0]?.url` is missing (all 16 incidents qualify today).

#### 2. Loose contrast guard
**File**: `src/components/timeline/timeline.css`
**Changes**: Tighten the fallback gradient if any incident reads as
illegible. The current rule already uses fixed lightness levels
(`28%` and `18%`) chosen for white text contrast; add a stronger overlay
fallback in case a hue lands too light.

```css
.timeline-card-fallback::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to top,
    rgba(0, 0, 0, 0.55) 0%,
    rgba(0, 0, 0, 0) 70%
  );
  pointer-events: none;
}
```

#### 3. Optional: per-incident image slot
**File**: `src/data/incidents.json`
**Changes**: Add `media: []` to incidents that don't have it so the
field exists even when empty (improves TypeScript narrowing later). This
is a no-op for the runtime fallback. Apply across all 16 entries with a
single `jq` pass or by hand.

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] All 16 incidents satisfy the schema:
      `node -e "const d = require('./src/data/incidents.json'); console.assert(d.every(i => i.id && i.title && i.startDate))"`

#### Manual Verification
- [ ] Every card on the timeline shows a coloured tile with the title's
      first letter (no broken-image icons, no black rectangles).
- [ ] Hues vary across incidents; same-titled letters in different
      incidents get different hues.
- [ ] White overlay text remains legible on every fallback hue.

**Implementation Note**: Pause for manual confirmation before Phase 5.

---

## Phase 5: Inline Detail Panel

### Overview

Rewrite `IncidentDetailModal` from a centred dialog into the NMA-style
full-bleed inline panel: two columns on desktop (hero image + caption
left, text right), circular `×` close in the top-right, teal pill CTA
stub. Drop the category/dynasty/region pills, the metadata grid and the
related-events block — those belong on the (future) article page.

### Changes Required

#### 1. Component rewrite
**File**: `src/components/common/IncidentDetailModal.tsx`
**Changes**: Replace the entire file.

```tsx
import { useEffect } from 'react';
import { HistoricalIncident } from '../../types/incident';

interface IncidentDetailModalProps {
  incident: HistoricalIncident | null;
  onClose: () => void;
  relatedIncidents: HistoricalIncident[]; // retained for prop compat; unused in NMA layout
}

const formatProseDate = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  const date = new Date(Date.UTC(parseInt(y, 10), parseInt(m ?? '1', 10) - 1, parseInt(d ?? '1', 10)));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-AU', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
    timeZone: 'UTC',
  }).format(date).toUpperCase();
};

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
}) => {
  useEffect(() => {
    if (!incident) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [incident, onClose]);

  if (!incident) return null;

  const heroUrl = incident.media?.find((m) => m.type === 'image')?.url;
  const heroCaption = incident.media?.find((m) => m.type === 'image')?.caption;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-headline"
      className="fixed inset-0 z-50 bg-panel overflow-y-auto"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close detail panel"
        className="absolute top-6 right-6 w-10 h-10 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors z-10"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6L18 18M6 18L18 6" />
        </svg>
      </button>

      {/* Two-column body */}
      <div className="max-w-6xl mx-auto px-8 md:px-16 py-16 grid md:grid-cols-2 gap-12">
        {/* Hero image + caption */}
        <figure>
          {heroUrl ? (
            <img
              src={heroUrl}
              alt={heroCaption ?? incident.title}
              className="w-full aspect-[4/3] object-cover rounded-sm"
            />
          ) : (
            <div className="w-full aspect-[4/3] rounded-sm bg-slate-200 flex items-center justify-center text-slate-400">
              <span className="font-serif italic">No image available</span>
            </div>
          )}
          {heroCaption && (
            <figcaption className="mt-3 text-xs italic text-slate-500">
              {heroCaption}
            </figcaption>
          )}
        </figure>

        {/* Text column */}
        <div>
          <div className="text-xs font-semibold tracking-widest text-slate-500 mb-3">
            {formatProseDate(incident.startDate)}
          </div>

          <h2
            id="incident-headline"
            className="text-3xl md:text-4xl font-bold text-teal-nma mb-6"
          >
            {incident.title}
          </h2>

          <p className="text-base text-slate-700 leading-relaxed mb-8">
            {incident.description}
          </p>

          <button
            type="button"
            disabled
            title="Article page coming soon"
            className="bg-teal-nma hover:bg-teal-nma/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold tracking-wider uppercase px-6 py-3 rounded-full transition-colors"
          >
            Read more about this moment
          </button>
        </div>
      </div>
    </div>
  );
};
```

#### 2. Drop the now-unused `categoryColors` map
The previous file's `categoryColors` object (`IncidentDetailModal.tsx:10-16`)
no longer exists after the rewrite. Confirm:

```bash
grep -n 'categoryColors' src/components/common/IncidentDetailModal.tsx
# (expect: no output)
```

#### 3. `relatedIncidents` prop kept but unused
The `App.tsx` call-site at `App.tsx:104-110` still passes
`relatedIncidents`. Keep the prop on the component (typed but unused) so
we don't need to touch `App.tsx` in this phase. The Phase 6 cleanup
removes the prop entirely along with `getRelatedIncidents`.

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] `IncidentDetailModal.tsx` no longer references `categoryColors`,
      `dynasty`, `region`, or `connections`:
      `grep -nE 'categoryColors|dynasty|region|connections' src/components/common/IncidentDetailModal.tsx`
      returns nothing.

#### Manual Verification
- [ ] Clicking any timeline card opens a full-bleed off-white panel
      (no dark backdrop).
- [ ] Hero image (or fallback) sits on the left; date kicker / teal
      headline / body / disabled teal pill on the right.
- [ ] Circular `×` button in top-right closes the panel.
- [ ] Pressing `Escape` closes the panel.
- [ ] Headline is teal (`#1B8A87`).
- [ ] No category pills, no metadata grid, no related events block
      anywhere on the panel.
- [ ] Hovering the "Read more" button shows the "coming soon" tooltip
      and the button cannot be clicked (disabled).

**Implementation Note**: Pause for manual confirmation before Phase 6.

---

## Phase 6: Filter / Map / Graph Relocation & De-emphasis

### Overview

The NMA timeline is the visual hero; surrounding content needs to step
down so the stage above it feels finished. Move `FilterBar`, `MapView`
and `GraphView` into the secondary section, remove residual category
colours from the remaining components, and clean up dead props.

### Changes Required

#### 1. Drop category colours from sibling components

**File**: `src/components/common/IncidentCard.tsx`
**Changes**: Delete `categoryColors` (`IncidentCard.tsx:9-15`) and the
coloured dot (`IncidentCard.tsx:31`). Render a category text tag instead.

```tsx
export const IncidentCard: React.FC<IncidentCardProps> = ({ incident, onClick }) => {
  return (
    <div
      onClick={() => onClick(incident)}
      className="bg-white rounded-md border border-slate-200 p-4 cursor-pointer hover:border-slate-400 transition-colors"
    >
      <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
        {incident.category}
      </div>
      <h3 className="font-semibold text-slate-900">{incident.title}</h3>
      <p className="text-sm text-slate-600 mt-1">
        {new Date(incident.startDate).toLocaleDateString()}
      </p>
      <p className="text-xs text-slate-500 mt-1">{incident.location.name}</p>
    </div>
  );
};
```

**File**: `src/components/graph/GraphView.tsx`
**Changes**: Replace `nodeStyleMap` (`GraphView.tsx:27-33`) with a single
uniform style.

```tsx
const NODE_STYLE: React.CSSProperties = {
  backgroundColor: '#1B8A87',
  color: 'white',
  padding: '10px',
  borderRadius: '8px',
  width: '200px',
};

// Inside the node mapping (GraphView.tsx:52-66):
const graphNodes: Node<IncidentNodeData>[] = incidents.map((incident) => ({
  id: incident.id,
  type: 'default',
  position: { x: 0, y: 0 },
  data: { label: incident.title, incident },
  style: NODE_STYLE,
}));
```

**File**: `src/components/map/MapMarker.tsx`
**Changes**: Replace the broken Tailwind-classname-as-CSS injection
(`MapMarker.tsx:21`) with a literal hex value, using the NMA teal.

```tsx
const MARKER_COLOR = '#1B8A87';

const customIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${MARKER_COLOR}; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
```

Delete the `categoryIcons` map at the top of the file
(`MapMarker.tsx:5-11`).

#### 2. Tone down secondary section in App.tsx

**File**: `src/App.tsx`
**Changes**: After the stage `<section>`, wrap the remaining views in a
single secondary section with a contrasting light background and a
section header.

```tsx
<section className="bg-panel">
  <div className="container mx-auto p-6 space-y-8">
    <header className="border-b border-slate-200 pb-4">
      <h2 className="text-xs uppercase tracking-widest text-slate-500">Explore further</h2>
    </header>

    <FilterBar ... />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MapView ... />
      <GraphView ... />
    </div>

    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">All moments</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {incidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} onClick={handleIncidentClick} />
        ))}
      </div>
    </div>
  </div>
</section>
```

#### 3. Clean up `App.tsx` dead state

**File**: `src/App.tsx`
**Changes**: After the Phase 5 modal rewrite, `relatedIncidents` is
unused. Delete `getRelatedIncidents` (`App.tsx:28-35`) and drop the
`relatedIncidents` prop from the modal call site
(`App.tsx:104-110`). Also remove the unused `relatedIncidents` prop from
`IncidentDetailModalProps` in `IncidentDetailModal.tsx`.

```tsx
{selectedIncident && (
  <IncidentDetailModal
    incident={selectedIncident}
    onClose={handleCloseModal}
  />
)}
```

#### 4. FilterBar visual refresh

**File**: `src/components/common/FilterBar.tsx`
**Changes**: Restyle to match the off-white panel. Same controls; just
swap `bg-gray-100` for `bg-white border border-slate-200 rounded-md` and
tighten input styles.

```tsx
return (
  <div className="bg-white border border-slate-200 rounded-md p-4">
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <select className="p-2 border border-slate-300 rounded text-sm" ...>...</select>
      <select className="p-2 border border-slate-300 rounded text-sm" ...>...</select>
      <input  className="p-2 border border-slate-300 rounded text-sm" ... />
      <input  className="p-2 border border-slate-300 rounded text-sm" ... />
    </div>
  </div>
);
```

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] No `bg-blue-500`/`bg-green-500`/`bg-purple-500`/`bg-yellow-500`/`bg-red-500`
      remain in `src/components`:
      `grep -RnE 'bg-(blue|green|purple|yellow|red)-500' src/components` returns nothing.
- [x] No `getRelatedIncidents` in `App.tsx`:
      `grep -n 'getRelatedIncidents' src/App.tsx` returns nothing.

#### Manual Verification
- [ ] Below the stage, an "Explore further" section header appears,
      followed by filters, map+graph side-by-side, and the full card grid.
- [ ] Map markers are teal `#1B8A87` circles (no literal "bg-blue-500"
      text rendering inside markers).
- [ ] Graph nodes are uniform teal; no rainbow.
- [ ] Filter bar styling reads as a quiet white panel rather than the
      previous grey block.
- [ ] Clicking any incident still opens the Phase 5 inline detail panel.
- [ ] Closing the panel returns the user to the same scroll position
      in the timeline.

**Implementation Note**: Pause for manual confirmation before Phase 7.

---

## Phase 7: Typography, Polish & Accessibility

### Overview

Final pass: make sure Public Sans is the resolved font everywhere
(some CSS rules still hard-code the system-font stack), add keyboard +
ARIA support for the era top bar, sliding underline reduced-motion
fallback, focus states.

### Changes Required

#### 1. Drop residual system-font stacks
**File**: `src/components/timeline/timeline.css`
**Changes**: Replace any remaining `font-family: -apple-system, ...`
declarations (originals at `timeline.css:128-140` in the pre-Phase-3
file) with `font-family: inherit;`. Since `<body>` already carries
`font-sans` (mapped to Public Sans in Tailwind), inherit is enough.

```css
.vis-item,
.vis-label,
.overflow-x-auto button {
  font-family: inherit;
}
```

#### 2. Keyboard navigation on top bar
**File**: `src/components/timeline/TimelineTopBar.tsx`
**Changes**: Make the buttons reachable via Tab and respond to
arrow keys. Add focus-visible ring.

```tsx
const onKey = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
  if (e.key === 'ArrowRight') {
    const next = ERA_MARKERS[Math.min(idx + 1, ERA_MARKERS.length - 1)];
    buttonRefs.current[next.year]?.focus();
    onEraChange(next.year);
  } else if (e.key === 'ArrowLeft') {
    const prev = ERA_MARKERS[Math.max(idx - 1, 0)];
    buttonRefs.current[prev.year]?.focus();
    onEraChange(prev.year);
  }
};

// in the map:
<button
  key={era.year}
  ref={(el) => { buttonRefs.current[era.year] = el; }}
  onClick={() => onEraChange(era.year)}
  onKeyDown={(e) => onKey(e, idx)}
  className="... focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
>
  {era.label}
</button>
```

#### 3. Reduced motion
**File**: `src/index.css`
**Changes**: Add a global rule so the sliding underline doesn't animate
for users who request reduced motion.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.001ms !important;
    animation-duration: 0.001ms !important;
  }
}
```

#### 4. ARIA labels
**File**: `src/components/timeline/TimelineView.tsx`
**Changes**: Add `role="region"` and `aria-label="Historical timeline"`
to the vis-timeline container `<div>`.

```tsx
<div
  ref={timelineRef}
  className="h-[520px] min-w-full"
  role="region"
  aria-label="Historical timeline"
/>
```

#### 5. Modal title font-weight
**File**: `src/components/common/IncidentDetailModal.tsx`
**Changes**: Public Sans 700 reads slightly heavier than NMA's headlines.
Step down to 600 if it looks too bold.

```tsx
<h2
  id="incident-headline"
  className="text-3xl md:text-4xl font-semibold text-teal-nma mb-6"
>
```

### Success Criteria

#### Automated Verification
- [x] `npm run build` succeeds.
- [ ] `npm run lint` passes. *(blocked: eslint not installed — same pre-existing gap surfaced in Phase 1)*
- [x] No system-font stacks remain in component CSS:
      `grep -Rn 'BlinkMacSystemFont' src` returns nothing.
- [x] No `font-family: -apple-system` in component CSS:
      `grep -Rn 'apple-system' src` returns nothing.

#### Manual Verification
- [ ] Tab from the address bar lands first on a top-bar era button and
      shows a slate focus ring.
- [ ] Arrow keys move focus and selection along the era markers.
- [ ] Setting the OS to "reduce motion" stops the underline from sliding.
- [ ] Headline weight on the modal looks balanced (not chunky).
- [ ] No regressions in any earlier phase.

---

## Testing Strategy

### Unit Tests
This project has no test framework wired up. Out of scope for this
plan. Each phase relies on `tsc` (via `npm run build`) for type-level
verification and `eslint` for static checks.

### Integration / Manual Test Pass

Run after Phase 7 lands; the same checklist is the regression suite:

1. `npm run dev` boots and the stage paints olive within 1 s.
2. Public Sans is the rendered font on `<h1>` / `<body>`.
3. Top bar shows `Earlier` + `600`–`2000` century markers.
4. Clicking `1000` underlines `1000` with a sliding indicator.
5. Mouse-wheel scroll moves the timeline horizontally.
6. Each card has an image or coloured-letter fallback, prose date kicker,
   and 2–3 line title overlay.
7. Cards alternate between top and bottom lanes.
8. Teal century numerals are visible on the centerline.
9. Clicking a card opens the off-white inline detail panel with
   teal headline + body + disabled teal pill.
10. `×` and `Escape` close the panel.
11. Below the stage, the "Explore further" section shows filters,
    teal-only map markers, teal-only graph nodes, and the card grid.
12. No category accent colours (blue / green / purple / yellow / red dots
    or borders) appear anywhere.
13. Tab + arrow keys navigate the top bar.
14. Reduced-motion OS setting disables the underline animation.

## Performance Considerations

- vis-timeline handles tens of thousands of items; 16 incidents is well
  inside its comfortable range.
- The tinted-letter fallback is pure CSS; no per-card image network calls
  until real imagery lands.
- The detail panel is mounted lazily (only when `selectedIncident` is
  non-null), so its tree adds zero cost when closed.
- Public Sans is loaded via Google Fonts with `display=swap`; the font
  request is `<link rel="preconnect">`-warmed in `index.html`.

## Migration Notes

- No schema changes. `HistoricalIncident` (`src/types/incident.ts:13-26`)
  is unchanged. Phase 4 adds an optional empty `media: []` to incidents
  that lack it, which is forward-compatible with the existing optional
  field.
- The five-colour category palette is removed from rendering but the
  `category` field itself is preserved in data — it surfaces as text on
  `IncidentCard` after Phase 6.
- `App.tsx`'s `selectedEra` local state (`App.tsx:26`) migrates into
  `useIncidents()` in Phase 1; consumers should destructure from the hook
  going forward.

## References

- Research: `thoughts/shared/research/2026-05-15-nma-defining-moments-timeline-visual-replication.md`
- Predecessor plan: `thoughts/shared/plans/2026-05-14-timeline-editorial-redesign.md`
- Original plan: `thoughts/shared/plans/2026-05-13-islamic-history-timeline-web-app.md`
- Library survey: `thoughts/shared/research/2026-05-10-islamic-history-timeline-web-app.md`
- Reference screenshots: `references/image.png`, `references/image copy.png`,
  `references/image copy 2.png`, `references/image copy 3.png`
- NMA Defining Moments timeline: https://www.nma.gov.au/defining-moments/defining-moments-timeline
- vis-timeline `customTimes` API: https://visjs.github.io/vis-timeline/docs/timeline/#Methods
- Public Sans typeface: https://public-sans.digital.gov/
