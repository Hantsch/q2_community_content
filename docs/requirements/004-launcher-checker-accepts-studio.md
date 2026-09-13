---
id: 004
title: The launcher's content-repo checker accepts studio/
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The `q2-launcher` repository verifies this one. `scripts/check-content-repo.mjs` checks this
checkout's top-level layout, the byte-identity of `news/` against the launcher's own fixture copy,
a pinned `HEAD` commit and a clean git state. It is a real signal today.

The moment `studio/` lands, that signal turns red and stays red — not because anything is wrong,
but because the checker does not know the directory exists. A check that is permanently red is a
check nobody reads, and the byte-identity guarantee for `news/` is worth keeping.

**This story changes a file in another repository** (`C:\development\Hantsch\q2-launcher`). It is
listed here because the need comes from this project's work and would otherwise be forgotten; where
it is actually implemented is an open question below.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — section 9.

## Acceptance Criteria

- [ ] **AC1** — With `studio/` present in this repository, `node scripts/check-content-repo.mjs` in
      the launcher checkout passes.
- [ ] **AC2** — The checker treats `studio/` as an expected top-level entry with a stated reason,
      not as an unexplained exception.
- [ ] **AC3** — An unexpected new top-level directory still fails the check — the layout assertion
      is loosened for `studio/` only, not removed.
- [ ] **AC4** — The existing guarantees are unchanged: `news/` byte-identity against the launcher
      fixture, the reserved-directory READMEs, and the root README's required sections.
- [ ] **AC5** — The script still prints one skip line and exits 0 when this checkout does not exist
      on the machine.
- [ ] **AC6** — The script remains read-only: it writes nothing in either repository.

## Open Questions

- Does this land as a story implemented from here, or as an item in the launcher's own backlog?
  Editing another repository from this sprint is possible but crosses a boundary worth deciding
  deliberately.
- Should `EXPECTED_HEAD` remain a pinned commit at all? It goes stale on every content commit, which
  makes the check noisy for a reason unrelated to what it is guarding.
- Should the checker gain the reverse drift check — asserting that
  `studio/src/launcher-core/` still matches the launcher's sources — so drift is caught from the
  launcher side too? That would make story 006 stronger but couples the two repositories more
  tightly.

## Plan

<Filled by `/refine 004`.>

## Deliverables

<Filled by `/refine 004`.>

## Model Hints

<Filled by `/refine 004`.>

## Acceptance Tests

<Filled by `/refine 004`.>

## Done

<Filled by `/build 004`.>
