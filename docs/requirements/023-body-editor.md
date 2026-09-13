---
id: 023
title: Body editor with live preview
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The body is the post. Everything else is metadata about where and when it appears.

It is also the field with the least feedback today: an empty body drops the entry entirely, a body
that is too long for the template overflows or gets cut, and how markdown is rendered is decided
somewhere in the launcher. Writing it with the slide updating next to you is the difference between
writing a news post and filling in a form.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-21.

## Acceptance Criteria

- [ ] **AC1** — The body is editable as markdown, as plain text the author controls.
- [ ] **AC2** — The preview updates as the body changes, without a save and without a reload.
- [ ] **AC3** — An empty body is flagged as the drop cause it is, in the editor, not only in the
      report.
- [ ] **AC4** — The editor never inserts HTML, styling or layout into the body.
- [ ] **AC5** — Markdown the launcher does not render is flagged, so an author does not write
      something that will appear as literal characters on the slide.
- [ ] **AC6** — A body long enough to overflow its template is visible as such in the preview, at
      every preview width.

## Open Questions

- Which markdown features does the launcher actually render? AC5 cannot be written honestly without
  that list, and it has to come from the launcher's renderer rather than from an assumption.
- Plain textarea, or an editor with a toolbar and shortcuts? The toolbar is friendlier for
  community contributors and is also the thing most likely to insert something the contract forbids.
- Is there a sensible length guideline per template, and if so is it a warning or just something the
  preview makes obvious?

## Plan

<Filled by `/refine 023`.>

## Deliverables

<Filled by `/refine 023`.>

## Model Hints

<Filled by `/refine 023`.>

## Acceptance Tests

<Filled by `/refine 023`.>

## Done

<Filled by `/build 023`.>
