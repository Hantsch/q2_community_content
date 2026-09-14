---
id: 007
title: The mirrored news contract runs unmodified in the studio
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Copying the launcher's contract code into this repository is only half the job; it has to actually
run here. The launcher's sources use its own path aliases and are written for its build, so they
compile there by construction and not necessarily here.

The point of this story is a specific guarantee: when the studio later says "the launcher will drop
this entry", that sentence is produced by the launcher's own pipeline, not by studio code that
agrees with it today. Every rule that is re-implemented on this side is a rule that will disagree
eventually.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-7, section 6.

## Acceptance Criteria

- [x] **AC1** — The mirrored contract modules (`home.ts`, `feed-pipeline.ts`, `frontmatter.ts`)
      compile under `npm run typecheck` with no edits to their contents.
- [x] **AC2** — Running the mirrored pipeline over this repository's own `news/` yields exactly the
      four published entries, with the templates `split`, `banner`, `text`, `cover` and the orders
      10, 20, 30, 40.
- [x] **AC3** — A fixture entry with no title is dropped, and a `cover` fixture with a missing image
      is delivered as `text` — both verdicts produced by the mirrored pipeline, not by studio code.
- [x] **AC4** — No module outside `studio/src/launcher-core/` implements a contract rule: the button
      host allowlist, the three-button limit, the image-fallback rule and the drop rules exist in
      exactly one place, and a test asserts it.
- [x] **AC5** — The mirrored code is reached only through a documented boundary module, so a later
      re-sync cannot break unrelated studio imports.
- [x] **AC6** — `npm run check:drift` still passes afterwards — nothing in this story edits a
      mirrored file to make it fit.

## Open Questions

- ~~How are the launcher's path aliases (`@shared/...`) resolved here?~~ answered → Decisions
  (Sprint).
- ~~Does `zod` have to be pinned to the launcher's exact version?~~ answered → Decisions (Sprint).
- ~~Where do the contract fixtures for AC3 live?~~ answered → Decisions (Sprint).

## Decisions (Sprint)

- **Alias resolution: map, never rewrite.** `@shared/*` is mapped in the studio's own build config
  (`tsconfig.json` `paths`, plus `resolve.alias` in `vite.config.ts` and `vitest.config.ts`) —
  confirmed against 005 AC2, which requires byte-identical copies and forbids import fixups, so any
  sync-time rewrite would invalidate the lock hashes and the drift check.
- **One alias is enough.** The mirrored set contains exactly one alias specifier,
  `@shared/modules/home` in `feed-pipeline.ts`; `home.ts` imports only `zod` and `frontmatter.ts`
  imports nothing, so a single `@shared/*` mapping covers the whole set with no transitive pull-in.
- **The mirror keeps the launcher's path below `src/`** — `launcher-core/shared/modules/home.ts` and
  `launcher-core/main/modules/home/news/{feed-pipeline,frontmatter}.ts` — because `feed-pipeline.ts`
  reaches `./frontmatter` relatively and `home.ts` by alias, and only a preserved tree lets both
  resolve with zero edits. This is a constraint on 005's declared file list, flagged there, not
  changed here.
- **`zod` is pinned exactly to the launcher's resolved `4.4.3`** (no caret), because `home.ts`'s
  schemas *are* the contract and a minor-version behaviour change would surface as a wrong verdict
  rather than as an error.
- **The pin is asserted by a test**, since an exact pin nobody checks quietly turns back into a
  range at the next dependency update.
- **Contract fixtures live in `studio/tests/fixtures/news-contract/`**, outside `news/` and outside
  `src/launcher-core/`, because the published surface must stay exactly the four real entries and
  mirrored code is never hand-edited — so test material has nowhere else to belong.
- **One boundary module, `studio/src/contract/launcher-contract.ts`**, is the only studio file
  allowed to import from `src/launcher-core/` or `@shared/*`; it re-exports the pipeline functions,
  the contract types and the rule constants, so a re-sync touches one import site (AC5).
- **The single-source rule is enforced twice** — an eslint `no-restricted-imports` zone and a
  guard test — because a rule only a test knows about is found at test time, while eslint finds it
  while the offending line is being typed.
- **Reading `news/` from disk is studio code, not a contract rule.** `buildFeed` is pure (it takes
  a parsed index plus raw document strings and never touches the filesystem), so a thin
  `read-news-tree.ts` loader is the only studio-side code AC2 needs.
- **"Missing image" in AC3 means the frontmatter field is absent or blank**, not a file missing on
  disk — the mirrored pipeline does no IO, so file-existence checking is validation work for M3, not
  a contract rule.
- **AC2's run passes a fixed `now` (2026-09-13T00:00:00Z)** rather than the system clock, because
  `filterAndSortSlides` honours `visibleFrom`/`visibleUntil` and a wall-clock test would change its
  verdict with the calendar.
- **Contract tests run in vitest's `node` environment** (no DOM, no Node-only API in the mirrored
  set), matching the launcher's own default and the studio's existing convention.

## Plan

The mirrored contract is three files with one external dependency (`zod`) and exactly one alias
import. Making it run here is therefore a toolchain job plus proof, not a porting job — nothing in
`studio/src/launcher-core/` is touched.

1. **Make it compile and lint untouched.** Add `zod@4.4.3` (exact) to `studio/package.json`; map
   `@shared/*` → `src/launcher-core/shared/*` in `studio/tsconfig.json` (`paths`),
   `studio/vite.config.ts` and `studio/vitest.config.ts` (`resolve.alias`). `tsconfig.json` already
   includes `src/**/*.ts`, so the mirrored files enter `npm run typecheck` by themselves.
   `eslint.config.js` already ignores `src/launcher-core/**`; `studio/.prettierignore` does not —
   add it, otherwise `npm run lint` demands edits to mirrored files that no one may make.
2. **Give the mirror one door.** `studio/src/contract/launcher-contract.ts` re-exports `buildFeed`,
   `resolveFeed`, `filterAndSortSlides`, the `NewsSlide`/`NewsFeedWarning` types and the rule
   constants; `studio/src/contract/read-news-tree.ts` turns the repository's `news/index.json` plus
   its `.md` files into the `{ index, documents }` shape the pipeline expects. No rule logic in
   either.
3. **Prove it over the real repository** (AC2) and **over fixtures** (AC3) — the drop and fallback
   verdicts come out of `buildFeed`, asserted as returned values, never recomputed on this side.
4. **Guard the single source** (AC4/AC5): eslint zone plus a test that scans `studio/src` and
   `studio/tests` for a second home of the host allowlist, the three-button cap, the image fallback
   and the drop rules.
5. **Close the loop** (AC6): `npm run check:drift` runs as a test, and `studio/README.md` documents
   the boundary module and the alias mapping so the next re-sync knows what it may rely on.

Order: 1 → 2 → 3 → 4 → 5. Prerequisite: 005 and 006 are built, so `studio/src/launcher-core/`,
`studio/launcher-core.lock.json` and `npm run check:drift` exist. If the mirror is absent when this
story is built, run `npm run sync:launcher -- --launcher ../q2-launcher` first — do not hand-create
the files.

## Deliverables

- [x] **D1 — The mirrored contract compiles and lints with no edits.**
  Files: `studio/package.json` (`zod` exact `4.4.3`), `studio/tsconfig.json` (`paths`),
  `studio/vite.config.ts`, `studio/vitest.config.ts` (`resolve.alias`), `studio/.prettierignore`
  (add `src/launcher-core/`), plus its test in `studio/tests/launcher-core-toolchain.test.ts`.
  Mirror the spawn/read pattern of `studio/tests/boundary.test.ts`.
  Accepted when: `npm run typecheck` and `npm run lint` pass with the mirror present, the test
  asserts `tsc -p tsconfig.json --noEmit` exits 0 and that `zod` is declared as an exact version
  matching the installed one.

- [x] **D2 — One documented door into the mirror, and the real feed through it.**
  Files: `studio/src/contract/launcher-contract.ts` (new, re-export only),
  `studio/src/contract/read-news-tree.ts` (new, IO only), plus its test in
  `studio/tests/news-contract.test.ts`.
  Accepted when: `buildFeed` over this repository's `news/` with `now = 2026-09-13T00:00:00Z`
  returns four slides with templates `split`, `banner`, `text`, `cover` and orders 10/20/30/40, and
  nothing outside `launcher-core/` computed any of it.

- [x] **D3 — The verdicts, on fixtures.**
  Files: `studio/tests/fixtures/news-contract/*.md` (new), plus its test in
  `studio/tests/news-contract-fixtures.test.ts`.
  Accepted when: a title-less fixture is absent from `slides` with a warning naming the rule, and a
  `cover` fixture without an `image` comes back with `template: 'text'` — both read off `buildFeed`'s
  return value.

- [x] **D4 — No second home for a contract rule.**
  Files: `studio/eslint.config.js` (`no-restricted-imports` zone for `launcher-core`/`@shared`
  outside `src/contract/launcher-contract.ts`), plus its test in
  `studio/tests/contract-single-source.test.ts`.
  Accepted when: the test scans `studio/src` and `studio/tests` (excluding `src/launcher-core/`) and
  fails on a second occurrence of the host allowlist literals, a numeric button cap, the
  image-fallback template mapping or a drop rule; and on any import of `launcher-core`/`@shared`
  outside the boundary module. It must not trip over the boundary module's own re-exports.

- [x] **D5 — Drift still green, boundary written down.**
  Files: `studio/README.md` (boundary module + alias mapping), plus its test in
  `studio/tests/launcher-core-unmodified.test.ts`.
  Accepted when: the test runs `npm run check:drift` and asserts exit 0, and asserts the README
  names `src/contract/launcher-contract.ts` and the `@shared/*` mapping.

## Model Hints

- D1 → default
- D2 → default
- D3 → default
- D4 → `deliverable-hard` — the guard has to catch a re-implemented contract rule anywhere in
  `studio/src`/`studio/tests` while not false-positiving on the boundary module's re-exports, the
  mirrored tree itself or the fixtures, which is exactly the kind of scan that is written too loose
  or too tight on the first try.
- D5 → default
- Review: → `story-review-hard` — this story's only real failure mode is a contract rule that leaked
  into studio code and a guard test written loosely enough to miss it; a cheap review that reads the
  diff as "configs plus tests" would pass it.

## Acceptance Tests

`ui-acceptance-required: true` applies, but no criterion of this story describes a user action —
nothing here is user-visible (see `docs/sprints/S02/sprint.md`, Notes). All criteria are contract
and toolchain level and map to `npm run test`. This is a scope statement, not a coverage gap.

- AC1 → unit `studio/tests/launcher-core-toolchain.test.ts` › "tsc -p tsconfig.json --noEmit exits
  0 with the mirror present" and › "zod is declared as an exact version matching the installed
  one" (D1)
- AC2 → unit `studio/tests/news-contract.test.ts` › "the repository's own news feed yields four
  slides in order 10/20/30/40" (D2)
- AC3 → unit `studio/tests/news-contract-fixtures.test.ts` › "a title-less entry is dropped" and
  › "a cover without an image is delivered as text" (D3)
- AC4 → unit `studio/tests/contract-single-source.test.ts` › "no contract rule exists outside
  launcher-core" (D4)
- AC5 → unit `studio/tests/contract-single-source.test.ts` › "only the boundary module imports the
  mirror" (D4) and `studio/tests/launcher-core-unmodified.test.ts` › "README.md names the contract
  boundary module and the @shared/* alias" (D5)
- AC6 → unit `studio/tests/launcher-core-unmodified.test.ts` › "npm run check:drift exits 0
  against this repository own mirror" (D5)

## Done

The mirror populated by story 005's `npm run sync:launcher -- --launcher <q2-launcher checkout>`
(11 files, launcher commit `a41b3ac...`) now actually runs here: `@shared/*` is mapped to
`studio/src/launcher-core/src/shared/*` (D1), a single boundary module
`studio/src/contract/launcher-contract.ts` re-exports the pipeline and rule constants and is the
only door into the mirror (D2), `buildFeed` over the repository's own `news/` and over two new
fixtures produces the drop/fallback verdicts (D2/D3), an eslint zone plus a scanning guard test
prove no contract rule or mirror import exists a second time anywhere in `studio/src`/`studio/tests`
(D4), and `npm run check:drift` plus the new boundary documentation in `studio/README.md` close the
loop (D5).

**Commit message:** `007: run the mirrored launcher contract in the studio`

### Decisions

- The manifest-produced mirror path has an extra `src/` segment inside `launcher-core/`
  (`studio/src/launcher-core/src/shared/modules/home.ts`, not `launcher-core/shared/...` as the
  story's own Decisions section shorthand suggested) — confirmed against
  `studio/scripts/launcher-core.manifest.ts` (already built in story 005) before configuring the
  `@shared/*` alias, so `paths`/`resolve.alias` target the real on-disk path.
- D1 additionally excludes `src/launcher-core/src/renderer/**` from `studio/tsconfig.json`'s
  compiled set. The synced mirror also carries renderer `.tsx` files (from the 005 manifest, for
  later stories) that import local launcher modules (`components/ui/Button`, `../client`) not
  present in this repository yet. AC1 only requires the three contract modules
  (`home.ts`/`feed-pipeline.ts`/`frontmatter.ts`) to typecheck; excluding the renderer slice was
  the only way to make `npm run typecheck` green without editing mirrored content. Flagged for a
  later story: this exclusion should be revisited (narrowed or removed) once a story mirrors the
  renderer's own missing dependencies, otherwise the renderer stays silently out of
  typecheck/build indefinitely.
- `studio/tsconfig.node.json` also needed the `@shared/*` `paths` mapping (not listed in D2's file
  set) because `tests/**/*.ts` compiles under that separate tsconfig project and the new
  `news-contract.test.ts` transitively imports the mirror through the boundary module.

### Verification

- `npm run build` — pass.
- `npm run test` — pass, 16 files / 66 tests.
- `npm run typecheck` — pass (both `tsconfig.json` and `tsconfig.node.json` projects).
- `npm run lint` — `eslint .` passes with 0 errors; `prettier --check .` fails, but only on
  pre-existing CRLF-vs-LF noise from this Windows checkout's `core.autocrlf=true` with no
  `.gitattributes` — confirmed via `git stash` that the identical ~26 unrelated files (`src/App.tsx`,
  `index.html`, `e2e/**`, etc.) already failed the same way before this story touched anything.
  Content-level formatting (`npx prettier --check --end-of-line auto .`, which ignores only line
  endings) is clean for every file this story added or changed. This is a pre-existing repository/
  environment condition, not something introduced here; fixing it (a `.gitattributes` policy) is
  out of this story's scope.
- `npm run check:drift` — `check:drift: ok — 11 mirrored file(s) checked, no drift found.` (AC6).
- e2e — not applicable; the story's own `## Acceptance Tests` section records this is contract/
  toolchain-only work with no user-visible surface.
- Review: `story-review-hard` — one review-fix cycle. Initial verdict FAIL on one blocking finding
  (three story-introduced files not clean under content-level prettier); fixed with
  `prettier --write` on those three files, re-verified clean. Two additional non-blocking
  findings were also fixed in the same cycle: `news-contract-fixtures.test.ts` now has two
  separate `it`s (one per AC3 verdict, matching the Acceptance Tests section) instead of one
  combined test, and `news-contract.test.ts` now also asserts the four slides' `id`s (not just
  template/order) so a feed with matching shapes but wrong entries would fail it. Two remaining
  review findings left deliberately unfixed:
  - D4's guard test is a copy-detector (catches a verbatim re-implementation) rather than a full
    behavioural-equivalence detector (a differently-worded re-implementation of the same rule
    could slip past it). Closing this fully would require a much heavier check (e.g. static
    analysis of decision logic) disproportionate to this story's scope; the guard still meets
    AC4's literal wording and the sanity check the implementing agent ran confirms it catches the
    plausible shapes.
  - `read-news-tree.ts` builds file URLs via string concatenation instead of `pathToFileURL`; safe
    on this checkout and on POSIX paths without special characters, a real but low-probability
    edge case, left as a note for a future story rather than an in-cycle fix.

### AC → test mapping, as verified

| AC | Test | Result |
| --- | --- | --- |
| AC1 | `launcher-core-toolchain.test.ts` › "tsc -p tsconfig.json --noEmit exits 0 with the mirror present"; › "zod is declared as an exact version matching the installed one" | pass |
| AC2 | `news-contract.test.ts` › "the repository's own news feed yields four slides in order 10/20/30/40" | pass |
| AC3 | `news-contract-fixtures.test.ts` › "a title-less entry is dropped"; › "a cover without an image is delivered as text" | pass |
| AC4 | `contract-single-source.test.ts` › "no contract rule exists outside launcher-core" | pass |
| AC5 | `contract-single-source.test.ts` › "only the boundary module imports the mirror"; `launcher-core-unmodified.test.ts` › "README.md names the contract boundary module and the @shared/* alias" | pass |
| AC6 | `launcher-core-unmodified.test.ts` › "npm run check:drift exits 0 against this repository own mirror" | pass |

No `manual residue` — every criterion is machine-checked.
