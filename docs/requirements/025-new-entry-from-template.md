---
id: 025
title: New entry from the templates kit
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

`news/_templates/` already contains a copy-and-fill starter kit: one folder per template, each with
a `template.md` and a README covering its fields, image requirements and a worked example. It is a
good kit. It is also a kit you have to know exists, find, copy by hand, rename to the right date and
slug, and then remember to add to `index.json`.

Starting a post should be picking a template and typing a title. The kit stays the source of what a
new entry contains, so the studio and the documentation cannot drift apart.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-23.

## Acceptance Criteria

- [ ] **AC1** — A new entry is created by picking one of the four templates, with the same
      one-screen guidance the kit's README gives about which to choose.
- [ ] **AC2** — The new file's contents come from `news/_templates/<template>/template.md`; the
      studio holds no second copy of the starter content.
- [ ] **AC3** — The file name follows the repository's convention, `YYYY-MM-DD-slug.md`, with the
      slug derived from the title and editable before creation.
- [ ] **AC4** — The new entry starts as a draft — the file is written, `index.json` is untouched —
      until it is published by story 027.
- [ ] **AC5** — A file name that already exists is refused, with the existing entry named.
- [ ] **AC6** — A slug that collides with an existing entry's `id` is refused, since the launcher
      would keep only one of them.
- [ ] **AC7** — The created file opens in the editor with its template's required fields visible and
      empty rather than pre-filled with placeholder text that could be published by accident.

## Open Questions

- Is the date in the file name the creation date or the intended publication date? The existing
  entries do not settle it, and an entry written in September for an October release makes the two
  differ.
- Does creating an entry also create its `id`, and is the `id` always the slug? Every current entry
  follows that pattern, but nothing enforces it.
- Should the studio offer to start from an existing entry ("duplicate this one") as well as from a
  template?

## Plan

<Filled by `/refine 025`.>

## Deliverables

<Filled by `/refine 025`.>

## Model Hints

<Filled by `/refine 025`.>

## Acceptance Tests

<Filled by `/refine 025`.>

## Done

<Filled by `/build 025`.>
