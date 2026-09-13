---
id: 028
title: Contributor quickstart for the studio
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio was built so that someone without a launcher checkout can write a news post. That promise
is only kept if they can find out how, from the repository, without asking anyone.

The existing documentation is good and aimed elsewhere: `README.md` is the contract the launcher
reads, and `news/_templates/README.md` is the map of the four templates. Neither tells a newcomer
what to install, what to run, or what the loop of writing a post actually looks like.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-26.

## Acceptance Criteria

- [ ] **AC1** — `studio/README.md` documents the path from a fresh clone to a previewed post:
      install, start, create, write, preview, validate, publish.
- [ ] **AC2** — It names the prerequisites — the Node version and nothing else — and states
      explicitly that no `q2-launcher` checkout is needed.
- [ ] **AC3** — It explains what the studio will and will not do: it writes files in the working
      tree, and it never commits, pushes or publishes anything.
- [ ] **AC4** — The repository `README.md` and `news/_templates/README.md` link to it, so a
      contributor arriving at either finds it.
- [ ] **AC5** — It states where the preview's fidelity comes from and what a stale mirror warning
      means, in one short paragraph.
- [ ] **AC6** — A test proves the documented commands exist as named, so the quickstart cannot drift
      out of date silently.

## Open Questions

- Does `news/_templates/README.md` stay the entry point for "which template do I want", with the
  quickstart linking to it, or does the studio's template picker make that page redundant?
- Should the quickstart be written for someone who has never used git, or may it assume a clone
  already exists?
- Is a short screen recording or a screenshot sequence worth having, and where would it live given
  the repository is otherwise content for the launcher?

## Plan

<Filled by `/refine 028`.>

## Deliverables

<Filled by `/refine 028`.>

## Model Hints

<Filled by `/refine 028`.>

## Acceptance Tests

<Filled by `/refine 028`.>

## Done

<Filled by `/build 028`.>
