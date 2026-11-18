# Product

<!-- impeccable:product-schema 1 -->

<!-- Drafted on 2026-11-17 from PROGRESS.md, the roadmap plan and the code, at the owner's request, instead of an interview. Facts marked (inferred) are the session's reading; correct any that are wrong. -->

## Platform

web

## Users

- **Readers** (inferred): people curious about Islamic history who explore a timeline, a map and a graph of about 1,150 events, open the Islamic Renaissance section, and read hosted public domain books. They arrive on desktop and on phones.
- **Contributors**: signed-in people with the `contributor` role who propose events and corrections through a review queue.
- **Maintainers**: the owner and anyone with the `maintainer` role, who review contributions, run the AI tools from the admin page, and decide what reaches the timeline. The owner also runs the home runner and the local model on a Mac.

## Product Purpose

An open, reviewed dataset of datable, locatable events in Islamic history, presented as an interactive timeline, map and graph, with a library of open books, articles and videos and a pipeline that turns source books into draft events for a person to review. Success is a timeline that grows from primary sources with every event carrying a citation, at close to zero running cost.

## Positioning

Every event on the timeline cites the page of the source it came from, and nothing machine-made reaches the public site without a person promoting it. The site stays static and free to host; the AI work runs on the owner's own machine and subscription.

## Operating Context

- Source books are converted to Markdown with pdfdown, chunked, read by a model (Claude or the local Devstral through Sultana), merged, drafted, enriched from Wikipedia and Wikidata, then reviewed, promoted and seeded to the Supabase database. The owner starts these runs; today from the command line, and from the admin page once the pipeline panel exists.
- Al-Tabari's 40 volumes and The Muslim Conquest of Persia are the current corpus, in copyright, kept outside git.
- Hosting: Vercel with a GitHub Pages mirror; Supabase for sign-in, roles, contributions and the job queue; GitHub pull requests for AI results.
- The owner's Mac runs llama-server (Devstral Small 2 24B) on port 8080, one request at a time.

## Capabilities and Constraints

- Events follow `src/data/event.schema.json`: id, title, description, dates, location, category, connections, sources, confidence.
- Confidence values: established, contested, legendary, auto-imported. Machine drafts are always auto-imported until a person promotes them.
- The site holds no secrets; the anon key and row-level security are the only backend surface in the browser.
- Local model throughput is about three minutes per 12,000-character chunk; a book is 60 to 120 chunks; the corpus is about 2,200 chunks.
- Undecided: whether extraction across the whole corpus uses Devstral alone or Claude for hard chunks.

## Brand Commitments

- Name: The Chronicle of Light.
- The timeline look was modelled on the National Museum of Australia's Defining Moments timeline (research in `thoughts/shared/research/`), with its teal accent, navy and the stage colours; keep that visual family (inferred as binding from the code).

## Evidence on Hand

- 1,152 reviewed events with sources under `src/data/events/`; 145 machine drafts for al-Tabari volume 35 under `src/data/events/imported/tabari-volume-35/`.
- 53 library resources and 6 hosted public domain books.
- Pilot measurements of the local model (precision and recall) in `PROGRESS.md`, stage 10.
- No testimonials, press or usage statistics exist; none are to be invented.

## Product Principles

1. Every fact on the timeline is traceable to a page in a source.
2. Machines draft; people decide. No automatic publication.
3. Zero running cost: static hosting, free tiers, the owner's own compute.
4. Plain language for readers and for maintainers; the interface explains what it does and what it costs.
5. Reviewers see the evidence beside the claim.

## Accessibility & Inclusion

No product-specific standard has been set; the house rule is WCAG AA contrast, visible keyboard focus and 44 px touch targets on phones.
