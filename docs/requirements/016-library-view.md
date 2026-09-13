---
id: 016
title: Library view of the news directory
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Before anyone edits anything, they need to see what is there. Today that means opening
`index.json`, cross-referencing four `.md` files by name, and holding the visibility dates in your
head to work out what a launcher would actually be showing right now.

The library is the studio's home screen: the feed as it stands, in the order it will appear, with
each entry's real state visible at a glance — published, scheduled, expired, draft, or dropped.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-15.

## Acceptance Criteria

- [ ] **AC1** — Every published entry is listed in the order the launcher will deliver it, showing
      its title, template, `order` value and status.
- [ ] **AC2** — Drafts are listed and marked as invisible to the launcher, separately from published
      entries.
- [ ] **AC3** — A scheduled entry shows the date it becomes visible; an expired one shows the date
      it stopped being visible.
- [ ] **AC4** — An entry that the launcher would drop is marked as dropped, with the reason readable
      without leaving the list.
- [ ] **AC5** — An entry whose delivered template differs from its declared one shows both.
- [ ] **AC6** — Selecting an entry marks it as the current entry, which later stories use as the
      preview and editor target.
- [ ] **AC7** — An empty or unreadable `news/` produces a clear explanation, not a blank screen.

## Open Questions

- What is the primary sort — delivered order, or most recently edited? Delivered order matches what
  the launcher does; recency matches what an author is usually looking for.
- Do drafts sit in the same list with a badge, or in their own section? A separate section is
  clearer; one list keeps the count of "things in this repository" honest.
- Should the library show a thumbnail of an entry's image, and if so, does that make the list slow
  enough to matter on a large feed?

## Plan

<Filled by `/refine 016`.>

## Deliverables

<Filled by `/refine 016`.>

## Model Hints

<Filled by `/refine 016`.>

## Acceptance Tests

<Filled by `/refine 016`.>

## Done

<Filled by `/build 016`.>
