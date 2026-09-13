---
description: Roadmap ritual — checks ROADMAP.md against the real repo state and keeps it one screen long (check) and/or cuts the next sprint out of the current milestone with the user (plan).
argument-hint: [check|plan]
model: sonnet
effort: medium
---

<!-- ai-scrum:managed 4.0.0 - plugin-owned, written by /ai-scrum:setup. Do not edit:
     setup diffs this file on update and asks before replacing it. Project facts go in .claude/ai-scrum.md. -->

Run the roadmap ritual: **$1** (no argument: run `check` first, then offer `plan`).

## Project profile

Read `.claude/ai-scrum.md` first — `roadmap-path`, `requirements-path`, `sprints-path`,
`concepts-path`, `systems-path`, id formats and `doc-language` come from there. If it is
missing, stop and say: run `/ai-scrum:setup` (ai-scrum plugin) first.

## Role

The roadmap is the entry point into the project: someone opening it after weeks away must see
within a minute where the project stands, what was done last and what to pick up next. It is a
**map, not a log**. Story truth stays in `requirements-path`, sprint detail in `review.md`,
design in the concepts — the roadmap links to those and never repeats them. This command keeps
it honest, keeps it short and turns it into the next sprint.

## The shape (and the budgets)

The roadmap has exactly these sections, in this order, as laid out in the template
`/sprint` and this command write into:

1. **Where we stand** — max. five lines, rewritten every time, never appended to: current
   phase/milestone and what is being built, what was finished last, the next concrete step,
   anything waiting on the user.
2. **Phase overview** — one table row per phase, with milestones done/total.
3. **Current phase** — one table row per milestone: number, name, status, sprint links, one
   note of at most one sentence. No paragraphs, no story lists, no decisions, no gaps text.
4. **Open / unprioritised** — one row per idea or concept that needs a decision before it
   becomes work. State: one sentence plus link. Next step: one command.
5. **Follow-ups worth doing** — one line per small item a sprint surfaced that needs no
   decision and no story yet, with its source (sprint review, story). Done items are
   **removed**, not struck through — git keeps the history.
6. **History** — completed phases, one row per milestone. Nothing else.

Everything that does not fit a budget belongs somewhere else and is linked from here:
findings, gaps, manual residue and criteria covered below the real surface → the sprint's
`review.md`; decisions → the story's `## Decisions (Sprint)` or `sprint.md`; scope and
rationale → the concept. A gap that matters becomes a follow-up line or a story, never a
paragraph in the roadmap.

## Mode `check` — sync, drift and compaction

1. Read the roadmap.
2. Establish the real state cheaply (Glob/Grep + targeted reads, do not read everything):
   - `<requirements>/*.md` — open stories and their status; the last entry in
     `<requirements>/done/INDEX.md`; stories that no milestone row or open/unprioritised
     row mentions.
   - `<sprints>/` — open sprints (`sprint.md` outside `done/`) and the most recent review
     under `done/`.
   - `<concepts>/` — concepts without a line in the roadmap; concepts whose stories are all
     done (→ they belong in `<systems>/`).
3. Correct every deviation directly in the roadmap:
   - A milestone whose stories are all `done` is **`done`** with the date of its last
     sprint — acceptance happened inside the sprint through the tests, there is no separate
     "accepted" state. What a later walk-through finds becomes a new story, never a reopened
     milestone.
   - A phase whose milestones are all done is `done` in the overview; its milestone rows
     move to **History** (one row each), and the next phase becomes the current one.
   - Stories with no home get a row under "Open / unprioritised" (grouped by theme, one row
     per theme, not one per story).
   - Move fully implemented concepts to `<systems>/` (`git mv`, update the status line).
4. Compact to the budgets: every cell or line that exceeds its budget is cut back to the one
   sentence that carries the status, and the detail is pointed at (linked), not kept. Remove
   follow-ups that are done or have become stories. Rewrite "Where we stand" from the real
   state and set "As of".
5. **A roadmap in an older shape** (milestone paragraphs, "Gaps/notes", struck-through items)
   is rebuilt into the six sections on the first `check`, after an explicit yes from the user
   via `AskUserQuestion`. Say plainly what will not be carried over: the paragraph detail,
   which lives in the sprint reviews and in git history. Follow-ups still worth doing are
   kept as one-liners; everything struck through is dropped.
6. Report compactly: drift corrected, what was compacted or dropped, state of the current
   phase, what is waiting unprioritised.

## Mode `plan` — cut the next sprint (together with the user)

1. Precondition: `check` has run in this session (otherwise run `check` first).
2. Propose what comes next — default: the next open milestone of the current phase; name
   alternatives from "Open / unprioritised" and "Follow-ups worth doing". Real direction
   decisions (which milestone, scope boundaries, deliberate omissions) via `AskUserQuestion`
   with a recommendation — no silent priority assumptions.
3. Cut the chosen milestone (or its first part) into stories:
   - Derive scope from the concept linked in the roadmap, the previous sprint's `review.md`
     (findings, gaps) and the follow-ups that fit.
   - Cut small: one sprint = one playable/verifiable increment, 3–6 stories as a guideline.
   - One file per story from `<requirements>/_TEMPLATE.md` (`status: draft`, next free id per
     the profile's `story-id-format`, determined from `done/INDEX.md` + the open stories):
     requirement + acceptance criteria from the user's perspective, **numbered `AC1`, `AC2`,
     … and each one observable** — refine has to map every single one to an automated test, so
     a criterion phrased as an intention ("the screen feels calm") cannot be accepted by
     anyone and is cut as a fact instead ("the screen shows exactly one accent colour").
     Deliberately open decisions as concrete questions in `## Open Questions` (resolved by
     `/sprint` in its clarification round). **No** plan/deliverables and **no** test mapping —
     that is refine's job.
   - Decisions taken at the cut go into `sprint.md` (goal, scope, deliberate omissions) and
     the story files — not into the roadmap.
4. Create `<sprints>/<next free sprint id>/sprint.md` from the template: goal, stories in
   build order, `status: planned`, `milestone:` line.
5. Update the roadmap: the milestone row gets the sprint link and status `planned`; a
   follow-up that became a story is removed; "Where we stand" names the sprint as the next
   step.
6. Show the user the cut (sprint goal + one sentence per story) for correction. Then the user
   starts `/sprint <id>` themselves.

## Rules

- Do not commit, do not push. No implementation, no refine — only the roadmap, story drafts
  and `sprint.md`.
- Milestone granularity, table rows, one sentence: never copy story status lists, findings or
  decisions into the roadmap. If you are about to write a second sentence into a cell, link
  instead.
- History is deleted here, not preserved: done follow-ups go, struck-through text goes, done
  phases collapse to one row per milestone. Git and the sprint reviews are the archive.
- Concepts stay timeless (what/why) — when/status lives only in the roadmap.
- Write generated artifacts in the profile's `doc-language`; keep the existing language of
  files you are only editing.
