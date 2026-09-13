---
id: 030
title: v1 acceptance — the full authoring flow
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Every story before this one proves its own piece. None of them proves the thing the project was
actually for: that a person can sit down, write a news post, see it, check it and publish it,
without leaving the studio and without knowing the contract by heart.

This is the story that says v1 is done. It walks the whole path through the real surface, in one
run, and it is deliberately the same path the quickstart documents — so the documentation and the
acceptance test cannot describe two different products.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-28.

## Acceptance Criteria

- [ ] **AC1** — An end-to-end run walks the full flow through the studio's real surface: create from
      a template, write the body, fill the frontmatter, add an image, preview it, validate it,
      publish it.
- [ ] **AC2** — The run exercises the failure the project exists to prevent: an entry that would
      silently fall back is caught and reported before publishing, and the run shows it being fixed.
- [ ] **AC3** — The flow writes only inside a fixture content tree; the repository's own `news/` is
      byte-identical before and after the run.
- [ ] **AC4** — After the flow, the `validate` command reports the new entry as delivered exactly as
      declared.
- [ ] **AC5** — The preview shown during the run is the mirrored rendering, and the run fails if the
      mirror is out of sync.
- [ ] **AC6** — The documented quickstart and this flow describe the same sequence of steps, checked
      rather than assumed.
- [ ] **AC7** — The run performs no git operation and reaches nothing beyond localhost.

## Open Questions

- Where does the fixture content tree come from — a copy of the repository's own `news/`, or a
  purpose-built minimal one? A copy is more realistic and breaks whenever real content changes.
- Should this flow also be the thing that produces reference screenshots of the four templates, so a
  rendering regression after a re-sync is visible?
- Does v1 need a second flow for the reverse path — opening an existing entry, changing it and
  saving — or is that sufficiently covered by the individual stories?

## Plan

<Filled by `/refine 030`.>

## Deliverables

<Filled by `/refine 030`.>

## Model Hints

<Filled by `/refine 030`.>

## Acceptance Tests

<Filled by `/refine 030`.>

## Done

<Filled by `/build 030`.>
