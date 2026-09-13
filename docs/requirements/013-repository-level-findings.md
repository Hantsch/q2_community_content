---
id: 013
title: Repository-level findings across the news directory
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Some mistakes are not visible in any single entry. Two entries can each be perfectly valid and still
share an `id`, in which case the launcher keeps one and silently discards the other. An image can
sit in `news/img/` for months because the entry that referenced it was renamed. A `.md` file can be
finished and simply never added to `index.json`.

None of these are contract violations the launcher would complain about — they are the kind of thing
only something that looks at the whole directory at once can notice.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-13, section 7.

## Acceptance Criteria

- [ ] **AC1** — Two index rows sharing an `id` are reported, naming which one the launcher keeps and
      which it discards.
- [ ] **AC2** — A `.md` file in `news/` with no row in `index.json` is reported as a draft — a
      state, explicitly not an error.
- [ ] **AC3** — An image under `news/img/` that no entry references is reported, with the note that
      the launcher never fetches it.
- [ ] **AC4** — A file name that the launcher's safe-name rule would refuse is reported together
      with the rule it breaks.
- [ ] **AC5** — Two entries sharing an `order` value are reported with the order they will end up
      in.
- [ ] **AC6** — An index row whose `file` names a document that does not exist is reported, and so
      is a document whose frontmatter `order` disagrees with its index row's `order`.
- [ ] **AC7** — Files under `news/_templates/` — including its example images — are never reported
      as orphans or drafts.

## Open Questions

- Is a mismatch between a document's frontmatter `order` and its `index.json` `order` an error or a
  note? The contract says the index decides the feed, so it is not fatal, but the two disagreeing is
  almost always an accident.
- Should an unreferenced image be reported once, or grouped when there are many (for example after a
  campaign of entries expired)?
- Does the check know about `visibleUntil` dates far in the past — is an entry that expired two
  years ago worth surfacing as clutter?

## Plan

<Filled by `/refine 013`.>

## Deliverables

<Filled by `/refine 013`.>

## Model Hints

<Filled by `/refine 013`.>

## Acceptance Tests

<Filled by `/refine 013`.>

## Done

<Filled by `/build 013`.>
