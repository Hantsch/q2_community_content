---
id: 002
title: End-to-end harness for the studio surface
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Most of what this project builds is something a person does: open the studio, pick an entry, see
it, fix it, save it. Those criteria are only honestly proven through the real surface — a test
that calls an internal module and a test that drives the actual page are not the same claim.

`.claude/ai-scrum.md` currently records `e2e: none` and `ui-acceptance-required: false`, both of
which were correct while this repository had no surface at all. Story 001 gives it one. This story
gives the project the harness that proves it, and flips the profile so every later story is held
to it.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-4.

## Acceptance Criteria

- [ ] **AC1** — `npm run e2e` starts the studio, drives it with Playwright and exits 0 on a clean
      tree.
- [ ] **AC2** — At least one e2e test opens the studio in a real browser and asserts on a visible
      element of the shell, not on the served HTML string.
- [ ] **AC3** — The e2e run reaches nothing beyond localhost — no network access is required to
      run it.
- [ ] **AC4** — A broken studio (the dev server fails to start, or the asserted element is absent)
      makes `npm run e2e` exit non-zero with a message naming what was expected.
- [ ] **AC5** — `.claude/ai-scrum.md` records the e2e command under `## Verify` and sets
      `ui-acceptance-required: true`, with the stale "no user-facing surface" note removed.
- [ ] **AC6** — Getting from a fresh clone to a passing e2e run is documented in one place,
      including the browser-install step.

## Open Questions

- Which browsers does the harness install and run — Chromium only (fast, enough for a local
  authoring tool) or all three?
- Does the harness start the dev server itself, or expect one to be running? Starting it is more
  robust for a fresh contributor; expecting one is faster in a tight edit loop.
- Where do e2e artefacts (traces, screenshots on failure) go, and are they git-ignored?

## Plan

<Filled by `/refine 002`.>

## Deliverables

<Filled by `/refine 002`.>

## Model Hints

<Filled by `/refine 002`.>

## Acceptance Tests

<Filled by `/refine 002`.>

## Done

<Filled by `/build 002`.>
