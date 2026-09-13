---
id: 017
title: Validation panel in the studio
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The report exists as data after story 011 and as terminal output after story 012. Neither is where
an author is looking while they write. The verdict has to sit next to the entry it is about, in the
same window, updating as the entry changes.

This is also where the two halves of the report meet: what is wrong with *this* entry, and what is
wrong across the directory as a whole.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-11, CS-13.

## Acceptance Criteria

- [ ] **AC1** — The panel shows the selected entry's verdict: declared form, delivered form, and
      every finding attached to it.
- [ ] **AC2** — A fallback is shown with the rule that caused it and the field to fix — the missing
      image path, the rejected button URL.
- [ ] **AC3** — Repository-level findings from story 013 are shown in one place, separate from the
      selected entry's own findings.
- [ ] **AC4** — Every finding names the file it concerns.
- [ ] **AC5** — A repository with no findings shows an explicit all-clear state, not an empty area
      that could equally mean "not checked yet".
- [ ] **AC6** — The panel distinguishes severities visually, and the distinction survives being read
      without colour.
- [ ] **AC7** — The panel's verdicts and the `validate` command's verdicts agree for the same
      repository state, proven by a test rather than by inspection.

## Open Questions

- Should a finding be clickable, jumping to the entry and ideally the field it concerns? That is
  clearly better and clearly more work than displaying it.
- Does the panel need to distinguish "this entry is fine" from "this entry is fine *and* it is a
  draft nobody will see"?
- Where does the mirror provenance from story 009 appear — in this panel, or in the studio's
  chrome?

## Plan

<Filled by `/refine 017`.>

## Deliverables

<Filled by `/refine 017`.>

## Model Hints

<Filled by `/refine 017`.>

## Acceptance Tests

<Filled by `/refine 017`.>

## Done

<Filled by `/build 017`.>
