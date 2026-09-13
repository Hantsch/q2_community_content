---
id: 015
title: Local file bridge between the browser and the working tree
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio runs in a browser, and a browser cannot read the repository. Something has to sit between
them. That something is the most security-relevant part of this project: it turns a page into a
process that can read — and later write — files on a contributor's machine.

So it gets a narrow definition on purpose. It serves the directories a content-type descriptor
declares, and nothing else; it refuses anything that resolves outside the repository root; and it
exists only while a developer is running the studio locally.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — section 4, "File access".

## Acceptance Criteria

- [ ] **AC1** — The studio reads `news/index.json`, the `.md` documents and the drafts through the
      bridge, from the browser, using the reader from story 010.
- [ ] **AC2** — A request whose resolved path lies outside the repository root is refused with an
      error, including `..` traversal, absolute paths and symlinks that point outside.
- [ ] **AC3** — Only directories declared by a registered content-type descriptor are reachable; a
      request for any other path in the repository is refused.
- [ ] **AC4** — Images under `news/img/` are served so the mirrored renderer can display them.
- [ ] **AC5** — The bridge exists only in the dev server; a production build of the studio contains
      no file-access code path.
- [ ] **AC6** — The bridge binds to localhost only.
- [ ] **AC7** — In this story the bridge is read-only: no route writes, creates or deletes anything.

## Open Questions

- How do tests that will later exercise writing (stories 024, 026, 027, 030) avoid dirtying the real
  working tree? The obvious answer is a fixture repository root the bridge can be pointed at in
  tests only — but that is exactly the override that must never be reachable in normal use, so it
  needs deciding here rather than improvised later.
- Does v1 need a production build of the studio at all, given it is a local tool? If not, AC5 gets
  simpler and the bundle never has to be built.
- Should the bridge surface file modification times, so the editor can later detect a file that
  changed on disk while it was open?

## Plan

<Filled by `/refine 015`.>

## Deliverables

<Filled by `/refine 015`.>

## Model Hints

<Filled by `/refine 015`.>

## Acceptance Tests

<Filled by `/refine 015`.>

## Done

<Filled by `/build 015`.>
