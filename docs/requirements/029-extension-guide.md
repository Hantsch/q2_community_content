---
id: 029
title: Guide for adding a content type
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The registry from story 014 is the reason this is a content studio and not a news studio. A registry
nobody knows how to extend is just an indirection: when `packs/` finally gets a contract, whoever
implements it will read the news code and copy whatever they find, including the parts that were
specific to news.

This story writes down what a content type actually consists of, using `news` as the worked example,
so the second type costs a fraction of the first.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-27, section 8.

## Acceptance Criteria

- [ ] **AC1** — A guide explains how to add a content type as a descriptor: every field it declares
      and what each one is for.
- [ ] **AC2** — It names every place a new type touches, so nothing is discovered halfway through.
- [ ] **AC3** — It uses the `news` descriptor as the worked example, pointing at the real files
      rather than restating them.
- [ ] **AC4** — It states what a content type must not do: no presentation in the published surface,
      no writing outside its declared directory, no second implementation of a contract rule.
- [ ] **AC5** — It explains how a type moves from "reserved" to implemented, and what has to exist
      before that is possible — starting with a contract the launcher agrees to.
- [ ] **AC6** — The guide's claims about the descriptor shape are checked by a test, so it cannot
      quietly describe an older interface.

## Open Questions

- Does the guide live in `docs/` (where concepts and systems live) or in `studio/` (next to the code
  it describes)? The repository's own convention says `docs/`; the code convention says next to it.
- Should the guide cover the launcher side as well — what has to be true in `q2-launcher` before a
  new content type can exist at all?
- Is a scaffolding command worth having instead of a guide, and does that reduce the odds of the
  second type being a copy-paste of the first?

## Plan

<Filled by `/refine 029`.>

## Deliverables

<Filled by `/refine 029`.>

## Model Hints

<Filled by `/refine 029`.>

## Acceptance Tests

<Filled by `/refine 029`.>

## Done

<Filled by `/build 029`.>
