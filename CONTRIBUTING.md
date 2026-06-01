# Contributing to The Chronicle of Light

Thank you for your interest in contributing! This guide covers the ways you can help: contributing **historical events** (in the app or by pull request) and contributing **code**.

## Contributing Historical Events (Most Common)

The dataset is the heart of this project. Most contributions are adding new events, correcting existing ones, or enriching connections between events. There are two paths — pick whichever suits you.

### Option A — In the app (easiest, no git required)

The live app has a built-in, moderated contribution workflow:

1. Open the app and **sign in with Google** (top-right of the nav bar).
2. To **edit** an event: open it and click **Suggest an edit**.
   To **add** an event: click **Add event** on the timeline.
3. Fill in the form (you can add a note for the reviewer) and submit.
4. Your submission is saved as **pending** — it does *not* change the live data yet. Track its status (pending / approved / rejected) under **My contributions** in the account menu; you can withdraw it while it's still pending.
5. A maintainer reviews it in the **Review queue**. Once **approved**, the change goes live immediately for everyone.

The same content guidelines below (neutrality, sources, contested events) apply to in-app submissions.

### Option B — Via a pull request

You can also edit the dataset directly in git. Each event is one JSON file under `src/data/events/`.

> **Heads-up:** these JSON files are a **backup mirror** of the Supabase database (a scheduled job overwrites them from the live data). For anything beyond a small fix, coordinate with a maintainer first so your PR isn't overwritten by a sync — larger direct changes are best applied through the seed/backup tooling. See [`docs/SETUP.md`](docs/SETUP.md).

#### Adding a New Event

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

#### Editing an Existing Event

Edit the JSON file directly. If you rename an event, update every `connections[]` reference that points to the old id. Run `npm run validate:events` to catch dangling references.

#### Enriching Connections

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

**In-app submissions:**

1. Your edit/new event is queued as **pending** — the live data is unchanged.
2. A maintainer reviews it in the **Review queue**, comparing your proposal against the current event field-by-field.
3. **Approved** submissions go live immediately and are later mirrored into the repo by the backup job. **Rejected** ones get a reason; you can revise and resubmit.

**Pull requests:**

1. CI runs lint, build, and event validation
2. The maintainer reviews the PR within a few days
3. Feedback may be requested — iterate by pushing to your branch
4. The maintainer merges approved PRs

**Note:** The repository maintainer has final say on all merges and submissions to ensure data quality and historical accuracy.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## Questions?

Open an issue using the [event addition](https://github.com/rafsunsheikh/The-Chronicle-of-Light/issues/new?template=event_addition.md) or [feature request](https://github.com/rafsunsheikh/The-Chronicle-of-Light/issues/new?template=feature_request.md) templates.
