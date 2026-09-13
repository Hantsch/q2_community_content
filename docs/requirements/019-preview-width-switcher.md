---
id: 019
title: Preview width switcher
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A slide does not have one appearance. The launcher's window starts at a minimum width of 940 pixels,
defaults to 1280 and is routinely dragged out to 1920, and the templates behave differently across
that range — the `cover` template in particular anchors its image to the right edge and loses area
on the left as the hero narrows, which is exactly where the author put the text.

An author who only ever sees one width will publish an image whose subject is cropped out of
existence on somebody else's monitor.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-17.

## Acceptance Criteria

- [ ] **AC1** — The preview can be switched between 940, 1280 and 1920 pixels wide.
- [ ] **AC2** — Switching changes the preview's real viewport width: the content re-lays out, it is
      not a scaled-down picture of a wider rendering.
- [ ] **AC3** — The current width is labelled, including which one is the launcher's minimum and
      which its default.
- [ ] **AC4** — A `cover` entry visibly loses image area on its left between 1920 and 940, matching
      the launcher's own right-anchoring behaviour.
- [ ] **AC5** — A preview wider than the studio window remains fully inspectable rather than being
      clipped out of reach.
- [ ] **AC6** — The selected width persists while the author switches between entries.

## Open Questions

- Is a free-form width — a drag handle or a number field — worth having in addition to the three
  fixed steps? The fixed steps match what the launcher tests; a handle catches what lies between
  them.
- Does the preview height matter as well? The hero is a fixed height in the launcher, in which case
  only width carries meaning.
- Should the studio be able to show two widths side by side, which is how a cropping problem
  actually becomes obvious?

## Plan

<Filled by `/refine 019`.>

## Deliverables

<Filled by `/refine 019`.>

## Model Hints

<Filled by `/refine 019`.>

## Acceptance Tests

<Filled by `/refine 019`.>

## Done

<Filled by `/build 019`.>
