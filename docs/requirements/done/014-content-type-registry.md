---
id: 014
title: Content-type registry drives the studio
status: done # draft -> ready -> in-progress -> done
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

- [x] **AC1** — The studio's navigation is built by iterating a registry; no content type is named
      in the shell's own code.
- [x] **AC2** — `news` is registered with its directory, its index file, its reader and its
      validators, and is fully usable through the registry.
- [x] **AC3** — `packs`, `mods` and `config_templates` appear with the state "reserved — the
      launcher does not read this yet".
- [x] **AC4** — `engines` and `gamedata` appear with the state "read by the launcher, not editable
      here yet" — distinct from reserved, because they carry real content today.
- [x] **AC5** — Selecting a type that is not implemented explains its state and what would have to
      exist first; it never shows an empty screen or a dead control.
- [x] **AC6** — Adding a descriptor requires no change to the shell, and a test proves it by
      registering a throwaway type and finding it in the navigation.

## Open Questions

- ~~What exactly does a descriptor declare? Directory, index file, schema, validators, editor fields
  and preview component are the obvious ones — is there anything a future type needs that news does
  not?~~ answered → Decisions (Sprint)
- ~~Should the reserved types link to the place where their contract would be defined (a future
  concept), so someone clicking them has somewhere to go?~~ answered → Decisions (Sprint)
- ~~Does the registry need to handle a content type with no index file at all, and does anything
  planned actually look like that?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Descriptor scope in v1: minimal set only — directory, index file, reader, validators.
  Editor fields and preview component are added per content type once that type is actually being
  edited, not speculatively now.
- **(User)** Reserved types (`packs`, `mods`, `config_templates`) link to a placeholder concept doc
  each, so their state text has somewhere to go. These stub concept docs are created as part of this
  story's implementation.
- **(User)** No-index-file content type: out of scope for v1. None of the six known types need it,
  and reserved types have no contract at all yet — revisit only when a real type requires it.
- Registry code lives in `studio/src/content-types/`, following this repository's existing flat
  domain-directory convention (`content-repo/`, `report/`, `contract/`, `mirror/`) rather than
  inventing a `features/` tree for a single module.
- The descriptor carries a `state` enum (`implemented` | `launcher-reads` | `reserved`) and the
  shell renders the wording per state, so the AC3/AC4 texts exist once instead of per content type
  and no type name appears in shell code (AC1).
- The registry is produced by a factory that receives its file source as an argument (the same
  pattern story 015 fixed for the bridge's fixture root), so tests bind a fixture source and the
  app binds the real one without any runtime toggle.
- Until story 015's bridge client exists, the factory's default source is an explicit "file bridge
  not available" source that yields a readable state instead of throwing, so 014 is shippable on
  its own and 015/016 only swap the argument.
- The news descriptor's validators bind directly to the existing pure functions
  (`buildNewsReport`, `collectRepositoryFindings`) because they take data, not a filesystem, and
  are therefore already browser-safe.
- Selecting `news` in 014 renders a named, labelled mount region (not a blank pane) that story 016
  replaces with the library view, so AC5's "never an empty screen" also holds for the one
  implemented type.
- The reserved types' concept links are rendered as repository-relative paths in text, not as
  anchors: the bridge (015 AC3) may only serve directories a descriptor declares, so `docs/` is
  unreachable and an `<a href>` would be exactly the dead control AC5 forbids.
- Navigation state is plain React state in the page, with no router dependency added — the studio
  is a single screen with a content-type selector, and a router would be a dependency bought for
  nothing.
- New UI components go into `studio/src/organisms/` per `/frontend-guidelines`' layer map; this is
  the first UI beyond the page shell, so the layer is created here.

## Plan

1. **Registry core** (`studio/src/content-types/`): a `ContentTypeDescriptor` type carrying only
   the minimal v1 set the user fixed — `id`, `label`, `state`, `directory`, `indexFile`, plus
   `reader` and `validators` for implemented types and `conceptPath` for reserved ones. A
   `createContentTypeRegistry({ source })` factory returns the six descriptors in a fixed order.
2. **Descriptors**: `news` (implemented, `news/`, `index.json`, reader over the injected source,
   validators = `buildNewsReport` + `collectRepositoryFindings`); `engines` and `gamedata`
   (`launcher-reads`, with their `manifest.json`); `packs`, `mods`, `config_templates`
   (`reserved`, each with its `conceptPath`).
3. **Reserved concept stubs**: three placeholder docs under `docs/concepts/`, so the reserved state
   text has a destination; each states that no contract exists and that `/concept` is the next
   step. Linked from the descriptors and checked by a test.
4. **Shell navigation**: `ContentTypeNav` iterates the registry; `StudioPage` holds the selected id
   and renders the nav plus one content region. No content-type identifier appears in either file —
   proven by a source-level test over the shell files.
5. **State views**: `ContentTypeStateNotice` renders the three non-implemented states with the
   explanation of what would have to exist first; `news` renders a labelled mount region for 016.
6. **Order**: D1 → D2 → D3 → D4. Files touched: `studio/src/content-types/*`,
   `studio/src/organisms/*`, `studio/src/pages/studio/StudioPage.tsx`,
   `studio/e2e/content-type-registry.spec.ts`,
   `docs/concepts/{packs,mods,config-templates}-content.md`.

## Deliverables

- **D1 — Registry core and the six descriptors.**
  Files: `studio/src/content-types/descriptor.ts`, `studio/src/content-types/registry.ts`,
  `studio/src/content-types/descriptors.ts`, `studio/src/content-types/registry.test.ts`,
  `studio/src/content-types/descriptors.test.ts`.
  Pattern to mirror: `studio/src/report/report-types.ts` (type module) and
  `studio/src/content-repo/read-content-repo.ts` (injected root, never-throws style).
  Acceptance: the factory returns six descriptors in a fixed order; `news` declares directory,
  index file, reader and validators, and its reader/validators run green against
  `studio/tests/fixtures/content-repo`; the other five carry their state and no reader. Tests in
  the two named test files.

- **D2 — Reserved concept stubs, linked from the descriptors.**
  Files: `docs/concepts/packs-content.md`, `docs/concepts/mods-content.md`,
  `docs/concepts/config-templates-content.md`, `studio/src/content-types/descriptors.ts`,
  `studio/src/content-types/descriptors.test.ts`.
  Pattern to mirror: `docs/concepts/content-studio.md` (title + status line only — these are stubs,
  not concepts).
  Acceptance: each reserved descriptor names a `conceptPath` that exists on disk; the docs are
  English, carry no presentation, and state the missing contract plus `/concept` as the next step.

- **D3 — Navigation built from the registry.**
  Files: `studio/src/organisms/ContentTypeNav.tsx`, `studio/src/organisms/ContentTypeNav.test.tsx`,
  `studio/src/pages/studio/StudioPage.tsx`, `studio/src/pages/studio/StudioPage.test.tsx`,
  `studio/src/content-types/shell-independence.test.ts`,
  `studio/e2e/content-type-registry.spec.ts`.
  Pattern to mirror: `studio/src/pages/studio/StudioPage.tsx` + its test; the e2e spec mirrors
  `studio/e2e/studio-shell.spec.ts`.
  Acceptance: the nav lists exactly the registry's entries in registry order; selecting one marks
  it current; a registry built with one extra throwaway descriptor shows that entry without any
  shell change (AC6); no content-type id string occurs in the shell files.

- **D4 — State views for the types that are not editable here.**
  Files: `studio/src/organisms/ContentTypeStateNotice.tsx`,
  `studio/src/organisms/ContentTypeStateNotice.test.tsx`,
  `studio/src/pages/studio/StudioPage.tsx`, `studio/e2e/content-type-registry.spec.ts`.
  Pattern to mirror: `studio/src/organisms/ContentTypeNav.tsx` from D3; tokens per
  `/design-tokens` (no raw palette classes).
  Acceptance: `reserved` shows "reserved — the launcher does not read this yet" plus its concept
  path; `launcher-reads` shows "read by the launcher, not editable here yet" plus what would have
  to exist first; `news` shows a labelled mount region for story 016. No state renders an empty
  area, and no control is present that does nothing.

## Model Hints

- D1 → `deliverable-hard` — it fixes the extension seam (descriptor shape plus injected file
  source) that stories 015, 016 and 017 all build on in this same sprint, so a wrong port shape
  costs rework in three stories instead of one.
- D2 → default.
- D3 → default.
- D4 → default.
- Review: → default — the story only adds new modules plus one small shell rewrite; there is no
  existing behaviour it can regress.

## Acceptance Tests

- AC1 → e2e `studio/e2e/content-type-registry.spec.ts` › "the navigation lists every registered
  content type" **and** unit `studio/src/content-types/shell-independence.test.ts` › "no
  content-type identifier appears in the shell's own source" (D3)
- AC2 → unit `studio/src/content-types/descriptors.test.ts` › "news declares its directory, index
  file, reader and validators and reads the fixture repository through the registry" (D1)
- AC3 → e2e `studio/e2e/content-type-registry.spec.ts` › "packs, mods and config_templates are
  shown as reserved with their concept document" **and** unit
  `studio/src/content-types/descriptors.test.ts` › "every reserved descriptor links a concept
  document that exists" (D2/D4)
- AC4 → e2e `studio/e2e/content-type-registry.spec.ts` › "engines and gamedata are shown as read by
  the launcher, not editable here" (D4)
- AC5 → e2e `studio/e2e/content-type-registry.spec.ts` › "selecting a type that is not implemented
  explains its state and offers no dead control" (D4)
- AC6 → unit `studio/src/organisms/ContentTypeNav.test.tsx` › "a throwaway descriptor appears in
  the navigation without a shell change" (D3)

Coverage gate: AC1 → D3, AC2 → D1, AC3 → D2 + D4, AC4 → D4, AC5 → D4, AC6 → D3. Every criterion has
a deliverable and a named test; no manual residue.

## Done

**Summary.** The studio now has a real content-type registry (`studio/src/content-types/`):
a `ContentTypeDescriptor` type, a `createContentTypeRegistry({ source })` factory returning the
six descriptors in fixed order, and the six descriptors themselves — `news` bound to the real
`buildNewsReport`/`collectRepositoryFindings`, `engines`/`gamedata` as `launcher-reads`,
`packs`/`mods`/`config_templates` as `reserved` with a stub concept doc each. `StudioPage` now
renders `ContentTypeNav` (iterates the registry, marks the selection `aria-current`) and
`ContentTypeStateNotice` (per-state wording, never an empty region, no dead control) — neither
file names a content type literally. While closing the story, the app was found to crash on load
in the browser (a pre-existing Node-builtin leak in the mirrored tree, first exposed because 014
is the first story to reach it from browser code); fixed by extending the existing
`launcherBoundary.ts` stub-redirect plugin, without touching the mirror.

**Commit message:** `014: content-type registry drives the studio`

**Verification:**
- `npm run test` (`studio/`): 205/209 passing. The 4 red files (`tests/mirrorDrift.test.ts`,
  `tests/drift-provenance.test.ts`, `tests/launcher-core-unmodified.test.ts`,
  `tests/mirror-set.test.ts`) are pre-existing mirror-hash-drift failures, unrelated to this story
  and unchanged by it (confirmed present before D1 started).
- `npm run typecheck`: clean. `npm run lint`: clean for every file this story touched (the
  repo-wide `npm run lint` run still reports pre-existing, unrelated formatting issues across
  ~138 files predating this story, plus Playwright's own `test-results/` trace artifacts).
- `npm run e2e`: 13/13 passing (full suite, including the pre-existing `studio-shell.spec.ts`
  cases, which had regressed to failing mid-story from the browser crash below and are confirmed
  fixed).
- Clean-agent review: **PASS**, no findings.
- AC → test mapping, as verified:
  - AC1 → e2e `content-type-registry.spec.ts` › "the navigation lists every registered content
    type" (pass) + unit `shell-independence.test.ts` › "no content-type identifier appears in the
    shell's own source" (pass)
  - AC2 → unit `descriptors.test.ts` › "news declares its directory, index file, reader and
    validators and reads the fixture repository through the registry" (pass)
  - AC3 → e2e `content-type-registry.spec.ts` › "packs, mods and config_templates are shown as
    reserved with their concept document" (pass) + unit `descriptors.test.ts` › "every reserved
    descriptor links a concept document that exists" (pass)
  - AC4 → e2e `content-type-registry.spec.ts` › "engines and gamedata are shown as read by the
    launcher, not editable here" (pass)
  - AC5 → e2e `content-type-registry.spec.ts` › "selecting a type that is not implemented
    explains its state and offers no dead control" (pass)
  - AC6 → unit `ContentTypeNav.test.tsx` › "a throwaway descriptor appears in the navigation
    without a shell change" (pass)
  - No manual residue.

**Decisions (not pre-fixed by refine, made during the build):**
- **Injected source shape.** `ContentTypeSource = { read(directory): Promise<ContentSourceRead> }`
  (`ContentSourceRead` is `ContentRepoRead`) — async from the start, so story 015's HTTP file
  bridge swaps in without changing the port; `reader()` on a descriptor takes no arguments (source
  and directory are closed over at factory time); `validators.buildReport(read, now)` takes the
  caller's clock explicitly. `directory` is stored without a trailing slash (`'news'`), matching
  `NEWS_DIR_NAME` in `read-content-repo.ts` rather than the plan prose's `news/`.
  Until story 015 lands, the registry factory's default `source` is `unavailableFileBridgeSource`,
  which never throws and yields an empty, findings-free read.
- **Browser crash from the mirrored tree, found and fixed during closing verification (not a
  planned deliverable).** `studio/src/launcher-core/src/main/modules/home/images/paths.ts`,
  `resolve-feed-images.ts`, `image-cache.ts` and `lib/fs-utils.ts` import Node built-ins
  (`node:crypto`, `node:fs`, `node:fs/promises`, `node:path`) at module top level. Story 014 is
  the first story to make those files reachable from browser-loaded code (via `descriptors.ts`'s
  `news` validators binding to `buildNewsReport`/`collectRepositoryFindings`, both previously
  exercised only from the Node-context CLI and from Vitest). Vite externalizes Node built-ins in
  the browser as a `Proxy` that throws on any property access, so merely importing those files —
  not even calling anything in them — crashed the whole app on load, including the pre-existing,
  story-unrelated `studio-shell.spec.ts` e2e cases. Fixed by extending the existing
  `studio/src/mirror-runtime/launcherBoundary.ts` Vite plugin (which already redirects three
  relative mirror imports to studio-owned stubs) to also redirect the four bare Node-builtin
  specifiers to four new stub files (`node{Crypto,Fs,FsPromises,Path}Stub.ts`) — only for
  importers inside `src/launcher-core/`, so nothing outside the mirror is affected.
  `nodePathStub.ts` is a real, correct reimplementation (pure string ops); the crypto/fs-promises
  stubs throw a clear error if ever actually invoked, since none of that file I/O is meant to run
  client-side. `studio/src/launcher-core/**` itself was not touched, per `CLAUDE.md`. This is
  infrastructure load-bearing for stories 015-017 too, since any of them binding mirrored
  report/pipeline code into browser-reachable UI would have hit the same crash.
- Reserved-type concept links render as plain text (`conceptPath`), never as `<a href>`, per the
  plan's own Decisions (the bridge may only serve declared directories; `docs/` is unreachable and
  a link would itself be the dead control AC5 forbids).
