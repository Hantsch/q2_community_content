---
id: 003
title: Repository boundary between published surface and local tooling
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

`README.md` currently makes a repository-wide claim: this repository "is content only … and it
carries no CSS, HTML, colours or layout of its own". `studio/` contradicts that sentence the moment
it exists — it is a React application full of exactly those things.

The rule behind the sentence is still right and still worth protecting: nothing the **launcher
fetches** may carry presentation. What the sentence lacks is the distinction between the published
surface and local tooling that never leaves the contributor's machine. Without it, the next person
reading the README either deletes the studio or, worse, concludes that presentation in `news/` is
fine after all.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-3.

## Acceptance Criteria

- [ ] **AC1** — `README.md` distinguishes the **published surface** (`news/`, `engines/`,
      `gamedata/`, `packs/`, `mods/`, `config_templates/`) from **local tooling**, and names
      `studio/` as tooling the launcher never fetches.
- [ ] **AC2** — `README.md`'s top-level layout block lists `studio/` with a one-line description.
- [ ] **AC3** — The "Content only" section states its rule as applying to the published surface,
      and no sentence remains claiming the repository as a whole carries no CSS, HTML, colours or
      layout.
- [ ] **AC4** — The contributor-facing rule is unchanged in substance: a contributor supplies
      title, body, image, button labels and URLs, and the visibility/order fields — nothing under
      the published surface may carry presentation.
- [ ] **AC5** — A test asserts the boundary statements are present in `README.md`, so a later edit
      cannot silently remove them.
- [ ] **AC6** — No part of the news contract (schema, template fields, button rules, order,
      visibility, dropped-entry behaviour) is changed by this story.

## Open Questions

- Should `AGENTS.md` also carry the boundary, or is `CLAUDE.md` plus `README.md` enough? `AGENTS.md`
  is currently the language rule only.
- Does the launcher's own documentation state anything about this repository's layout that now
  needs the same correction?

## Plan

<Filled by `/refine 003`.>

## Deliverables

<Filled by `/refine 003`.>

## Model Hints

<Filled by `/refine 003`.>

## Acceptance Tests

<Filled by `/refine 003`.>

## Done

<Filled by `/build 003`.>
