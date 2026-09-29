---
id: 029
title: Guide for adding a content type
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The registry from story 014 is the reason this is a content studio and not a news studio. A registry
nobody knows how to extend is just an indirection: when `packs/` finally gets a contract, whoever
implements it will read the news code and copy whatever they find, including the parts that were
specific to news.

This story writes down what a content type actually consists of, using `news` as the worked example,
so the second type costs a fraction of the first.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-27, section 8.

## Acceptance Criteria

- [x] **AC1** — A guide explains how to add a content type as a descriptor: every field it declares
      and what each one is for.
- [x] **AC2** — It names every place a new type touches, so nothing is discovered halfway through.
- [x] **AC3** — It uses the `news` descriptor as the worked example, pointing at the real files
      rather than restating them.
- [x] **AC4** — It states what a content type must not do: no presentation in the published surface,
      no writing outside its declared directory, no second implementation of a contract rule.
- [x] **AC5** — It explains how a type moves from "reserved" to implemented, and what has to exist
      before that is possible — starting with a contract the launcher agrees to.
- [x] **AC6** — The guide's claims about the descriptor shape are checked by a test, so it cannot
      quietly describe an older interface.

## Open Questions

- ~~Does the guide live in `docs/` (where concepts and systems live) or in `studio/` (next to the code
  it describes)? The repository's own convention says `docs/`; the code convention says next to it.~~
  answered → Decisions (Sprint)
- ~~Should the guide cover the launcher side as well — what has to be true in `q2-launcher` before a
  new content type can exist at all?~~ answered → Decisions (Sprint)
- ~~Is a scaffolding command worth having instead of a guide, and does that reduce the odds of the
  second type being a copy-paste of the first?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- The guide lives at `docs/systems/content-types.md`, and the header comment of
  `studio/src/content-types/descriptor.ts` points at it — `docs/README.md` defines `systems/` as the
  reference for implemented systems (the registry is one, since story 014), and the one-line pointer
  covers the reader who arrives through the code.
- The guide covers the launcher side as a list of what must exist there (contract, mirror entry,
  top-level layout check), pointing at `q2-launcher` rather than specifying it — AC5 demands the
  launcher contract as the first step, but its content belongs to the launcher repository.
- No scaffolding command — there is no second type with a contract to scaffold, a generator written
  from one example would copy exactly the news-specific parts the requirement warns about, and the
  guide's "news-specific, do not copy" touch points address that risk directly.
- The guide documents the descriptor exactly as `descriptor.ts` stands at build time, not as listed
  in this story — stories 018–027 in this sprint may add descriptor fields, and AC6's test is what
  keeps the two aligned.
- The guide names honestly where the seam is still news-only today (the bridge's `read` route, the
  page's `implemented` branch rendering the news library, the `validate` CLI) instead of fixing them
  — fixing them would be speculative generality for a type that has no contract yet.
- AC6 is proven by a source-level test without the TypeScript compiler API — `typescript` 7 is the
  native port, so the test extracts `ContentTypeDescriptor` members and `ContentTypeState` literals
  from `descriptor.ts` by pattern, the same source-reading style `shell-independence.test.ts` uses.
- AC2's "names every place" is made checkable from the code side: every non-test studio source file
  outside `launcher-core/` that contains a content-type id as a quoted literal must be listed as a
  touch point, so a new hard-coded branch fails the test until the guide names it.
- AC3's "pointing at real files rather than restating them" is made observable: the worked-example
  section carries no fenced code block, and every repository path the guide cites must exist.

## Plan

One document plus one anti-drift test; no production behaviour changes.

1. Write `docs/systems/content-types.md` (English, no presentation values) with these exact `##`
   sections, which the test keys on: `Descriptor fields`, `States`, `Touch points`,
   `Worked example: news`, `What a content type must not do`, `From reserved to implemented`.
2. Field table and state list are taken from `studio/src/content-types/descriptor.ts` at build time.
3. Touch points: studio side (descriptor type + id union, descriptors, registry tests,
   shell-independence test, e2e registry spec, bridge `read` route, page branch, validate CLI,
   `read-content-repo.ts`, `boundary.test.ts`), repository side (root `README.md` contract, the
   directory's placeholder `README.md`, the concept doc), launcher side (contract source, mirror
   manifest + `sync:launcher` + lock, launcher's content-repo checker). Each marked
   generic / news-specific.
4. Add the one-line pointer to the guide in `descriptor.ts`'s header comment.
5. Write `studio/tests/content-type-guide.test.ts` covering AC1–AC6, including a self-check that the
   field comparison really fails on an undocumented field.

Files: `docs/systems/content-types.md` (new), `studio/tests/content-type-guide.test.ts` (new),
`studio/src/content-types/descriptor.ts` (comment only).

## Deliverables

- **D1 — The content-type guide and its anti-drift test.**
  Files: `docs/systems/content-types.md` (new), `studio/tests/content-type-guide.test.ts` (new),
  `studio/src/content-types/descriptor.ts` (header comment only: one line "How to add a content
  type: `docs/systems/content-types.md`").
  Patterns to mirror: `studio/tests/boundary.test.ts` (repo-root resolution from `studio/tests/` and
  reading repository markdown), `studio/src/content-types/shell-independence.test.ts` (source-level
  checks over `.ts` files).
  Read first: `CLAUDE.md`, `AGENTS.md`, `README.md` (the launcher contract, reserved directories),
  `studio/src/content-types/{descriptor,descriptors,registry}.ts`,
  `studio/src/bridge/{create-file-bridge,file-bridge-plugin}.ts`,
  `studio/src/pages/studio/StudioPage.tsx`, `studio/scripts/validate.ts`,
  `studio/scripts/launcher-core.manifest.ts`, `docs/concepts/packs-content.md`.

  The guide — English, repository-relative paths in backticks, launcher-side paths prefixed
  `q2-launcher/` (they do not exist in this checkout), no CSS/HTML/colours/fonts/layout values.
  Exactly these `##` sections, in this order:
  1. `## Descriptor fields` — a Markdown table, one row per member of `ContentTypeDescriptor` as it
     stands in `descriptor.ts` **at build time** (do not trust any list written elsewhere; members
     may have been added by stories 018–027). Columns: field (backticked name, e.g. `` `id` ``),
     required (`yes` / `no`, per the `?`), purpose (non-empty, one or two sentences, including which
     states need it — e.g. `reader`/`validators` for `implemented`, `conceptPath` for `reserved`).
     Nested interfaces a field uses (e.g. `ContentTypeValidators`, `ContentTypeSource`) are
     explained in the purpose cell or a short paragraph below the table.
  2. `## States` — one bullet per `ContentTypeState` literal, starting with the backticked literal,
     with what the studio shows for it (`ContentTypeStateNotice` vs. the library).
  3. `## Touch points` — a list, one bullet per place a new type touches, each starting with the
     backticked path and saying whether it is generic (registry-derived, no change needed) or
     news-specific today (needs a change for a new type). Must include at least: `descriptor.ts`
     (`ContentTypeId` union), `descriptors.ts`, `registry.test.ts`, `descriptors.test.ts`,
     `shell-independence.test.ts` (its id list), `studio/e2e/content-type-registry.spec.ts`,
     `studio/src/bridge/create-file-bridge.ts` (the `read` route only reads `news`),
     `studio/src/bridge/file-bridge-plugin.ts` (generic: directories derived from the registry),
     `studio/src/pages/studio/StudioPage.tsx` (the `implemented` branch renders the news library),
     `studio/src/content-repo/read-content-repo.ts` (news-only reader), `studio/scripts/validate.ts`
     (news-only CLI), `studio/tests/boundary.test.ts` (published-directory list), root `README.md`
     (contract section), the directory's placeholder `README.md`, `docs/concepts/<type>-content.md`,
     `studio/scripts/launcher-core.manifest.ts` + `studio/launcher-core.lock.json` (mirror of the new
     contract via `npm run sync:launcher`), and `q2-launcher/scripts/check-content-repo.mjs`.
     **Plus every file the test's literal scan (below) finds.**
  4. `## Worked example: news` — walks the `news` descriptor field by field **by pointing** at
     `studio/src/content-types/descriptors.ts`, `studio/src/content-repo/read-content-repo.ts`,
     `studio/src/report/build-news-report.ts` and `studio/src/report/repository-findings.ts`, and
     names what is news-specific and must not be copied (the news reader, the report adaptation,
     the library view). **No fenced code block in this section.**
  5. `## What a content type must not do` — exactly three rules, each its own bullet: no
     presentation in the published surface (link `AGENTS.md`), no reading or writing outside its
     declared `directory` (the bridge's confinement), no second implementation of a contract rule
     (contract logic comes from `studio/src/launcher-core/`, never hand-edited — `CLAUDE.md`).
  6. `## From reserved to implemented` — a numbered list whose **first** step is a contract agreed
     in `q2-launcher` (the launcher reads it), then mirrored here; it names the transitions
     `reserved` → `launcher-reads` → `implemented` in that order and what must exist before each
     (launcher contract + README contract before `launcher-reads`; mirror entry, reader, validators
     before `implemented`).

  The test — `studio/tests/content-type-guide.test.ts`, one `describe('content-type guide')`,
  reading `docs/systems/content-types.md` and `studio/src/content-types/descriptor.ts` from disk:
  helpers split the guide into `##` sections; extract `ContentTypeDescriptor` member names
  (`readonly name?:` inside the `export interface ContentTypeDescriptor { … }` block) and
  `ContentTypeState` string literals by pattern (no TypeScript compiler API — `typescript` 7 is the
  native port). Tests, with these exact names:
  - "the guide documents exactly the fields ContentTypeDescriptor declares, each with a purpose" —
    set equality between table field names and interface members; every purpose cell non-empty.
  - "the field check fails when the descriptor gains an undocumented field" — runs the same compare
    helper on a synthetic interface source with an extra member and expects that member reported.
  - "the guide documents exactly the states ContentTypeState declares" — set equality.
  - "every studio source file that names a content-type id is listed as a touch point" — scans
    `studio/src/**` and `studio/scripts/**` `.ts`/`.tsx`, excluding `*.test.*` and
    `studio/src/launcher-core/**`, for any id from the `ContentTypeId` union in single or double
    quotes; each hit's repo-relative path must appear in the `Touch points` section.
  - "every repository path the guide cites exists" — each backticked token starting with `studio/`,
    `docs/` or `news/`, or equal to `README.md` / `AGENTS.md` / `CLAUDE.md`, exists relative to the
    repo root (`<type>` placeholder paths and `q2-launcher/` paths excluded).
  - "the worked example points at the news files instead of restating them" — the section contains
    no fenced code block and cites `studio/src/content-types/descriptors.ts`.
  - "the guide states the three rules a content type must not break" — the section has exactly three
    bullets, mentioning respectively presentation, `directory`, and `launcher-core`.
  - "the guide explains the path from reserved to implemented, starting with the launcher contract"
    — first numbered item mentions `q2-launcher`; `reserved`, `launcher-reads`, `implemented` occur
    in that order.

  Acceptance: `npm run test --workspace studio -- tests/content-type-guide.test.ts` is green;
  `npm run typecheck` and `npm run lint` clean for the touched files; the guide is English and
  carries no presentation values.

## Model Hints

- D1 → default.
- Review: → default — a documentation story with a self-checking test; the plausible wrong version
  (vague purpose cells) is prose quality that the default review reads directly against AC1–AC5.

## Acceptance Tests

All lines are unit tests in `studio/tests/content-type-guide.test.ts`, delivered by D1. No
criterion describes a user action in the studio UI, so no e2e line; no manual residue.

- AC1 → unit `studio/tests/content-type-guide.test.ts` › "the guide documents exactly the fields
  ContentTypeDescriptor declares, each with a purpose" **and** › "the guide documents exactly the
  states ContentTypeState declares" (D1)
- AC2 → unit `studio/tests/content-type-guide.test.ts` › "every studio source file that names a
  content-type id is listed as a touch point" **and** › "every repository path the guide cites
  exists" (D1)
- AC3 → unit `studio/tests/content-type-guide.test.ts` › "the worked example points at the news
  files instead of restating them" (D1)
- AC4 → unit `studio/tests/content-type-guide.test.ts` › "the guide states the three rules a content
  type must not break" (D1)
- AC5 → unit `studio/tests/content-type-guide.test.ts` › "the guide explains the path from reserved
  to implemented, starting with the launcher contract" (D1)
- AC6 → unit `studio/tests/content-type-guide.test.ts` › "the guide documents exactly the fields
  ContentTypeDescriptor declares, each with a purpose" **and** › "the field check fails when the
  descriptor gains an undocumented field" (D1)

Coverage gate: AC1 → D1, AC2 → D1, AC3 → D1, AC4 → D1, AC5 → D1, AC6 → D1. Every criterion has a
deliverable and a named test; no manual residue.

## Done

Summary: Added `docs/systems/content-types.md` (descriptor field table, states, touch points marked generic/news-specific, news worked example by pointers, three must-not rules, reserved -> launcher-reads -> implemented path) and `studio/tests/content-type-guide.test.ts` (8 anti-drift tests). `descriptor.ts` header gained a one-line pointer to the guide.

Commit message: `029: content-type extension guide (docs/systems/content-types.md, anti-drift test, descriptor pointer)`

Verification: narrow gate only (full gate is the sprint's). `npm run build` green, `npm run typecheck` green, `npm run test --workspace studio -- --changed HEAD` green (1 file, 8/8), named file run green 8/8, prettier clean on the two new files, eslint clean. `npm run lint` red only from pre-existing prettier failures on untouched files; `descriptor.ts` is flagged because its working copy is CRLF (line endings only, pre-existing, left untouched). No e2e (none mapped).
AC -> test as verified: AC1, AC6 -> fields test + states test + field-check self-check; AC2 -> touch-point scan + cited-paths test; AC3 -> worked-example test; AC4 -> three-rules test; AC5 -> reserved-to-implemented test. All passed. No manual residue.
Review: 1 default cycle, verdict UNCLEAR; fixed: write confinement wording (only `implemented` directories are writable), missing touch points (client.ts, bridge-protocol.ts, launcher-safe-names.ts, library/authoring/publishing/images modules), tests now compare the `required` column with `?`, cite all four worked-example files and assert row shape.

Decisions:
- Touch points beyond the story list were added from the code as it stands (bridge write/image/batch routes, write-files, resolve-bridge-path, news feature modules), each marked generic or news-specific.
- Review points left unfixed: purpose cells are only checked non-empty and the touch-point check is substring-based (generic/news-specific label untestable without prose parsing); the AC5 ordering check uses first occurrence over the section. Accepted as the story's specified test shape.

tiers: D 1 / hard 0 · review default · cycles 1 · agents 5
