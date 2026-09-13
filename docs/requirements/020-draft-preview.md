---
id: 020
title: Preview a draft without publishing it
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The natural way to write a post is to write it, look at it, fix it, and only then decide it is ready.
The contract has no concept of a draft: an entry is either in `index.json` — and therefore live the
next time a launcher polls — or invisible.

That forces an author to either publish something unfinished to see it, or add and remove index rows
by hand while working. Both are exactly the kind of fiddling this project exists to remove. A `.md`
file with no index row is a perfectly good draft; the studio just has to be willing to render one.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-18.

## Acceptance Criteria

- [ ] **AC1** — A `.md` file in `news/` with no row in `index.json` can be selected and previewed.
- [ ] **AC2** — Previewing a draft writes nothing: `index.json` and every other repository file are
      byte-identical before and after.
- [ ] **AC3** — The preview marks a draft as a draft, so it can never be mistaken for something the
      launcher is already showing.
- [ ] **AC4** — A draft receives the same verdict a published entry would: a draft `cover` with a
      missing image previews as `text` and says so.
- [ ] **AC5** — A draft with frontmatter that does not parse shows the same drop verdict the
      launcher would produce, not a studio-specific error.
- [ ] **AC6** — The draft's position among the published entries is shown as it would be if it were
      published.

## Open Questions

- Where does a draft's `order` come from for the purpose of AC6 — its own frontmatter, or the next
  free value the studio would assign on publishing? If the frontmatter has none, something has to be
  assumed, and the assumption should be visible.
- Should the studio offer to create a draft's index row from the preview ("publish this"), or does
  that belong entirely to story 027?
- Is there any value in a draft marker inside the file itself, or is "not in `index.json`" the
  definition and nothing more is needed?

## Plan

<Filled by `/refine 020`.>

## Deliverables

<Filled by `/refine 020`.>

## Model Hints

<Filled by `/refine 020`.>

## Acceptance Tests

<Filled by `/refine 020`.>

## Done

<Filled by `/build 020`.>
