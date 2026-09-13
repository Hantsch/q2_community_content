---
id: 010
title: Reader for the content repository's working tree
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Everything the studio says about this repository starts with reading it. The launcher fetches the
same material over HTTP from one commit; the studio has to read it from a working tree that is
half-edited, contains drafts the index does not mention, and may contain a broken `index.json` that
the author is in the middle of fixing.

That difference is the whole story. The reader's job is to hand the pipeline exactly the material
the launcher would receive, plus the material the launcher would never see — and to never, under
any circumstance, write.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-10.

## Acceptance Criteria

- [ ] **AC1** — The reader returns the raw `news/index.json`, the text of every `.md` document the
      index names, and the text of every `.md` in `news/` the index does **not** name.
- [ ] **AC2** — It lists the files under `news/img/` with their names and sizes.
- [ ] **AC3** — An `index.json` that is missing or does not parse is returned as a finding with the
      parser's own message; the reader does not crash and still returns the `.md` files it found.
- [ ] **AC4** — A document named by the index but absent from disk is returned as a finding naming
      the missing file, not as an empty document.
- [ ] **AC5** — The reader never writes: after any read, `git status` reports the working tree
      exactly as it was before.
- [ ] **AC6** — A path that resolves outside the repository root is refused, including via `..`
      segments and absolute paths in `index.json`'s `file` field.
- [ ] **AC7** — Files under `news/_templates/` are readable on request but are never returned as
      entries or drafts.

## Open Questions

- Does the reader re-read from disk on every request, or cache with a file watcher? The watcher is
  needed eventually for the live preview; building it now may be premature.
- Should it read `engines/manifest.json` and `gamedata/manifest.json` already, so story 014 can list
  them with real data, even though v1 does not validate or edit them?
- What encoding guarantees does it make — is a `.md` file with a BOM or CRLF line endings normalised
  on read, and would that change what the mirrored frontmatter parser sees?

## Plan

<Filled by `/refine 010`.>

## Deliverables

<Filled by `/refine 010`.>

## Model Hints

<Filled by `/refine 010`.>

## Acceptance Tests

<Filled by `/refine 010`.>

## Done

<Filled by `/build 010`.>
