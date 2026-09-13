---
id: 001
title: Studio scaffold with typecheck, lint and unit tests
status: draft # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A contributor needs somewhere to write and check content locally. Today nothing runs in this
repository: there is no package manifest, no toolchain and no test command — `.claude/ai-scrum.md`
records `build`, `test`, `lint` and `typecheck` as `none`, which is why no story here can map an
acceptance criterion to a real test yet.

This story creates the studio application shell and the verification commands every later story
depends on. It delivers a page that opens, not a feature: the content work starts in Sprint 2.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-1, CS-2, CS-4.

## Acceptance Criteria

- [ ] **AC1** — After `npm install`, `npm run studio` starts a dev server and serves a page whose
      title names the Content Studio; the command prints the URL it is reachable at.
- [ ] **AC2** — `npm run typecheck` type-checks the studio sources and exits 0 on a clean tree.
- [ ] **AC3** — `npm run lint` checks the studio sources with ESLint and Prettier and exits 0 on a
      clean tree.
- [ ] **AC4** — `npm run test` runs Vitest and exits 0, with at least one test that asserts real
      behaviour rather than `expect(true)`.
- [ ] **AC5** — `.claude/ai-scrum.md` records the real commands under `## Verify` for `build`,
      `test`, `lint` and `typecheck`, replacing the `none` entries.
- [ ] **AC6** — `node_modules/` and build output are git-ignored; every studio source file is not.
- [ ] **AC7** — Nothing under the published surface (`news/`, `engines/`, `gamedata/`, `packs/`,
      `mods/`, `config_templates/`) is added, moved or modified by this story.

## Open Questions

- Does the package manifest live at the repository root, so the contributor command is
  `npm run studio` from the clone root, or inside `studio/`, keeping the repository root free of
  build files? The root variant is shorter for contributors; the nested variant keeps the
  published surface visually separate.
- React 19 + Vite is fixed by the concept. Is there a reason to pin the exact React and Vite
  versions to the launcher's, or is "compatible with the mirrored components" enough?

## Plan

<Filled by `/refine 001`.>

## Deliverables

<Filled by `/refine 001`.>

## Model Hints

<Filled by `/refine 001`.>

## Acceptance Tests

<Filled by `/refine 001`.>

## Done

<Filled by `/build 001`.>
