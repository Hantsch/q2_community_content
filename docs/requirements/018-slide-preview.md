---
id: 018
title: Slide preview of the selected entry
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the thing the author actually wanted: the post, on screen, as the launcher will show it,
while it is still being written.

Story 008 proved the mirrored components render. This story puts them in front of the author,
driven by the entry they selected in the library, inside a document of their own — because a
preview that inherits the studio's own styling is no longer evidence of anything.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-16, section 4.

## Acceptance Criteria

- [ ] **AC1** — The selected entry renders with the mirrored slide components inside an iframe.
- [ ] **AC2** — The preview renders the **delivered** form: an entry that falls back to `text`
      previews as `text`, not as the template that was declared.
- [ ] **AC3** — No studio chrome style affects the preview, and no mirrored hero style affects the
      studio chrome — proven by a test, not by looking at it.
- [ ] **AC4** — An entry's image is displayed, loaded from `news/img/` through the file bridge.
- [ ] **AC5** — An entry's buttons render, showing only the ones the launcher would keep.
- [ ] **AC6** — An entry the launcher would drop shows an explicit "nothing would be shown" state
      with the reason, rather than an empty frame.
- [ ] **AC7** — Changing the selected entry updates the preview without a page reload.

## Open Questions

- Does the preview show one slide, or the whole carousel with its rotation and dots? One slide is
  what an author is working on; the carousel is what a user will actually see, including how this
  post sits next to the others.
- The launcher renders body copy from markdown. Which markdown features does it actually support,
  and does the preview have to match that exactly to be honest?
- Should the preview have a background matching the launcher's home screen around the slide, so the
  slide is seen in the context it will live in?

## Plan

<Filled by `/refine 018`.>

## Deliverables

<Filled by `/refine 018`.>

## Model Hints

<Filled by `/refine 018`.>

## Acceptance Tests

<Filled by `/refine 018`.>

## Done

<Filled by `/build 018`.>
