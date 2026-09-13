---
id: 024
title: Saving an entry writes the document and its index row
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the first story in which the studio writes to the repository, and the first in which it can
do damage. Two files are involved and they have very different risk profiles: an entry's own `.md`
file affects one slide, while `news/index.json` is the file the launcher reads first and the one
that decides whether the whole feed loads.

The requirement is therefore as much about restraint as about writing: touch what the save concerns
and nothing else, and leave a diff a human can actually review before committing.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-22, open point 2 and 3.

## Acceptance Criteria

- [ ] **AC1** — Saving writes the entry's `.md` file with its frontmatter and body.
- [ ] **AC2** — For a published entry, the matching row in `news/index.json` is updated to agree
      with the document.
- [ ] **AC3** — Every file the save does not concern is byte-identical afterwards, including the
      other rows in `index.json`.
- [ ] **AC4** — A round trip is lossless: saving an entry and reading it back yields the same entry,
      with no field silently dropped, reordered or reformatted.
- [ ] **AC5** — A save that would produce an entry the launcher drops is not written silently — the
      author is told what will happen and confirms it deliberately.
- [ ] **AC6** — A file that changed on disk since it was opened is not overwritten without the
      author being told.
- [ ] **AC7** — The save writes only inside the content type's declared directory, and the file
      bridge refuses anything else.
- [ ] **AC8** — No save ever performs a git operation or reaches the network.

## Open Questions

- What is the formatting policy for `index.json` — preserve the existing file byte-for-byte apart
  from the row being changed, or reformat the whole file to a canonical shape? Reformatting is far
  simpler and produces a diff nobody can read. This is open point 3 in the concept and it has to be
  decided before this story is refined.
- Does the frontmatter writer preserve field order and comments, or normalise them? The same
  trade-off, one level down.
- Should a save be a save, or should the studio hold changes until an explicit "write to disk"?

## Plan

<Filled by `/refine 024`.>

## Deliverables

<Filled by `/refine 024`.>

## Model Hints

<Filled by `/refine 024`.>

## Acceptance Tests

<Filled by `/refine 024`.>

## Done

<Filled by `/build 024`.>
