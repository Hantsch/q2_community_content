---
id: 013
title: Repository-level findings across the news directory
status: ready # draft -> ready -> in-progress -> done
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

None — all resolved, see Decisions (Sprint).

- ~~Where does AC4's "launcher safe-name rule" come from — it is not in the current mirror set?~~
  answered → Decisions (Sprint), first bullet
- ~~Is a mismatch between a document's frontmatter `order` and its `index.json` `order` an error or a
  note? The contract says the index decides the feed, so it is not fatal, but the two disagreeing is
  almost always an accident.~~ answered → Decisions (Sprint)
- ~~Should an unreferenced image be reported once, or grouped when there are many (for example after a
  campaign of entries expired)?~~ answered → Decisions (Sprint)
- ~~Does the check know about `visibleUntil` dates far in the past — is an entry that expired two
  years ago worth surfacing as clutter?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** AC4 safe-name rule source: mirror the rule's files as they are (option a). Add
  `feed-fetcher.ts` (+ `lib/content-repo.ts`, `news/harness.ts`) and `resolve-feed-images.ts`
  (+ its internal imports: `node:path`, `lib/fs-utils`, `lib/renderer-source`, `./fetch-image`,
  `./image-cache`, `./paths`) to `studio/scripts/launcher-core.manifest.ts`, re-sync, and import
  only the two safe-name predicates (`SAFE_DOCUMENT_NAME`, `SAFE_IMAGE_PATH_SEGMENT`) plus the
  extension allowlist from `images/paths.ts`. Verbatim and drift-checked, matching CLAUDE.md's
  mirroring rule; extracting a pure module upstream first was ruled out as out of scope for this
  sprint (touches the other repository), and reimplementing the rule in studio code was ruled out
  because the concept explicitly forbids the studio rebuilding launcher rules.

- The mirror set for that rule is **eight** files, not the three-plus-imports the decision sketched,
  and the exact paths differ from the sketch — verified against the launcher checkout:
  `src/main/modules/home/news/feed-fetcher.ts`, `src/main/lib/content-repo.ts`,
  `src/main/modules/home/images/resolve-feed-images.ts`, `.../images/fetch-image.ts`,
  `.../images/image-cache.ts`, `.../images/paths.ts`, `src/main/lib/fs-utils.ts`,
  `src/main/lib/renderer-source.ts`. That set is import-closed (everything else they reference is
  a `node:` builtin or the already-mirrored `@shared/modules/home`), so the manifest needs no
  further entries.
- **`news/harness.ts` is deliberately NOT mirrored**, against the letter of the decision but for its
  stated reason: `feed-fetcher.ts:2` reaches it only through an erased `import type { NewsSource }`,
  while the file itself pulls `lib/ui-harness.ts` → `lib/paths.ts` → **`electron`** — mirroring it
  would drag the launcher's Electron app-paths and its UI-harness backdoor into a content
  repository for one type alias.
- That one unresolvable relative import is redirected with the mechanism story 008 already
  established for `../client`: a studio-owned stub plus a `rootDirs` entry, never a hand-edit of the
  mirror — `tsconfig.json` gains `./src/launcher-core/src/main/modules/home/news` next to the
  existing renderer root so `./harness` falls through to `src/mirror-runtime/harness.ts`, which
  declares only the `NewsSource` union (a boundary type, not a rule).
- The two regexes are **module-private**; what is exported are the predicate *functions* — so the
  studio imports `isSafeNewsDocumentName()` (`feed-fetcher.ts:80`, includes the 200-char cap) and
  `isSafeDeclaredImagePath()` (`resolve-feed-images.ts:109`), plus `SAFE_NEWS_IMAGE_EXTENSIONS`
  (`images/paths.ts:28`). Calling the launcher's own predicate is stricter adherence to "do not
  rebuild launcher rules" than copying a regex out of it would be.
- `isSafeNewsImageFileName()` is **not** used: it asserts the *cache* file-name shape (64 hex chars
  from a sha256 of the source URL), which no repository file will ever match — applying it to
  `news/img/` would flag every correct image. Repository image files get
  `isSafeDeclaredImagePath()` plus an extension check against `SAFE_NEWS_IMAGE_EXTENSIONS`.
- The finding's `detail` names the broken rule **in words** (which predicate refused it, and whether
  it was the document rule, the path-segment rule or the extension allowlist) — it does not reprint
  the regex, which would be a copy of launcher source living outside the mirror.
- Own door, not `launcher-contract.ts`: the safe-name re-exports go into a new
  `studio/src/contract/launcher-safe-names.ts` added to the ESLint allowlist, because this mirror
  slice reaches `node:fs`/`node:crypto` and must not become reachable from the browser contract
  module that the studio app already imports.
- `studio/tsconfig.json` gains `"node"` in `types` — with only `vite/client` listed, the mirrored
  files' `node:path`/`node:fs` imports do not resolve and `npm run typecheck` fails.

- **(User)** frontmatter/index `order` mismatch: reported as a note (`warning`, per story 011's
  severity model), not an error — the index decides the feed per the contract.
- **(User)** Unreferenced images: reported once per image, as a flat list — no grouping in v1.
- **(User)** Stale `visibleUntil` clutter check: out of scope for this story; no AC asks for it. Can
  become a follow-up story if wanted.
- Home of the code: `studio/src/report/repository-findings.ts`, not a script — the findings are core
  logic that both the command (012) and the later library UI (S04/S05) consume.
- Own finding list with its own type, sharing only 011's `error | warning | info` vocabulary — 012
  AC7 counts "repository findings" as a separate number, so they are a separate list.
- Severities: duplicate `id` and a missing document are `error` (the entry is dropped), an unsafe
  name is `error` (the launcher refuses to fetch it), order collision and frontmatter/index `order`
  mismatch are `warning`, draft and unreferenced image are `info` — the same rule 011 uses: a drop is
  an error, an unintended difference a warning, a directory state information.
- The delivered order for AC5 is read out of the mirrored pipeline's resolved feed, never re-sorted
  here — 011 AC8's discipline applies to this story too: it classifies, it does not decide.
- The missing-document finding (AC6, first half) is lifted from story 010's reader finding rather
  than detected a second time, so the two can never disagree about what is missing.
- Duplicate `id` is detected on the reader's raw index rows (first occurrence wins, per README), not
  on pipeline output — the pipeline has already dropped the loser by the time it produces slides.
- Safe-name checks apply the document rule to index `file` values and to every `.md` in `news/`, and
  the image-path rule to declared `image` paths and to every file under `news/img/` — those are
  exactly the two inputs the launcher applies its two rules to.
- The orphan scan covers `news/img/` only: AC3 names that directory, and it is also what keeps
  `news/_templates/*/example.png` and `news/community_welcome/community.png` out of the report (AC7).
- Dependency on story 010: this story declares its own narrow input type (`RepositoryScan`) matching
  010's AC1–AC4 output, so it can be built and tested against fixtures before 010 lands, and is
  wired to the real reader in one place.
- Tests are unit level, no e2e gap: this story has no user surface — the terminal surface is 012
  AC1/AC7 — so the profile's "criteria without a surface are covered by `test`" applies directly.
- Review stays on the default tier: `npm run check:drift` and `typecheck` are automated gates that
  catch exactly the mirror mistake D5 could make, so a second expensive reader adds little.

## Plan

New pure module `studio/src/report/repository-findings.ts` with one entry point
`collectRepositoryFindings(scan): RepositoryFinding[]`, over story 010's reader output plus the
mirrored pipeline's resolved feed. No I/O of its own, no sorting of its own, no writing.

1. **Model first.** `RepositoryFinding { kind, severity, message, file?, id?, detail }` with a
   closed `kind` union — same shape idea as `DriftFinding` in `studio/scripts/drift.ts:18-40`.
   Input type `RepositoryScan` is declared here (index rows, documents, drafts, `news/img/` listing,
   reader findings) and matches 010's AC1–AC4; a `toRepositoryScan()` adapter is the single place
   that touches 010's real reader, so 010 landing later changes one file.
2. **Index lens (D2).** Duplicate `id` → kept row (first in file order) vs discarded rows; order
   collisions → the positions taken from the mirrored pipeline's resolved feed via
   `studio/src/contract/launcher-contract.ts`.
3. **Directory lens (D3).** `.md` in `news/` with no index row → draft (`info`, explicitly not an
   error); file in `news/img/` referenced by no entry's `image` → orphan, with the "the launcher
   never fetches it" note. `news/_templates/` is out by construction (010 AC7 + the `news/img/` scope).
4. **Consistency lens (D4).** Missing document lifted from the reader's finding; frontmatter `order`
   vs index `order` mismatch as a `warning`, naming both values.
5. **Safe-name rule into the mirror (D5).** Extend the mirror set by the eight files that carry the
   rule, re-sync, redirect the one Electron-bound type import to a stub, and expose the three
   exported symbols through a new door `studio/src/contract/launcher-safe-names.ts`. No studio code
   reimplements or copies the rule.
6. **Safe-name findings (D6).** One `unsafe-name` kind behind the same interface as D1–D4, calling
   the door's predicates on index `file` values, `news/` `.md` names, declared `image` paths and
   `news/img/` file names.

Affected files: `studio/src/report/repository-findings.ts`, its colocated test, fixtures under
`studio/tests/fixtures/repository-findings/`; D5 additionally `studio/scripts/launcher-core.manifest.ts`,
`studio/launcher-core.lock.json` (regenerated, never hand-edited), `studio/tsconfig.json`,
`studio/eslint.config.js`, `studio/src/mirror-runtime/harness.ts`,
`studio/src/contract/launcher-safe-names.ts`. Nothing under `news/` is touched — the whole story is
read-only.

Note on parallel work: story 011 is expected to claim `studio/src/report/` as well; the directory is
shared on purpose, the file names are not (`repository-findings.ts` here). Story 012 composes both
lists; this story neither imports nor is imported by 011.

## Deliverables

- **D1 — Finding model and scan adapter.** `RepositoryFinding`/`RepositoryFindingKind`/severity,
  the `RepositoryScan` input type, `collectRepositoryFindings()` returning an empty list, and
  `toRepositoryScan()` against story 010's reader (a documented TODO import if 010 has not landed —
  the type is the contract either way). Mirror the union style of `studio/scripts/drift.ts:18-40`.
  Plus its test in `studio/src/report/repository-findings.test.ts`: the repository's real `news/`
  tree produces no `error` finding.
  Files: `studio/src/report/repository-findings.ts`, `studio/src/report/repository-findings.test.ts`.
- **D2 — Duplicate ids and order collisions (AC1, AC5).** Duplicate `id` names the kept row and each
  discarded one; order collision names the colliding rows and the positions they actually take,
  read from the mirrored pipeline's resolved feed (`studio/src/contract/launcher-contract.ts`),
  not computed here. Plus its tests in `studio/src/report/repository-findings.test.ts`.
  Files: `studio/src/report/repository-findings.ts`, `studio/src/report/repository-findings.test.ts`,
  `studio/tests/fixtures/repository-findings/` (fixture builder).
- **D3 — Drafts and unreferenced images (AC2, AC3, AC7).** `.md` without an index row → `info`
  draft; file in `news/img/` no entry references → `info` orphan carrying the "never fetched" note;
  `news/_templates/` files, example images included, appear in neither. Plus its tests in the same
  test file.
  Files: `studio/src/report/repository-findings.ts`, `studio/src/report/repository-findings.test.ts`,
  `studio/tests/fixtures/repository-findings/`.
- **D4 — Index/document consistency (AC6).** Missing document lifted from the reader's own finding
  into the repository list; frontmatter `order` disagreeing with the row's `order` reported as a
  `warning` naming both values. Plus its tests in the same test file.
  Files: `studio/src/report/repository-findings.ts`, `studio/src/report/repository-findings.test.ts`,
  `studio/tests/fixtures/repository-findings/`.
- **D5 — Mirror the safe-name rule and open a door to it.** No findings yet; this D only makes the
  launcher's own predicates callable from studio code.
  1. Add the eight entries listed in Decisions to `launcherCoreManifest` under a new
    `// Safe names` group, following the existing `entry('src/...')` style of
    `studio/scripts/launcher-core.manifest.ts:25-50`.
  2. Re-sync with `npm run sync:launcher -- --launcher <q2-launcher checkout>` (the launcher's
    declared files must be committed — preflight refuses otherwise). `studio/launcher-core.lock.json`
    is rewritten by the script; do not touch it by hand.
  3. `studio/src/mirror-runtime/harness.ts` declaring only `export type NewsSource` (the three-arm
    union at `news/harness.ts`), plus `./src/launcher-core/src/main/modules/home/news` appended to
    `rootDirs` in `studio/tsconfig.json` — same construction as the `../client` redirect documented
    in that file's comment. Also add `"node"` to `types` there.
  4. `studio/src/contract/launcher-safe-names.ts`: re-export only `isSafeNewsDocumentName`,
    `isSafeDeclaredImagePath`, `SAFE_NEWS_IMAGE_EXTENSIONS`. Re-export-only, no logic — mirror the
    doc-comment and shape of `studio/src/contract/launcher-contract.ts:12-20`. Add it to the
    `no-restricted-imports` `ignores` allowlist in `studio/eslint.config.js:33`.
  Acceptance: `npm run check:drift`, `typecheck`, `lint`, `build` and `test` all green, and no
  `electron` import anywhere under `studio/src/launcher-core/`. Plus its test in
  `studio/src/contract/launcher-safe-names.test.ts`: the door's three symbols exist and classify a
  known-good and a known-bad name.
  Files: `studio/scripts/launcher-core.manifest.ts`, `studio/launcher-core.lock.json`,
  `studio/tsconfig.json`, `studio/eslint.config.js`, `studio/src/mirror-runtime/harness.ts`,
  `studio/src/contract/launcher-safe-names.ts`, `studio/src/contract/launcher-safe-names.test.ts`,
  plus the mirrored files the sync writes under `studio/src/launcher-core/`.
- **D6 — Safe-name findings (AC4).** One `unsafe-name` kind, severity `error`, whose `detail` names
  the broken rule in words (document rule / path-segment rule / extension allowlist) and the
  offending name — never the regex. Applies `isSafeNewsDocumentName()` to index `file` values and to
  every `.md` in `news/`, and `isSafeDeclaredImagePath()` plus the `SAFE_NEWS_IMAGE_EXTENSIONS`
  check to declared `image` paths and every file under `news/img/`. `isSafeNewsImageFileName()` is
  explicitly not used (see Decisions). Imports go through `studio/src/contract/launcher-safe-names.ts`
  only. Plus its tests in the same test file.
  Files: `studio/src/report/repository-findings.ts`, `studio/src/report/repository-findings.test.ts`,
  `studio/tests/fixtures/repository-findings/`.

## Model Hints

- D1 → default
- D2 → default
- D3 → default
- D4 → default
- D5 → deliverable-hard — it changes the mirror set, its lock file, `tsconfig` resolution and the
  ESLint boundary at once, where one wrong entry either drags `electron` into the content repository
  or leaves `check:drift` permanently red.
- D6 → default
- Review: → default — the story is one new pure module, and `check:drift`, `typecheck` and the unit
  suite already gate the only risky part (D5's mirror change).

## Acceptance Tests

All unit level (`npm run test`, vitest) — this story has no user surface, so the profile's rule for
core logic applies; the terminal surface for these findings is story 012's AC1/AC7 and is tested there.
No manual residue.

- AC1 → unit `studio/src/report/repository-findings.test.ts` › "two rows sharing an id name the kept
  row and the discarded one" (D2)
- AC2 → unit `studio/src/report/repository-findings.test.ts` › "an unindexed .md is reported as a
  draft, with info severity and no error" (D3)
- AC3 → unit `studio/src/report/repository-findings.test.ts` › "an image no entry references is
  reported once, noting the launcher never fetches it" (D3)
- AC4 → unit `studio/src/report/repository-findings.test.ts` › "an unsafe file name is reported with
  the rule it breaks, one case per rule" (D6) — covering a `.md` name the document rule refuses, a
  declared `image` path the path-segment rule refuses, and a `news/img/` file with a disallowed
  extension; backed by unit `studio/src/contract/launcher-safe-names.test.ts` › "the safe-name door
  exposes the launcher's own predicates" (D5)
- AC5 → unit `studio/src/report/repository-findings.test.ts` › "two entries sharing an order are
  reported with the positions they end up in" (D2)
- AC6 → unit `studio/src/report/repository-findings.test.ts` › "a row naming a missing document, and
  a frontmatter order disagreeing with its row, are both reported" (D4)
- AC7 → unit `studio/src/report/repository-findings.test.ts` › "news/_templates files and their
  example images are neither drafts nor orphans" (D3)

## Done

<Filled by `/build 013`.>
