---
id: 014
title: Content-type registry drives the studio
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The tool is called a content studio, not a news studio, and that name is a commitment. This
repository already carries six content areas: `news/`, `engines/`, `gamedata/` and the reserved
`packs/`, `mods/`, `config_templates/`. Three of them have no contract yet, two are read by the
launcher but are out of scope for v1 editing, and one is the reason the studio exists.

If `news` is wired into the shell directly, adding `packs` later means rebuilding the navigation,
the routing and the validation plumbing. A registry costs very little now and makes the later
content types a descriptor instead of a project.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-14, section 8.

## Acceptance Criteria

- [ ] **AC1** — The studio's navigation is built by iterating a registry; no content type is named
      in the shell's own code.
- [ ] **AC2** — `news` is registered with its directory, its index file, its reader and its
      validators, and is fully usable through the registry.
- [ ] **AC3** — `packs`, `mods` and `config_templates` appear with the state "reserved — the
      launcher does not read this yet".
- [ ] **AC4** — `engines` and `gamedata` appear with the state "read by the launcher, not editable
      here yet" — distinct from reserved, because they carry real content today.
- [ ] **AC5** — Selecting a type that is not implemented explains its state and what would have to
      exist first; it never shows an empty screen or a dead control.
- [ ] **AC6** — Adding a descriptor requires no change to the shell, and a test proves it by
      registering a throwaway type and finding it in the navigation.

## Open Questions

- What exactly does a descriptor declare? Directory, index file, schema, validators, editor fields
  and preview component are the obvious ones — is there anything a future type needs that news does
  not?
- Should the reserved types link to the place where their contract would be defined (a future
  concept), so someone clicking them has somewhere to go?
- Does the registry need to handle a content type with no index file at all, and does anything
  planned actually look like that?

## Plan

<Filled by `/refine 014`.>

## Deliverables

<Filled by `/refine 014`.>

## Model Hints

<Filled by `/refine 014`.>

## Acceptance Tests

<Filled by `/refine 014`.>

## Done

<Filled by `/build 014`.>
