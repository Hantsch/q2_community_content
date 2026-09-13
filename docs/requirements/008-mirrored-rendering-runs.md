---
id: 008
title: The mirrored slide rendering runs unmodified in the studio
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The preview is the reason the studio exists, and a preview is only evidence if it is the launcher's
own rendering. This story brings the launcher's slide components, the hero stylesheet and the design
tokens that stylesheet reads into the studio, and proves they render here.

It stops short of the preview surface itself — no iframe, no width switching, no entry selection.
What it has to establish is narrower and more important: these components render, with their real
styles, without anything on this side adjusting them to fit.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-8, section 6.

## Acceptance Criteria

- [ ] **AC1** — Each of the four mirrored slide components renders in a component test from a slide
      object, with no edits to the component sources.
- [ ] **AC2** — The rendered DOM structure and class names match what the launcher produces for the
      same slide — asserted against the mirrored components' own markup, not against a hand-written
      expectation.
- [ ] **AC3** — `home-hero.css` is applied, and every custom property it reads resolves to a value
      rather than falling back to the browser default.
- [ ] **AC4** — The fonts the hero stylesheet names are available locally, so the rendering does not
      depend on a network request or on a font that happens to be installed.
- [ ] **AC5** — No studio stylesheet declares a rule that targets a mirrored class name, and a test
      asserts it.
- [ ] **AC6** — A slide with an image renders that image from the repository's `news/img/`.
- [ ] **AC7** — `npm run check:drift` still passes — no mirrored file was edited to make this work.

## Open Questions

- Which design tokens are mirrored and which belong to the studio's own chrome? The hero stylesheet
  reads a subset of the launcher's `:root`; mirroring the whole token file is simpler but pulls in
  values the studio has no business inheriting.
- Are the three Fontsource packages the launcher uses redistributable from this repository, and does
  bundling them need a licence note next to the existing third-party ones?
- The launcher renders slide body text from markdown. Is that renderer part of the mirrored set, or
  does the studio need it separately?

## Plan

<Filled by `/refine 008`.>

## Deliverables

<Filled by `/refine 008`.>

## Model Hints

<Filled by `/refine 008`.>

## Acceptance Tests

<Filled by `/refine 008`.>

## Done

<Filled by `/build 008`.>
