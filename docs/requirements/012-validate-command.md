---
id: 012
title: Headless validate command
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Not every check needs a window. Before publishing, the useful question is a one-liner: is anything
in `news/` going to behave differently than I wrote it? A command answers that in a second, works
over SSH, and can be wired into a check later without anyone rebuilding it.

It is also the honest test of the report from story 011: if the verdicts only exist inside a React
component, they are a UI feature. If they come out of a command, they are a fact about the
repository.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-12.

## Acceptance Criteria

- [ ] **AC1** — `npm run validate` prints, for every entry, its declared and delivered form and
      every finding attached to it, in a layout readable in a terminal.
- [ ] **AC2** — `npm run validate -- --json` prints the same data as JSON, with no human-readable
      text mixed into the stream.
- [ ] **AC3** — The command exits non-zero when at least one entry would be dropped, and 0 when
      every entry is delivered.
- [ ] **AC4** — It runs without starting the studio, a dev server or a browser.
- [ ] **AC5** — It works in a clone with no `q2-launcher` checkout present.
- [ ] **AC6** — It reads the repository and writes nothing.
- [ ] **AC7** — The summary line states counts a person can act on: entries delivered as declared,
      entries falling back, entries dropped, repository findings.

## Open Questions

- Do fallbacks affect the exit code? A `cover` silently becoming `text` is usually a mistake, but
  failing on it would make the command unusable in a repository that has one deliberate case.
  A `--strict` flag is the obvious escape, if it is wanted.
- Should the command accept a path argument to validate a single entry, or is the whole feed always
  the unit?
- Should it report the mirror provenance from story 009 in its header, so a verdict from a stale
  mirror is visibly that?

## Plan

<Filled by `/refine 012`.>

## Deliverables

<Filled by `/refine 012`.>

## Model Hints

<Filled by `/refine 012`.>

## Acceptance Tests

<Filled by `/refine 012`.>

## Done

<Filled by `/build 012`.>
