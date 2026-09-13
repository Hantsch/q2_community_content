---
id: 021
title: Preview an entry outside its visibility window
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A post written today for a release next month has `visibleFrom` set to next month. Every honest
preview of it therefore shows nothing at all, which is correct and completely useless to the person
writing it.

The same is true in the other direction: an expired entry is often exactly the one you want to look
at, because you are reusing it or working out why it stopped appearing.

The studio needs to be able to say "show me this as if it were visible" without lying about the
entry's real state.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-19.

## Acceptance Criteria

- [ ] **AC1** — An entry with a `visibleFrom` in the future can be previewed as if it were visible.
- [ ] **AC2** — An entry with a `visibleUntil` in the past can be previewed the same way.
- [ ] **AC3** — While the override is active it is visibly an override, on the preview itself — it
      can never be mistaken for the entry's real state.
- [ ] **AC4** — The override changes nothing in the repository.
- [ ] **AC5** — The validation report keeps stating the entry's real visibility regardless of the
      override; the report and the preview never disagree about the facts.
- [ ] **AC6** — With the override off, a scheduled or expired entry previews as what the launcher
      would show, which is nothing, with the reason stated.

## Open Questions

- Is a simple on/off override enough, or should the studio offer a "preview as of &lt;date&gt;"
  clock? The clock is more work, but it answers a question the toggle cannot: what will the whole
  feed look like on release day, with entries ageing in and out around each other.
- Does the override belong to the preview, or to the library — that is, should the library also be
  able to show the feed as of a chosen date?
- Should the studio warn about an entry whose `visibleFrom` is *so* far in the future that it looks
  like a typo (a year out, for example)?

## Plan

<Filled by `/refine 021`.>

## Deliverables

<Filled by `/refine 021`.>

## Model Hints

<Filled by `/refine 021`.>

## Acceptance Tests

<Filled by `/refine 021`.>

## Done

<Filled by `/build 021`.>
