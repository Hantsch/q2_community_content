---
id: 007
title: The mirrored news contract runs unmodified in the studio
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Copying the launcher's contract code into this repository is only half the job; it has to actually
run here. The launcher's sources use its own path aliases and are written for its build, so they
compile there by construction and not necessarily here.

The point of this story is a specific guarantee: when the studio later says "the launcher will drop
this entry", that sentence is produced by the launcher's own pipeline, not by studio code that
agrees with it today. Every rule that is re-implemented on this side is a rule that will disagree
eventually.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-7, section 6.

## Acceptance Criteria

- [ ] **AC1** — The mirrored contract modules (`home.ts`, `feed-pipeline.ts`, `frontmatter.ts`)
      compile under `npm run typecheck` with no edits to their contents.
- [ ] **AC2** — Running the mirrored pipeline over this repository's own `news/` yields exactly the
      four published entries, with the templates `split`, `banner`, `text`, `cover` and the orders
      10, 20, 30, 40.
- [ ] **AC3** — A fixture entry with no title is dropped, and a `cover` fixture with a missing image
      is delivered as `text` — both verdicts produced by the mirrored pipeline, not by studio code.
- [ ] **AC4** — No module outside `studio/src/launcher-core/` implements a contract rule: the button
      host allowlist, the three-button limit, the image-fallback rule and the drop rules exist in
      exactly one place, and a test asserts it.
- [ ] **AC5** — The mirrored code is reached only through a documented boundary module, so a later
      re-sync cannot break unrelated studio imports.
- [ ] **AC6** — `npm run check:drift` still passes afterwards — nothing in this story edits a
      mirrored file to make it fit.

## Open Questions

- How are the launcher's path aliases (`@shared/...`) resolved here — by mapping the alias in the
  studio's build, or by rewriting imports at sync time? Rewriting at sync time breaks the
  byte-identity guarantee from story 005, so mapping looks right, but it needs confirming.
- Does `zod` have to be pinned to the launcher's exact version, or is a compatible major enough? A
  schema behaviour difference between versions would be invisible until it produced a wrong verdict.
- Where do the contract fixtures for AC3 live so they are clearly test material and never mistaken
  for publishable content?

## Plan

<Filled by `/refine 007`.>

## Deliverables

<Filled by `/refine 007`.>

## Model Hints

<Filled by `/refine 007`.>

## Acceptance Tests

<Filled by `/refine 007`.>

## Done

<Filled by `/build 007`.>
