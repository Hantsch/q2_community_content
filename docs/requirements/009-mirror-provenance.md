---
id: 009
title: Mirror provenance is reported, not buried
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A preview rendered from a six-month-old mirror looks exactly like a preview rendered from a current
one. That is the whole problem: the staleness has no visible symptom until someone publishes a post
that looks different in the real launcher.

The lock file from story 005 already knows the answer. This story makes it something a person is
told rather than something they could look up — in the command line output and as data the studio's
surface can display once it exists.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-9, section 6.

## Acceptance Criteria

- [ ] **AC1** — A provenance module reports the launcher commit, the sync date, the number of
      mirrored files and the drift verdict, derived from the lock file and the files on disk.
- [ ] **AC2** — The command-line output of the drift check names the launcher commit the mirror came
      from.
- [ ] **AC3** — The provenance is available to the studio surface as structured data, not only as
      printed text.
- [ ] **AC4** — A mirror whose hashes no longer match is reported as out of sync, with the same
      wording in every place provenance is shown.
- [ ] **AC5** — Provenance survives a fresh clone: it is read from the committed lock file and needs
      no launcher checkout and no git history to produce.
- [ ] **AC6** — A missing or unparseable lock file is reported as "provenance unknown" rather than
      crashing or silently reporting a clean mirror.

## Open Questions

- Should the studio refuse to preview when the mirror is out of sync, or show the preview with a
  persistent warning? Refusing is safer; warning keeps a contributor unblocked while someone else
  re-syncs.
- Is the launcher commit alone enough, or should the lock also record a human-readable launcher
  version or tag, which is easier to reason about than a hash?
- Does provenance need an age threshold ("synced 94 days ago") to be useful, and if so, what counts
  as old?

## Plan

<Filled by `/refine 009`.>

## Deliverables

<Filled by `/refine 009`.>

## Model Hints

<Filled by `/refine 009`.>

## Acceptance Tests

<Filled by `/refine 009`.>

## Done

<Filled by `/build 009`.>
