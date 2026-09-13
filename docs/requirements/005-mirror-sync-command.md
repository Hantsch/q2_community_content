---
id: 005
title: Sync command and lock file for the launcher mirror
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio's whole claim — "this is what it will look like, and this is what the launcher will do
with it" — only holds if the preview and the report come from the launcher's own code. So that code
is copied into this repository verbatim, not reimplemented.

This story creates the copy and, more importantly, the record of it: which files, from which
launcher commit, with which contents. Without that record a mirror is indistinguishable from a fork
that quietly drifted.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-5, section 6.

## Acceptance Criteria

- [ ] **AC1** — `npm run sync:launcher -- --launcher <path>` copies the declared file list from a
      `q2-launcher` checkout into `studio/src/launcher-core/`.
- [ ] **AC2** — Every copied file is byte-identical to its source; the command performs no edits,
      rewrites or import fixups on the content it copies.
- [ ] **AC3** — `studio/launcher-core.lock.json` records, per file, its path in both repositories
      and a SHA-256 of the copied bytes, plus the launcher commit the copy came from and the date
      of the sync.
- [ ] **AC4** — A launcher path that does not exist, is not a git repository, or is missing one of
      the declared source files fails with one sentence naming the path and the problem, and writes
      nothing at all.
- [ ] **AC5** — A launcher checkout with uncommitted changes to a mirrored file is reported, so the
      lock can never record a commit that does not contain what was copied.
- [ ] **AC6** — Running the command twice in a row against the same checkout leaves the working
      tree unchanged the second time.
- [ ] **AC7** — The command writes only inside `studio/`; it never touches the published surface or
      the launcher checkout.

## Open Questions

- Is the file list hard-coded in the sync script, or declared in a manifest the script reads? A
  manifest is easier to review in a diff when the mirrored set grows.
- What should happen when a mirrored file has been moved or renamed in the launcher — fail with the
  old path, or try to detect the move?
- Does the mirror need the launcher's tests for those files too? They would prove the mirrored code
  behaves as it does there, at the cost of roughly doubling the mirrored line count.

## Plan

<Filled by `/refine 005`.>

## Deliverables

<Filled by `/refine 005`.>

## Model Hints

<Filled by `/refine 005`.>

## Acceptance Tests

<Filled by `/refine 005`.>

## Done

<Filled by `/build 005`.>
