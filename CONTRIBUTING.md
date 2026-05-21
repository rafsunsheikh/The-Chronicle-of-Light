# Contributing to The Chronicle of Light

Thank you for interested in contributing! This guide covers the two main ways you can help.

## Contributing Historical Events (Most Common)

The dataset is the heart of this project. Most contributions are adding new events, correcting existing ones, or enriching connections between events.

### Adding a New Event

1. Fork the repository and create a branch from `main`
2. Create a new file at `src/data/events/event-YYYY-slug.json`
3. Fill in the required fields:

```json
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

4. **Naming rules:**
   - `id` format: `event-YYYY-slug` (4-digit zero-padded year + kebab-case slug)
   - Filename must match the `id` exactly (e.g., `event-0624-battle-of-badr.json`)
   - Years are always zero-padded to 4 digits (`0624` not `624`)

5. **Cite sources** — include at least one `sources` entry:

```json
"sources": [
  {
    "citation": "Ibn Ishaq, Sirat Rasul Allah, trans. A. Guillaume",
    "url": "https://example.com/source",
    "page": "123"
  }
]
```

6. Run validation locally:

```bash
npm install
npm run validate:events
```

7. Submit a PR — CI runs the same validation automatically

### Editing an Existing Event

Edit the JSON file directly. If you rename an event, update every `connections[]` reference that points to the old id. Run `npm run validate:events` to catch dangling references.

### Enriching Connections

Link related events by adding event IDs to the `connections` array. This powers the 3-D graph visualization. Cross-references are validated in CI — every ID must resolve to an existing event.

### Content Guidelines

- **Be neutral** — describe events factually without sectarian bias
- **Cite sources** — uncited claims may be requested for references
- **Mark contested events** — use `"confidence": "contested"` and list `perspectives` (sunni, shia, academic, secular) when multiple scholarly traditions disagree
- **Batch small** — submit ~10 events per PR for manageable reviews

## Contributing Code

### Development Setup

```bash
git clone git@github.com:YOUR_USERNAME/The-Chronicle-of-Light.git
cd The-Chronicle-of-Light
npm install
npm run dev
```

### Before Submitting

```bash
npm run lint          # ESLint checks
npm run build         # TypeScript + Vite build
npm run validate:events  # Dataset validation
```

All three must pass — CI enforces this on every PR.

### Code Style

- TypeScript strict mode is enabled
- React functional components with hooks
- Tailwind CSS for styling
- Follow existing patterns in `src/components/`

## What Happens After You Submit

1. CI runs lint, build, and event validation
2. The maintainer reviews the PR within a few days
3. Feedback may be requested — iterate by pushing to your branch
4. The maintainer merges approved PRs

**Note:** The repository maintainer has final say on all merges to ensure data quality and historical accuracy.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Questions?

Open an issue using the [event addition](https://github.com/rafsunsheikh/The-Chronicle-of-Light/issues/new?template=event_addition.md) or [feature request](https://github.com/rafsunsheikh/The-Chronicle-of-Light/issues/new?template=feature_request.md) templates.
