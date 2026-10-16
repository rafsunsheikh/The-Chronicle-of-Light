# Roadmap: Islamic Renaissance section, open library, video, and AI knowledge extraction

**Date:** 2026-10-16
**Author:** MD Rafsun Sheikh
**Status:** Planning. Tracked in GitHub issues (see the "Tracking" section at the end).

## What this plan covers

The backlog captured on 2026-10-16 asks for ten things. In plain words:

1. Track the work as GitHub issues.
2. Plan before building.
3. Add a section on the Islamic Renaissance (the Islamic Golden Age, roughly the 8th to the 14th century).
4. Collect books, reports and articles from the open internet and file them by category inside that section.
5. Borrow the summarising and job-running design from Prometheus, and add an admin area where only the owner can start AI runs while everyone else can only read.
6. Publish at little or no cost. Stay on GitHub Pages until the app matures.
7. Show YouTube and other open video sources.
8. Put full books on the site for people to read.
9. Convert every source material to Markdown before any AI reads it.
10. Have Claude use a dedicated agent to pull timeline events out of the books the owner shares.

One change from the original backlog: item 8 asked for books from Anna's Archive. That site
distributes copyrighted books without permission, so hosting those on a public GitHub Pages
site would be copyright infringement and would put the repository at risk of a takedown.
This plan hosts only public domain and openly licensed books (for example, from the Internet
Archive, Project Gutenberg, HathiTrust and open access publishers), and links out to
everything else. For Islamic history this is a rich pool: most classical Arabic works and the
19th and early 20th century English translations are out of copyright.

## Guiding decisions

- **Stay static.** The public site remains a GitHub Pages site built from files in this repo.
  Anything a visitor reads (events, library entries, summaries, book texts) is a file committed
  to the repo. No visitor ever needs a backend. This keeps hosting free and keeps the
  "dataset as the asset" principle from the open-source launch plan.
- **One backend, for the owner only.** The Prometheus pieces (Cloudflare Worker, D1, R2, home
  runner) are reused only to let the owner queue AI jobs from the browser. Results are written
  back into the repo as a pull request, so they end up as static files like everything else.
- **Markdown is the interchange format.** Every PDF, EPUB, DOCX or web page becomes a
  Markdown file with a small front matter block before an agent or summariser touches it.
- **Humans promote, machines draft.** Same rule as the Wikipedia importer: AI and scripts write
  drafts with `confidence: "auto-imported"`, a person reviews, then promotes.
- **Licence first.** A resource is hosted only when its licence allows redistribution. All
  other resources are linked, never copied.

## Phases and order

Phases are ordered by dependency. Phase 1 unblocks everything else. Phases 2, 3 and 4 can run
in parallel after it.

### Phase 1: Routing, the Islamic Renaissance section, and the library data model

**Why first.** Every other item needs somewhere to live in the UI and a data shape to fill.

**Routing.** The app currently has a single page in `src/App.tsx`. Add `react-router-dom` with
a `HashRouter` (hash URLs such as `/#/renaissance`), because GitHub Pages cannot rewrite deep
links and a plain `/renaissance` would 404 on reload. Prometheus already made this choice for
the same reason. Routes: `/` (timeline, as today), `/renaissance` (the new section),
`/library/:id` (a resource page, later a reader), `/admin` (Phase 6).

**Renaissance section.** A landing page that explains the period in a few paragraphs, then
shows resources grouped by category. Suggested categories, matching how historians usually
divide the period: Science and mathematics, Astronomy, Medicine, Philosophy and theology,
Literature and poetry, Art and architecture, Translation movement, Institutions (House of
Wisdom, madrasas, hospitals), Geography and travel. The section also links to the timeline
events that fall between 750 and 1400 so the two halves of the site reinforce each other.

**Library data model.** One JSON file per resource under `src/data/library/`, mirroring the
one-file-per-event rule. Fields:

```jsonc
{
  "id": "lib-1025-canon-of-medicine",
  "type": "book",                 // book | report | article | video | course
  "title": "The Canon of Medicine",
  "creators": ["Ibn Sina (Avicenna)"],
  "year": 1025,                   // year of the work, not of the edition
  "language": "ar",               // BCP 47 tag of the linked edition
  "categories": ["medicine"],
  "summary": "One paragraph in plain words.",
  "url": "https://archive.org/details/...",
  "license": "public-domain",     // public-domain | cc-by | cc-by-sa | cc-by-nc | all-rights-reserved | unknown
  "hosted": false,                // true only when the full text is in this repo
  "contentPath": null,            // "content/books/<slug>/content.md" when hosted
  "video": null,                  // { "provider": "youtube", "id": "..." } for type video
  "source": { "name": "Internet Archive", "retrieved": "2026-10-16" },
  "relatedEvents": ["event-1025-avicenna-writes-the-canon"],
  "confidence": "established"     // established | auto-imported
}
```

Add `src/data/library.schema.json`, extend `scripts/validate-events.mjs` (or add
`validate-library.mjs`) so CI checks the schema, unique IDs, filename to ID match, licence
values, and that every `relatedEvents` entry points to a real event. Add a `useLibrary` hook
that globs the folder the same way `useIncidents` does.

**Deliverables.** Router, Renaissance page with category grid, resource cards, schema,
validator, CI job, five to ten hand-written seed resources so the page is not empty.

### Phase 2: Collect open resources into the section

**Goal.** Fill the library with books, reports and articles that are free to link or host.

**Sources worth scripting (all have free JSON APIs or bulk catalogues):**

- Internet Archive advanced search (subject filters such as "Islamic civilization",
  "Islamic science", with `licenseurl` or public domain collections).
- Open Library search API for editions and authors.
- Project Gutenberg via the Gutendex API.
- Directory of Open Access Books (DOAB) and OAPEN for modern open access scholarship.
- Wikisource and Wikimedia Commons for translations and images.

**Sources to curate by hand (no API, or licence varies):** Muslim Heritage and 1001 Inventions,
Qatar Digital Library, Archnet, HathiTrust full view items, university open courseware.

**Approach.** A `scripts/library-import/` folder modelled on `scripts/wikipedia-import/`:
query a source, map results into the library schema, write drafts to
`src/data/library/imported/` (gitignored) with `confidence: "auto-imported"`, then a person
reviews, assigns categories, and promotes in batches of about ten per pull request. Reuse the
politeness rules from the Wikipedia importer (user agent string, caching, rate limits).

### Phase 3: Video resources

**Goal.** Show YouTube and other open video sources inside the Renaissance section and on
event detail panels.

**Approach.** A `video` resource type with `provider` and `id`. Render YouTube through the
`youtube-nocookie.com` embed domain, and load the player only after the visitor clicks a
thumbnail, so no YouTube cookies are set by merely opening the page. Support Internet Archive
and PeerTube embeds through the same component. Events get an optional `media[]` entry of type
`video` (the type already exists in the schema) that points at a library video ID.

**Caution.** Embedding is fine under YouTube's terms; downloading or re-hosting YouTube videos
is not, so the site links and embeds only.

### Phase 4: Markdown conversion pipeline

**Goal.** Turn any source file into Markdown before an agent or summariser reads it.

**Approach.** A Node script `scripts/convert/` that takes a path or URL and writes
`content/sources/<slug>/content.md` plus a `meta.json`. Port the browser extraction code from
Prometheus (`apps/web/src/lib/extract.ts`, which uses pdfjs, mammoth, jszip and turndown) to
run in Node. Add HTML to Markdown for web articles (Readability plus turndown). Keep page or
chapter markers in the Markdown so later citations can point to a location. Scanned PDFs need
OCR first; note this limit and leave OCR out of scope for now.

**Where converted text lives.** Private source materials the owner shares (for extraction)
stay out of git under `content/private/` (gitignored). Public domain texts that will be hosted
go under `content/books/` and are committed.

### Phase 5: Knowledge extraction agent

**Goal.** Claude reads a converted book and proposes timeline events and library entries.

**Approach.** A Claude Code subagent definition at `.claude/agents/history-extractor.md` and a
command `/extract-events <path-to-markdown>`. The agent:

1. Chunks the Markdown at headings (reuse the `chunkBook` logic from Prometheus's runner).
2. For each chunk, lists datable, locatable events with the sentence that supports each one.
3. Writes one draft JSON per event into `src/data/events/imported/` matching
   `event.schema.json`, with `confidence: "auto-imported"` and a `sources[]` entry naming the
   book, chapter and page.
4. Suggests `connections[]` to existing events by ID, which the validator then checks.

Prompts live in `scripts/extract/prompts/` as Markdown, in the same style as
`apps/runner/prompts/` in Prometheus. The existing validator and the promote-by-pull-request
workflow stay the only path into the public dataset.

### Phase 6: Reading library

**Goal.** Visitors can read full books on the site.

**Approach.** For hosted (public domain or open licence) books, commit the Markdown under
`content/books/<slug>/` and render it at `/library/:id/read` with a table of contents built from
headings, the same way Prometheus's Reader page renders summaries with `marked`. Book sizes:
a typical text-only book is 0.5 to 2 MB as Markdown, and GitHub Pages serves sites up to about
1 GB, so hundreds of books fit. For scans and large files, link to the Internet Archive viewer
instead of copying.

### Phase 7: Prometheus-style summaries and an admin area

**Goal.** The owner can, from the browser, queue "summarise this book" or "extract events from
this book" jobs that run on the owner's Claude subscription. Everyone else can only read the
results.

**Approach.** Reuse the three Prometheus pieces as they are, with one new rule:

- **Web.** An `/admin` route with Google sign-in. The page shows the job queue and lets the
  signed-in owner queue jobs. Nothing else on the site requires sign-in.
- **API.** The same Cloudflare Worker, with an `ADMIN_EMAILS` secret. Only those addresses may
  create jobs. Public read endpoints are not needed, because results go into the repo.
- **Runner.** The same home runner, extended with the extraction job type from Phase 5. When a
  job finishes, the runner writes the output files into a local checkout and opens a pull
  request with the GitHub CLI. Merging the pull request publishes the result through the
  existing Pages workflow.

This keeps the public site fully static, keeps secrets out of the browser, and reuses tested
code. The Worker, D1 and R2 free tiers cover a single owner's use with room to spare.

### Phase 8: Publishing and cost

**Goal.** Zero or near-zero monthly cost until the app matures.

| Piece | Service | Free tier | Expected cost |
| --- | --- | --- | --- |
| Public site | GitHub Pages | 1 GB site, 100 GB bandwidth per month | $0 |
| Build and checks | GitHub Actions | 2,000 minutes per month on free plans, unlimited for public repos | $0 |
| Admin API | Cloudflare Workers | 100,000 requests per day | $0 |
| Job queue | Cloudflare D1 | 5 GB storage | $0 |
| Converted text for jobs | Cloudflare R2 | 10 GB storage | $0 |
| AI runs | Claude subscription via the home runner | Included in the owner's existing plan | $0 extra |
| Sign-in | Google Identity Services | Free | $0 |
| Custom domain (optional) | Any registrar | n/a | About $10 per year |

**When to move off Pages.** Only if monthly bandwidth approaches 100 GB, if the site passes
1 GB, or if visitor-facing features need a server. None of the phases above need that.

## Tracking

Each phase is a GitHub issue in rafsunsheikh/The-Chronicle-of-Light, linked from one roadmap
issue. Pull requests reference their issue. The existing labels `enhancement`, `frontend`,
`history` and `data quality` are reused.

## References

1. Open-source launch plan, `thoughts/shared/plans/2026-05-15-open-source-launch-plan.md`.
   Establishes the "dataset is the asset" rule and the pull-request content workflow.
2. Prometheus architecture, `~/Projects/prometheus/docs/ARCHITECTURE.md`. The Worker, runner
   and map-reduce design reused in Phase 7.
3. Prometheus extraction code, `~/Projects/prometheus/apps/web/src/lib/extract.ts`. The
   PDF, EPUB and DOCX to Markdown logic ported in Phase 4.
4. Wikipedia importer, `scripts/wikipedia-import/README.md`. The draft, review and promote
   pattern reused for the library importer and the extraction agent.
5. Event schema, `src/data/event.schema.json`. Already defines `sources[]`, `confidence` and
   `media[]` fields that Phases 3 and 5 build on.

## Correction, 2026-10-16 (after seeing the current main)

This plan was first written against a checkout that was twelve commits
behind `main`. The current `main` already has pieces the plan assumed were
missing. The phases stand, but the following change how they are built:

- **Routing already exists.** `src/hooks/useHashRoute.ts` is a small hash
  router with tabs for timeline, map, connections, moments, leaderboard,
  dashboard and review. Phase 1 extends it instead of adding a routing
  library. No `react-router-dom`.
- **Sign-in and roles already exist.** Supabase Google sign-in with a
  `profiles` table (`contributor` or `maintainer`) and a maintainer-only
  review queue. Phase 7's admin gate should reuse the `maintainer` role,
  not add a second Google client. The job queue can be a Supabase table
  polled by the home runner, which removes the need for a separate
  Cloudflare Worker.
- **Book extraction has a precedent.** `books/the_history_of_al_tabari/`
  holds a Python pipeline (clean text, extract events, enrich, connect)
  that produced about 1,100 Tabari events under `src/data/events/tabari/`.
  Phases 4 and 5 should build on that pipeline rather than start fresh.
- **The corpus is large.** About 1,120 events, so pages that list "moments
  in a period" must sample or paginate.
- **Hosting is Vercel first**, with GitHub Pages as a mirror. Phase 8's
  cost table holds (Vercel's free tier covers a static site), but the
  "stay on GitHub Pages" wording should read "stay on free static hosting".
- **Events have a Supabase canonical copy** mirrored back into git by a
  scheduled workflow (currently disabled by GitHub for inactivity). Library
  resources stay git-only until there is a reason to move them.
