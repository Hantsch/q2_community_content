---
id: 003
title: Repository boundary between published surface and local tooling
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

`README.md` currently makes a repository-wide claim: this repository "is content only … and it
carries no CSS, HTML, colours or layout of its own". `studio/` contradicts that sentence the moment
it exists — it is a React application full of exactly those things.

The rule behind the sentence is still right and still worth protecting: nothing the **launcher
fetches** may carry presentation. What the sentence lacks is the distinction between the published
surface and local tooling that never leaves the contributor's machine. Without it, the next person
reading the README either deletes the studio or, worse, concludes that presentation in `news/` is
fine after all.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-3.

## Acceptance Criteria

- [x] **AC1** — `README.md` distinguishes the **published surface** (`news/`, `engines/`,
      `gamedata/`, `packs/`, `mods/`, `config_templates/`) from **local tooling**, and names
      `studio/` as tooling the launcher never fetches.
- [x] **AC2** — `README.md`'s top-level layout block lists `studio/` with a one-line description.
- [x] **AC3** — The "Content only" section states its rule as applying to the published surface,
      and no sentence remains claiming the repository as a whole carries no CSS, HTML, colours or
      layout.
- [x] **AC4** — The contributor-facing rule is unchanged in substance: a contributor supplies
      title, body, image, button labels and URLs, and the visibility/order fields — nothing under
      the published surface may carry presentation.
- [x] **AC5** — A test asserts the boundary statements are present in `README.md`, so a later edit
      cannot silently remove them.
- [x] **AC6** — No part of the news contract (schema, template fields, button rules, order,
      visibility, dropped-entry behaviour) is changed by this story.

## Decisions (Sprint)

- **(User)** `AGENTS.md` also carries the boundary statement, alongside `CLAUDE.md` and
  `README.md`, so agents reading only that file still see the rule.

Decisions taken during refine (not user-answered):

- **Launcher documentation finding (the deferred cross-repo question): yes, it is stale, and it is
  corrected there, not here.** `C:\development\Hantsch\q2-launcher` is present on this machine and
  was read. Three places make claims about this repository that `studio/` invalidates:
  `content/q2_community_content/README.md:5` (a hand-copied, already stale snapshot of this
  repository's README — no submodule, and it is missing `packs/`, `mods/` and `config_templates/`
  entirely), `docs/concepts/home-screen.md:104` plus its §6 layout block (lines 237-249), which
  enumerate this repository's top-level directories without `studio/`, and the done story
  `docs/requirements/done/085-the-content-repository-carries-the-news-contract.md` (AC5/D4), which
  is history and is left alone. Recorded here as a follow-up for the launcher's own backlog next to
  story 004; this story edits nothing in that repository.
- **The phrase "content only" stays literally in `README.md`.** The launcher's
  `scripts/check-content-repo.mjs:110` asserts `/content only/i` against this README, so AC3's
  rewrite keeps both the `### Content only` heading and the "a contributor supplies **content
  only**" sentence and only re-scopes the surrounding claim — otherwise this story would break the
  checker in a second way that story 004 is not scoped to fix.
- **`CLAUDE.md` needs no edit; it already carries the boundary** under `## Project rules` ("The
  published surface carries no presentation … `studio/` is the one exception … local tooling that
  the launcher never fetches"). The story's job for that file is to put it under test so it cannot
  be dropped later.
- **The boundary test is a repository-contract test at `studio/tests/boundary.test.ts`**, following
  story 001's convention that tests asserting about files rather than code live in `studio/tests/`
  (001 D6, `studio/tests/repo-contract.test.ts`). A separate file, not an extension of 001's, so
  the two stories do not collide in one file while building in the same sprint.
- **The test asserts short semantic anchors, not whole sentences** — e.g. that `README.md` contains
  "published surface", names `studio/` as never fetched, and that the old claim "carries no CSS,
  HTML, colours or layout of its own" is *absent* — because a test that pins full prose fails on
  every harmless copy-edit and gets deleted rather than maintained.
- **AC6 is proven structurally**, by asserting that the contract-bearing parts of `README.md` (the
  `index.json` field list, the four template names, the button rules, order/visibility and dropped
  entries) still carry their key terms, plus a `git diff` check that the published surface is
  untouched — rather than by reviewing the diff by eye.
- **`AGENTS.md` gets the boundary as a second top-level section**, keeping its existing
  `# Repository language` section untouched, because that file is pasted into every subagent prompt
  via the profile's `## Context to read before coding` and has to stay short.
- **This story depends on 001** for the existence of `studio/` and the `test` command; the sprint
  already sequences it after 001.

## Open Questions

- ~~Should `AGENTS.md` also carry the boundary, or is `CLAUDE.md` plus `README.md` enough?~~
  answered → Decisions (Sprint)
- ~~Does the launcher's own documentation state anything about this repository's layout that now
  needs the same correction?~~ answered → Decisions (Sprint): yes, three places, recorded as a
  follow-up for the launcher repository.

## Plan

A documentation story with one test behind it. Nothing under the published surface is touched.

1. **`README.md` — the intro paragraph.** Replace the repository-wide "content only … carries no
   CSS, HTML, colours or layout of its own" claim with the two-part statement: the **published
   surface** (`news/`, `engines/`, `gamedata/`, `packs/`, `mods/`, `config_templates/`) is what the
   launcher fetches and carries no presentation; `studio/` is **local tooling**, runs on the
   contributor's machine and is never fetched by the launcher. (AC1, AC3)
2. **`README.md` — the top-level layout block.** Add a `studio/` line with a one-line description
   ("local authoring and validation tool — never fetched by the launcher") and a sentence under the
   block separating the two groups. (AC2)
3. **`README.md` — the `### Content only` section.** Re-scope its rule from "nothing under `news/`"
   to the published surface, keep the heading and the "a contributor supplies **content only**"
   sentence verbatim (the launcher checker greps for that phrase), and leave the contributor-facing
   field list unchanged. (AC3, AC4)
4. **`AGENTS.md`.** Add a `# Repository boundary` section, three or four lines, same two-part
   statement. `CLAUDE.md` already states it and stays as is. (User decision)
5. **`studio/tests/boundary.test.ts`.** Assert the anchors in all three files, assert the removed
   claim is gone, and assert the news contract's key terms plus the published surface are untouched.
   (AC5, AC6)

Order: 1-3 in one pass over `README.md`, then 4, then 5 last so it sees the final text. Files
touched: `README.md`, `AGENTS.md`, `studio/tests/boundary.test.ts` — nothing else.

## Deliverables

- **D1 — `README.md` states the boundary (AC1, AC2, AC3, AC4, AC6).**
  Files: `README.md`.
  Intro paragraph rewritten to the published-surface / local-tooling split; `studio/` added to the
  top-level layout block with a one-line description; `### Content only` re-scoped to the published
  surface while keeping its heading and its "a contributor supplies **content only**" sentence.
  Acceptance: the README names both groups and `studio/` as never fetched; the sentence "carries no
  CSS, HTML, colours or layout of its own" no longer appears; the news contract sections
  (index.json fields, four templates, buttons, order/visibility, dropped entries) are unchanged
  apart from the `### Content only` re-scoping.

- **D2 — `AGENTS.md` carries the boundary, and a test holds all three files to it (AC5, AC6).**
  Files: `AGENTS.md`, `studio/tests/boundary.test.ts` (new).
  Mirror for the test's shape and helpers: `studio/tests/repo-contract.test.ts` from story 001.
  `AGENTS.md` gains a `# Repository boundary` section below the existing language section;
  `CLAUDE.md` is verified, not edited.
  Acceptance: `npm run test` passes; the new test fails if the boundary wording is removed from any
  of `README.md`, `AGENTS.md` or `CLAUDE.md`, and fails if the old repository-wide claim returns.

## Model Hints

- D1 → default
- D2 → default
- Review: → default — two documentation files plus one file-reading test, no runtime behaviour and
  no published-surface change; the test itself is the regression guard.

## Acceptance Tests

- AC1 → unit `studio/tests/boundary.test.ts` › "the README distinguishes the published surface from
  local tooling and names studio/ as never fetched" (D2, proving D1).
- AC2 → unit `studio/tests/boundary.test.ts` › "the top-level layout block lists studio/ with a
  description" (D2, proving D1).
- AC3 → unit `studio/tests/boundary.test.ts` › "no repository-wide content-only claim remains in
  the README" — asserts the absence of "carries no CSS, HTML, colours or layout of its own" and
  that the Content only section scopes its rule to the published surface (D2, proving D1).
- AC4 → unit `studio/tests/boundary.test.ts` › "the contributor-facing rule still lists title, body,
  image, button labels and URLs and the visibility/order fields" (D2, proving D1).
- AC5 → unit `studio/tests/boundary.test.ts` › "the boundary statement is present in README.md,
  AGENTS.md and CLAUDE.md" — this criterion *is* the test's existence; it runs under `npm run test`,
  the `test` gate `/build` executes before the story may be called done (D2).
- AC6 → unit `studio/tests/boundary.test.ts` › "the news contract is unchanged" — asserts the README
  still carries schemaVersion/entries/id/file/order/visibleFrom/visibleUntil, the four template
  names, the max-3 and github.com / raw.githubusercontent.com button rules, the ascending order rule
  and the dropped-entry rule, and that `git diff --name-only` against the branch base touches
  nothing under `news/`, `engines/`, `gamedata/`, `packs/`, `mods/`, `config_templates/` (D2).

Coverage: AC1→D1, AC2→D1, AC3→D1, AC4→D1, AC5→D2, AC6→D1+D2 — every criterion has a deliverable and
a named automated check, all in the test file D2 delivers. No manual residue.

Dependency: this story's test needs story 001's `studio/` workspace and `npm run test`; the sprint
already builds 001 first.

## Done

**Summary:** `README.md`'s intro, top-level layout block and `### Content only` section now
distinguish the published surface (`news/`, `engines/`, `gamedata/`, `packs/`, `mods/`,
`config_templates/`) from `studio/` as local tooling the launcher never fetches; the old
repository-wide "carries no CSS, HTML, colours or layout of its own" claim is gone, and the
launcher-checker phrase "content only" is kept verbatim. `AGENTS.md` gained a `# Repository
boundary` section carrying the same two-part statement; `CLAUDE.md` was verified (already states
it) and left unedited. `studio/tests/boundary.test.ts` (new, 6 tests) holds all three files and the
news contract to this boundary going forward.

**Commit message:** `003: distinguish published surface from studio/ tooling in README/AGENTS`

**Verification:**
- `npm run build` — pass.
- `npm run test` — 4 test files, 14 tests, all pass (includes new `boundary.test.ts`, 6 tests).
- `npm run lint` — pass (two `@typescript-eslint/no-unnecessary-type-assertion` findings and one
  Prettier formatting warning in the new test file were fixed during verification).
- `npm run typecheck` — pass.
- `npm run e2e` — not run; this story has no user-facing/UI acceptance criterion (documentation
  only), so nothing maps to the e2e gate per the profile's `ui-acceptance-required` rule.
- Code review (clean agent, default tier): **PASS**. All six ACs individually verified PASS with
  file:line evidence; all six named tests judged to genuinely fail on a broken implementation; no
  weakened/disabled checks; no scope creep (only `README.md`, `AGENTS.md`,
  `studio/tests/boundary.test.ts` touched; `CLAUDE.md` and the published surface confirmed
  untouched); no CLAUDE.md guardrail violations.

**AC → test mapping (verified):**
- AC1 → `boundary.test.ts` › "the README distinguishes the published surface from local tooling
  and names studio/ as never fetched" — passed.
- AC2 → `boundary.test.ts` › "the top-level layout block lists studio/ with a description" —
  passed.
- AC3 → `boundary.test.ts` › "no repository-wide content-only claim remains in the README" —
  passed.
- AC4 → `boundary.test.ts` › "the contributor-facing rule still lists title, body, image, button
  labels and URLs and the visibility/order fields" — passed.
- AC5 → `boundary.test.ts` › "the boundary statement is present in README.md, AGENTS.md and
  CLAUDE.md" — passed.
- AC6 → `boundary.test.ts` › "the news contract is unchanged" — passed.

No manual residue. No open blockers.

**Decisions (build-time, undocumented until now):**
- Fixed two ESLint `no-unnecessary-type-assertion` errors and one Prettier formatting issue in
  `studio/tests/boundary.test.ts` post-delegation (removed two unneeded `!` non-null assertions;
  ran `prettier --write`) — mechanical lint/format fixes, no behaviour change, not worth a review
  cycle.
- `e2e` intentionally skipped: the profile's `ui-acceptance-required` gate only applies to criteria
  describing something a user does through the app surface; all six ACs here are about repository
  documentation and a Node-side test, so nothing in this story maps to the Playwright harness.
