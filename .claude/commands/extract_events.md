---
description: Extract datable events from a converted book into draft event files for review (Phase 5 pipeline)
model: opus
---

# Extract events from a book

Turn a converted book (`content/<private|books>/<slug>/content.md`, produced by
`npm run convert`) into draft timeline events under
`src/data/events/imported/<slug>/`, with sources, gazetteer locations and
checked connections, ready for human review.

Arguments: the path to `content.md`, and optionally a chunk range such as
`--chunks 3-7` or `--chunks 12`. With no range, process every chunk.

## Steps

1. **Chunk.** Run `npm run extract:chunk -- <content.md>`. Note how many chunks
   it wrote. Read `<book>/extract/chunks.json` to get the list. If the user
   gave a range, keep only those indexes.
2. **Extract, in parallel.** For each chunk, spawn one `history-extractor`
   subagent. Give it, in the prompt: the chunk file path, the output path
   `<book>/extract/candidates/NNN.json` (same NNN as the chunk), and nothing
   else. Run up to 4 subagents at a time; wait for each batch to finish before
   starting the next. Do not read the chunks yourself.
3. **Draft.** Run `npm run extract:draft -- <content.md>`. It rewrites
   `src/data/events/imported/<slug>/` and writes `<book>/extract/report.md`.
4. **Validate.** Run `npm run validate:events`. The validator walks the
   imported folder too, so a bad draft fails here. Fix the draft or delete it,
   then re-run.
5. **Report.** Read `<book>/extract/report.md` and summarise for the user:
   how many drafts, how many located, how many unlocated and why, any skipped
   candidates, and the three or four most notable events. Point them at the
   report and remind them that drafts are gitignored until promoted.

## Promotion is a human decision

Do not promote drafts yourself. When the user has reviewed them, they run
`npm run extract:promote -- <slug> --all` (or a list of ids), optionally with
`--established`, and open a pull request with the promoted files.

## Notes

- A second run of the same chunk overwrites its candidates file; drafts are
  rebuilt from scratch on every `extract:draft`.
- The gazetteer lives at `books/the_history_of_al_tabari/gazetteer.json`.
  An unlocated draft usually means a place the gazetteer lacks; adding an
  entry there and re-running `extract:draft` fixes every draft at once.
