---
id: 006
title: Drift check for the launcher mirror
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A mirror that silently falls behind is worse than no mirror: the preview keeps looking
authoritative while showing a layout the launcher no longer has, and the validation report keeps
stating rules that have since changed. The failure is invisible precisely when it matters.

Two different people need two different answers from this check. Whoever has a launcher checkout
needs to know whether the mirror still matches it. A community contributor, who has no launcher
checkout at all, needs the check to not fail for a reason they cannot act on — but still to catch a
locally edited mirror file.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-6, section 6.

## Acceptance Criteria

- [ ] **AC1** — `npm run check:drift` recomputes every hash in `studio/launcher-core.lock.json`
      against the files on disk and fails when a mirrored file was edited locally, naming each file.
- [ ] **AC2** — With a launcher checkout available, the check additionally compares each mirrored
      file against the launcher's current source and fails on any difference, naming the file's path
      in both repositories.
- [ ] **AC3** — With no launcher checkout on the machine, the check prints one skip line explaining
      what was not compared, runs AC1 regardless, and exits 0.
- [ ] **AC4** — A mirrored file present on disk but absent from the lock — and the reverse — is
      reported; neither passes silently.
- [ ] **AC5** — The check is read-only in both repositories.
- [ ] **AC6** — The failure output says what to do about it (re-sync, or move the change into the
      launcher), not just that hashes differ.

## Open Questions

- Where does the launcher path come from: a `--launcher` argument, an environment variable, or a
  conventional sibling directory next to this repository? The sync command (005) needs the same
  answer.
- When the launcher is merely *ahead* of the mirror — the mirror is stale but nothing here was
  edited — is that a hard failure or a warning? A hard failure is honest; a warning keeps a
  contributor working while a launcher change is in flight.
- Should this check run as part of `npm run lint` or `npm run test`, or stay a command someone
  invokes deliberately?

## Plan

<Filled by `/refine 006`.>

## Deliverables

<Filled by `/refine 006`.>

## Model Hints

<Filled by `/refine 006`.>

## Acceptance Tests

<Filled by `/refine 006`.>

## Done

<Filled by `/build 006`.>
