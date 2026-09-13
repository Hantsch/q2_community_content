---
id: 026
title: Adding an image to an entry
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Three of the four templates are built around an image, and two of them — `split` and `cover` —
silently become a plain `text` slide without one. The image is also the part of a post with real
requirements: a path relative to the document, a name the launcher's safe-name rule accepts, an
extension it will serve, and per-template expectations about dimensions and where the subject can
sit before the text covers it.

Today all of that lives in the kit READMEs and is applied by hand. Getting any of it slightly wrong
produces a post that looks finished and renders as something else.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-24.

## Acceptance Criteria

- [ ] **AC1** — An image can be added to `news/img/` from the studio, by picking a file or dropping
      one onto the entry.
- [ ] **AC2** — A file name or extension the launcher would reject is refused before anything is
      written, naming the rule it breaks.
- [ ] **AC3** — The entry's `image` field is set to the correct path relative to the document.
- [ ] **AC4** — The template's own image guidance, taken from `news/_templates/<template>/README.md`,
      is shown while choosing.
- [ ] **AC5** — An image whose dimensions do not match the template's expectation is warned about,
      with the expected and actual values, and is not silently accepted.
- [ ] **AC6** — For `cover`, the preview makes the text safe zone visible, so an author can see
      whether the subject of the image is about to sit under the scrim.
- [ ] **AC7** — Adding an image writes only into `news/img/` and the entry being edited.
- [ ] **AC8** — Replacing an entry's image does not delete the previous file; an image that becomes
      unreferenced is reported by story 013 rather than removed automatically.

## Open Questions

- Does the studio ever modify an image — resize, re-encode, strip metadata — or only ever warn? Not
  touching it is the safer rule and leaves the author with a manual step when the size is wrong.
- What are the real per-template dimension expectations? They need to come from the kit READMEs and
  the launcher's rendering, not from a guess.
- Should the studio be able to delete an unreferenced image, or does everything that removes a file
  stay a deliberate manual act?

## Plan

<Filled by `/refine 026`.>

## Deliverables

<Filled by `/refine 026`.>

## Model Hints

<Filled by `/refine 026`.>

## Acceptance Tests

<Filled by `/refine 026`.>

## Done

<Filled by `/build 026`.>
