---
id: 027
title: Reordering entries and publishing a draft
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Publishing is the moment a post becomes visible to everyone, and in this repository it is a row in
a JSON file. Ordering is the same act from the other side: `order` decides what a user sees first,
and the repository's convention of leaving gaps of ten exists precisely so that inserting a post
does not mean renumbering every other one.

Both operations are easy to do by hand and easy to do slightly wrong — and both edit the file the
launcher reads first.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-25.

## Acceptance Criteria

- [ ] **AC1** — Entries can be reordered, and the resulting `order` values are written to
      `index.json` and to each document's frontmatter so the two agree.
- [ ] **AC2** — Reordering keeps the repository's gap convention: an entry inserted between two
      others takes a value between them without renumbering entries that did not move.
- [ ] **AC3** — When no gap is available, the studio says so and renumbers deliberately, reporting
      which entries it changed.
- [ ] **AC4** — A draft can be published, which adds its row to `index.json` with an `id`, a `file`
      and an `order`.
- [ ] **AC5** — A published entry can be unpublished, which removes its row and keeps its `.md` file
      and image untouched.
- [ ] **AC6** — Publishing refuses an entry the launcher would drop, naming the reason, unless the
      author confirms it deliberately.
- [ ] **AC7** — After any of these operations, the delivered order the report predicts matches what
      the mirrored pipeline produces from the files on disk.
- [ ] **AC8** — None of these operations commits, pushes or reaches the network.

## Open Questions

- Drag and drop, or editing `order` values directly? Dragging is the better experience and hides the
  numbers the contract is actually built on, which an author eventually has to understand.
- What `order` does a newly published entry get — the next gap at the end, or a position the author
  picks during publishing?
- Should unpublishing warn that launchers which already cached the feed keep showing the entry until
  they next poll? That is true and is the kind of thing an author will otherwise discover in public.

## Plan

<Filled by `/refine 027`.>

## Deliverables

<Filled by `/refine 027`.>

## Model Hints

<Filled by `/refine 027`.>

## Acceptance Tests

<Filled by `/refine 027`.>

## Done

<Filled by `/build 027`.>
