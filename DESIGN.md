---
name: The Chronicle of Light
description: A museum-style timeline of Islamic history with a quiet teal accent on a paper ground
colors:
  navy-ink: "#0C2230"
  teal-accent: "#1B8A87"
  teal-bright: "#2EB6B0"
  signal-red: "#E2231A"
  stage-olive: "#4A4B2A"
  stage-olive-light: "#525630"
  rail-grey: "#CBD5E1"
  paper-ground: "#FAFAF7"
  sheet-white: "#FFFFFF"
  ink-900: "#0F172A"
  ink-800: "#1E293B"
  ink-700: "#334155"
  ink-600: "#475569"
  ink-500: "#64748B"
  ink-400: "#94A3B8"
  line-300: "#CBD5E1"
  line-200: "#E2E8F0"
  line-100: "#F1F5F9"
  amber-tint: "#FEF3C7"
  amber-ink: "#92400E"
  emerald-tint: "#D1FAE5"
  emerald-ink: "#065F46"
  rose-ink: "#E11D48"
typography:
  headline:
    fontFamily: "Public Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Public Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Public Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Public Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.1em"
  chip:
    fontFamily: "Public Sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal-accent}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink-700}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink-900}"
    rounded: "{rounded.sm}"
    padding: "8px"
  nav-bar:
    backgroundColor: "{colors.navy-ink}"
    textColor: "{colors.sheet-white}"
    height: "56px"
---

# Design System: The Chronicle of Light

## Overview

**Creative North Star: "The Museum Wall"**

The site reads like the wall text of a history museum: a dark navy bar carries the name, the content sits on an off-white paper ground, and each event is a white card with a small category label above a plain title. The look was modelled on the National Museum of Australia's Defining Moments timeline, and its restraint is the point: history is the picture, the interface is the frame. Density is moderate; cards and lists breathe at 16 px, and nothing competes with the timeline, map and graph that hold the events.

One teal accent does all the signalling: the primary button, links, the progress fill, the active marker. Status is told with pale tints and dark ink of the same hue (amber for running, emerald for done, rose for failed). Maintainer screens (review, admin) are quieter still: white panels on the paper ground, divided by one-pixel slate lines, no shadows at rest.

**Key Characteristics:**
- Navy bar, paper ground, white sheets: three surfaces, no gradients.
- One accent (teal) on actions and progress; status by pale tint and matching ink.
- Small uppercase tracked labels name a card's category or a field; titles and body stay sentence case.
- Pill buttons, 4 to 8 px radii on cards and fields, one-pixel borders instead of shadows.

## Colors

A paper ground, slate inks, one teal accent, and a museum-dark navy for the frame.

### Primary
- **Teal accent** (#1B8A87): the one action colour. Primary buttons, links in body text, progress bars, the selected marker. Its brighter sibling **Teal bright** (#2EB6B0) is for hover and for marks on the dark navy bar.

### Secondary
- **Navy ink** (#0C2230): the navigation bar and the dark frame around the timeline. Text on it is white at full and reduced opacities.
- **Stage olive** (#4A4B2A) and **Stage olive light** (#525630): the timeline stage behind the event rail, inherited from the museum model; not used on maintainer screens.

### Neutral
- **Paper ground** (#FAFAF7): the page background behind every panel.
- **Sheet white** (#FFFFFF): cards, forms, lists.
- **Ink 900 to Ink 400** (#0F172A, #1E293B, #334155, #475569, #64748B, #94A3B8): titles in 900 or 800, body in 700 or 600, secondary notes in 500, placeholders in 400.
- **Line 300, 200, 100** (#CBD5E1, #E2E8F0, #F1F5F9): field borders, card borders, row dividers, in that order of strength. **Rail grey** (#CBD5E1) is the timeline rail.
- **Signal red** (#E2231A): error text and the destructive hover only.
- **Amber tint / ink** (#FEF3C7 / #92400E), **Emerald tint / ink** (#D1FAE5 / #065F46), **Rose ink** (#E11D48): status pills for running, done and failed; a neutral slate pair for queued and cancelled.

### Named Rules
**The One Accent Rule.** Teal is the only saturated colour on a maintainer screen, and it marks what the person can do or what is moving: the primary button, a link, a progress fill. Status never uses teal.
**The Tint Pair Rule.** A status is a pale tint with the dark ink of the same hue, never a saturated fill with white text.

## Typography

**Display Font:** Public Sans (with system-ui)
**Body Font:** Public Sans (with system-ui)

**Character:** One humanist grotesque at four weights (400 to 700), set small and even; hierarchy comes from weight and colour more than size. Nothing on the site is larger than a 24 px headline.

### Hierarchy
- **Headline** (600, 24px, 1.25): the page title on maintainer screens ("AI jobs").
- **Title** (600, 16px, 1.4): a card's or an event's title, in Ink 900.
- **Body** (400, 14px, 1.5): running text, form fields, table cells, in Ink 700 or 600.
- **Small** (400, 12px, 1.5): secondary notes, timestamps, in Ink 500.
- **Label** (600, 10px, 0.1em tracking, uppercase): the category above a card title, a field's name, a section heading on maintainer screens, in Ink 500.
- **Chip** (600, 11px, sentence case): the text inside a status pill on maintainer screens; 11px is the floor for anything a person must read at a glance.

### Named Rules
**The Label Rule.** The 10 px tracked uppercase label is for naming a field or a category, one per block; it is never a heading over a paragraph of prose and never carries a number.
**The Tabular Rule.** Columns of figures use `tabular-nums` and right alignment.

## Layout

Maintainer pages sit in a centred column of up to 64 rem (`max-w-5xl`) with 16 px side padding on phones and 24 px from the `sm` breakpoint, under the 56 px navy bar, scrolling inside the page shell. Blocks stack with 32 px between sections and 16 px inside cards; forms use a two-column grid from the `md` breakpoint with a 16 px gap and single column below. The timeline, map and graph fill the remaining viewport height. Nothing is wider than its column; tables scroll sideways inside their card on a phone rather than breaking the page.

## Elevation & Depth

Flat by default. Panels are separated from the paper ground by white fill and a one-pixel Line 200 border; rows by Line 100 dividers. The only shadows are the navy bar's `shadow-md` against the page and the map's hover card, which floats. Nothing at rest carries a shadow on maintainer screens.

### Named Rules
**The Border-Not-Shadow Rule.** Depth on a flat screen is a one-pixel line one step darker than the surface, never a drop shadow.

## Shapes

Small radii throughout: 4 px (`rounded`) on inputs, 6 px (`rounded-md`) on cards and panels, 8 px (`rounded-lg`) on review list items, and fully round pills (`rounded-full`) for buttons, status chips and the search field. Corners are consistent inside one screen: a card and its inner table share the 6 px radius. No clipped or angled shapes.

## Components

### Buttons
- **Shape:** fully round pill (9999 px).
- **Primary:** Teal accent fill, white text, 10 px label type (600, uppercase, 0.1em tracking), 10 px by 20 px padding. Disabled: Line 300 fill, same text.
- **Hover / Focus:** teal at 90 percent opacity on hover; the browser's focus ring stays visible.
- **Secondary:** white fill with a Line 300 border and Ink 700 text, same shape and size; hover tints the fill to Line 100.
- **Text action:** a 12 px Ink 500 link that turns Signal red on hover for a destructive act such as cancel.

### Chips
- **Style:** pill, 10 px label type, 2 px by 8 px padding, a pale tint with matching dark ink: slate for queued and cancelled, amber for running, emerald for done, rose for failed.
- **State:** chips are read-only status marks; they never act as filters here.

### Cards / Containers
- **Corner Style:** 6 px.
- **Background:** Sheet white on the paper ground.
- **Shadow Strategy:** none; see Elevation.
- **Border:** one pixel Line 200.
- **Internal Padding:** 16 px, 24 px on wide forms.

### Inputs / Fields
- **Style:** white, one pixel Line 300 border, 4 px radius, 8 px padding, 14 px body text; a 10 px tracked label above.
- **Focus:** the default focus outline; the navy search field brightens its border instead.
- **Error:** the message in Signal red at 14 px beside the submit button.

### Navigation
- **Style:** a 56 px Navy ink bar with the wordmark at the left ("The" as a 10 px tracked label over "Chronicle of Light" in bold), route links as white tabs with reduced opacity when inactive, a round search field in white at 10 percent, and the account menu at the right. On phones the links scroll sideways inside the bar.

### Progress bar
A 6 px track in Line 100 with a teal fill at the true ratio, under a 12 px Ink 600 line that names the stage and the count ("extracting events from chunk 18 of 59").

## Do's and Don'ts

### Do:
- **Do** put one teal action per screen and leave everything else slate.
- **Do** separate panels with a one-pixel Line 200 border on white over the paper ground.
- **Do** name a status with a pale tint and its matching dark ink, in the 10 px label type.
- **Do** right-align figures with tabular numerals in any column of numbers.
- **Do** keep every control at least 44 px tall on phones and keep the focus ring visible.

### Don't:
- **Don't** add gradients, drop shadows at rest, or icon tiles.
- **Don't** use teal for status or decoration; it means action or progress.
- **Don't** introduce a second typeface or a headline above 24 px on maintainer screens.
- **Don't** fill a status pill with a saturated colour and white text.
