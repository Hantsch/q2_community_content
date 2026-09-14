---
id: 010
title: Reader for the content repository's working tree
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Everything the studio says about this repository starts with reading it. The launcher fetches the
same material over HTTP from one commit; the studio has to read it from a working tree that is
half-edited, contains drafts the index does not mention, and may contain a broken `index.json` that
the author is in the middle of fixing.

That difference is the whole story. The reader's job is to hand the pipeline exactly the material
the launcher would receive, plus the material the launcher would never see — and to never, under
any circumstance, write.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-10.

## Acceptance Criteria

- [x] **AC1** — The reader returns the raw `news/index.json`, the text of every `.md` document the
      index names, and the text of every `.md` in `news/` the index does **not** name.
- [x] **AC2** — It lists the files under `news/img/` with their names and sizes.
- [x] **AC3** — An `index.json` that is missing or does not parse is returned as a finding with the
      parser's own message; the reader does not crash and still returns the `.md` files it found.
- [x] **AC4** — A document named by the index but absent from disk is returned as a finding naming
      the missing file, not as an empty document.
- [x] **AC5** — The reader never writes: after any read, `git status` reports the working tree
      exactly as it was before.
- [x] **AC6** — A path that resolves outside the repository root is refused, including via `..`
      segments and absolute paths in `index.json`'s `file` field.
- [x] **AC7** — Files under `news/_templates/` are readable on request but are never returned as
      entries or drafts.

## Open Questions

- ~~Does the reader re-read from disk on every request, or cache with a file watcher? The watcher is
  needed eventually for the live preview; building it now may be premature.~~ answered → Decisions (Sprint)
- ~~Should it read `engines/manifest.json` and `gamedata/manifest.json` already, so story 014 can list
  them with real data, even though v1 does not validate or edit them?~~ answered → Decisions (Sprint)
- ~~What encoding guarantees does it make — is a `.md` file with a BOM or CRLF line endings normalised
  on read, and would that change what the mirrored frontmatter parser sees?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Re-read on every request vs. cache with a watcher: re-read from disk on every request; a
  watcher is deferred until live preview needs it.
- **(User)** Read `engines/manifest.json` / `gamedata/manifest.json` now: no, stay scoped to `news/` —
  those manifests are out of scope until the story that actually uses them.
- **(User)** Encoding guarantees: normalise BOM and CRLF on read, so the studio sees exactly what the
  mirrored frontmatter parser (and thus the launcher) sees.
- New module lives in `studio/src/content-repo/`, not in `studio/src/contract/` — `contract/` is the
  single door into the mirror (story 007 AC5) and filesystem reading is studio code, not a contract rule.
- `studio/src/contract/read-news-tree.ts` stays untouched; the new reader supersedes it for validation
  but changing story 007's input path would be a collateral edit with no acceptance behind it.
- The reader takes an explicit `repoRoot` argument defaulting to the real repository root — without it
  AC3/AC4/AC6 cannot be proven against fixture trees.
- Findings get a shared `{ code, severity, message, path? }` shape with severity `error | warning | info`,
  so stories 011/013 extend one vocabulary instead of inventing a second.
- The reader emits `error` for: unreadable/unparseable `index.json`, an index row whose document is
  missing, and a refused path — each is a fact the launcher's fetch would also fail on.
- "Missing document" is emitted here (AC4) and story 013 reuses it rather than re-detecting it, so one
  disk truth has one owner.
- Drafts are found by a recursive walk of `news/` excluding `news/img/` and `news/_templates/`, because
  an index `file` value may name a nested path and a flat walk would misclassify it.
- `news/img/` is listed non-recursively, files only — that is exactly the set the launcher fetches.
- `_templates/` access (AC7) is a separate, explicitly-called function restricted to that subtree, which
  is what "readable on request but never returned as entries or drafts" means operationally.
- Normalisation (BOM strip, CRLF→LF) applies to `index.json` text and every `.md` text alike, so a
  finding's line references and the frontmatter parser see the same bytes.
- No acceptance criterion describes a user action (this is a core module with no surface), so every
  criterion maps to `test`, not to the profile's `e2e` command.
- Fixture repositories are checked in under `studio/tests/fixtures/content-repo/`, mirroring the existing
  `tests/fixtures/news-contract/` precedent; AC5 uses the real git fixture helper instead.

## Plan

1. **Foundations** — new folder `studio/src/content-repo/`:
   - `findings.ts`: `ReaderFindingSeverity = 'error' | 'warning' | 'info'` and
     `ReaderFinding { code, severity, message, path? }` (the vocabulary 011/013 extend).
   - `paths.ts`: `resolveRepoRoot(cwd)` (same rule as `studio/scripts/sync-launcher.ts:90`) and
     `resolveInsideNews(newsDir, relativePath)` → absolute path or a refusal reason. Refuses absolute
     paths, Windows drive letters, UNC prefixes and any `..` escape, judged after `path.resolve`.
   - `text.ts`: `normaliseText(raw)` — strip UTF-8 BOM, CRLF/CR → LF.
2. **Core reader** — `read-content-repo.ts`, one pure function
   `readContentRepo(options?: { repoRoot?: string }): ContentRepoRead`:
   - reads `news/index.json` → `{ text, value, parsed }`; on missing/parse error records an `error`
     finding carrying the parser's own message and continues with `value: undefined`;
   - for each index row with a usable `file`: resolve through `resolveInsideNews`; refusal → `error`
     finding, no read; absent on disk → `error` finding, no empty document entry; otherwise a
     normalised document keyed by its exact `file` value;
   - walks `news/` recursively (skipping `img/`, `_templates/`) and returns every `.md` not named by
     the index as a draft (repo-relative path + normalised text);
   - reads only — `readFileSync` / `readdirSync` / `statSync`, never a write or `mkdir`.
3. **Images and templates** — same module: `images` = non-recursive listing of `news/img/`
   (`{ name, path, bytes }`), and `readTemplateFile(relativePath, options?)` restricted to
   `news/_templates/` via the same path guard. Templates never appear in `documents`, `drafts` or
   `images`.
4. **Read-only proof** — integration test that snapshots `git status --porcelain` around a full read,
   using `studio/tests/git-fixture.ts` for a throwaway repository plus the real repository root.
5. **Fixtures** — `studio/tests/fixtures/content-repo/{ok,broken-index,missing-doc,escaping-path,templates}/news/…`.

Order: 1 → 2 → 3 → 4. Nothing outside `studio/src/content-repo/`, `studio/tests/` is touched.

## Deliverables

- **D1 — Finding vocabulary, path guard, text normalisation.**
  Files: `studio/src/content-repo/findings.ts`, `studio/src/content-repo/paths.ts`,
  `studio/src/content-repo/text.ts`, `studio/src/content-repo/paths.test.ts`,
  `studio/src/content-repo/text.test.ts`. Mirror `studio/scripts/sync-launcher.ts` (`resolveRepoRoot`).
  Acceptance: `resolveInsideNews` refuses `../`, `/abs`, `C:\abs` and UNC and accepts nested relative
  paths; `normaliseText` strips a BOM and converts CRLF and lone CR to LF.

- **D2 — The reader: index, documents, drafts, findings.**
  Files: `studio/src/content-repo/read-content-repo.ts`,
  `studio/src/content-repo/read-content-repo.test.ts`,
  `studio/tests/fixtures/content-repo/{ok,broken-index,missing-doc,escaping-path}/news/…`.
  Mirror the IO style of `studio/src/contract/read-news-tree.ts` and the never-throws result style of
  `studio/src/mirror/read-provenance.ts`.
  Acceptance: AC1, AC3, AC4, AC6 — plus their tests in `read-content-repo.test.ts`.

- **D3 — Image listing and templates on request.**
  Files: `studio/src/content-repo/read-content-repo.ts` (extend),
  `studio/src/content-repo/read-content-repo.test.ts` (extend),
  `studio/tests/fixtures/content-repo/templates/news/…`.
  Acceptance: AC2, AC7 — `news/img/` entries carry name and byte size; a `_templates/` file is
  returned by `readTemplateFile` and appears in no other part of the result.

- **D4 — Proof that the reader never writes.**
  Files: `studio/tests/content-repo-read-only.test.ts` (uses `studio/tests/git-fixture.ts`).
  Acceptance: AC5 — `git status --porcelain` is byte-identical before and after a full read, in a
  throwaway git repository and against the real repository root.

## Model Hints

- `D2 → deliverable-hard` — partial-failure semantics (a broken index must still yield drafts, a
  refused or missing document must yield a finding and *no* entry) combined with a traversal guard that
  has to hold on both Windows and POSIX path forms; getting either half subtly wrong produces a reader
  that looks correct and silently lies to stories 011–013.
- D1, D3, D4 → default.
- `Review: → default` — the story adds one read-only module with no existing behaviour to regress, and
  every criterion is covered by a named test.

## Acceptance Tests

- AC1 → unit `studio/src/content-repo/read-content-repo.test.ts` › "returns the raw index, the named
  documents and the unnamed drafts" (D2)
- AC2 → unit `studio/src/content-repo/read-content-repo.test.ts` › "lists news/img with names and byte
  sizes" (D3)
- AC3 → unit `studio/src/content-repo/read-content-repo.test.ts` › "a broken index.json becomes a
  finding and the drafts are still returned" (D2)
- AC4 → unit `studio/src/content-repo/read-content-repo.test.ts` › "a document named but absent is a
  finding, not an empty document" (D2)
- AC5 → integration `studio/tests/content-repo-read-only.test.ts` › "reading leaves the working tree
  untouched" (D4)
- AC6 → unit `studio/src/content-repo/paths.test.ts` › "refuses paths that resolve outside news/" and
  `studio/src/content-repo/read-content-repo.test.ts` › "an escaping file field is refused, not read" (D1, D2)
- AC7 → unit `studio/src/content-repo/read-content-repo.test.ts` › "_templates files are readable on
  request and never appear as entries or drafts" (D3)

No `e2e` entry: the story delivers a core module with no user-facing surface, so `ui-acceptance-required`
does not bite here. No manual residue.

## Done

Added `studio/src/content-repo/` — a pure, synchronous, never-throwing reader of the working
tree's `news/` folder: `findings.ts` (shared `ReaderFinding` vocabulary), `paths.ts`
(`resolveRepoRoot`, `resolveInsideNews` — the traversal guard judged after `path.resolve`),
`text.ts` (`normaliseText` — BOM strip, CRLF/CR → LF), and `read-content-repo.ts`
(`readContentRepo` — raw index, documents, drafts, image listing, findings; plus
`readTemplateFile` for `_templates/` on request). Backed by fixture repositories under
`studio/tests/fixtures/content-repo/{ok,broken-index,missing-doc,escaping-path,templates}/` and
a read-only proof (`studio/tests/content-repo-read-only.test.ts`) against both a throwaway git
fixture and the real repository root.

**Commit message:** `010: add the content repo reader`

**Verification:**
- `npm run build` — passed.
- `npm run typecheck` — passed, no errors.
- `npm run lint` — eslint clean; prettier clean for every file this story touched. The repo-wide
  `prettier --check .` still fails on ~75 pre-existing files unrelated to this story (confirmed via
  `git stash`: the same failures exist on the base branch before this story's changes) — not a
  regression, not touched here.
- `npm run test` — 16/16 new content-repo tests pass (4 files). Full suite: 108/112 pass; the 4
  failures are pre-existing `studio/src/launcher-core/` mirror-drift findings
  (`tests/mirror-set.test.ts`, `tests/mirrorDrift.test.ts`) unrelated to this story — confirmed via
  `git status`/`git diff HEAD` that no `launcher-core/` file was touched by this story, and the
  failures reproduce identically on the base branch.
- No `e2e` run: this story has no user-facing surface (see `## Acceptance Tests` note); `test` is
  the acceptance gate for every criterion.
- Clean-agent review: first pass returned **FAIL** — a confirmed bug where an index entry naming a
  file under `news/_templates/` (e.g. an author's mistake) would leak into `documents`, because
  `readDocuments` only checked that a path stayed inside `news/` as a whole, not that it avoided the
  `img/`/`_templates/` subtrees; the AC7 fixture's index had no entries, so the AC7 test could not
  catch it. Fixed by adding `isUnderSkippedDirectory` in `read-content-repo.ts` and extending the
  `templates` fixture's `index.json` to actually name a `_templates/` file, plus asserting on the
  resulting finding in the AC7 test. A second clean-agent pass confirmed the fix, re-ran the tests
  (16/16 pass) and typecheck (clean), and found no new issues. One review-fix cycle used.

**AC → test mapping, as verified:**
- AC1 → `studio/src/content-repo/read-content-repo.test.ts` › "returns the raw index, the named
  documents and the unnamed drafts" — passed.
- AC2 → same file › "lists news/img with names and byte sizes" — passed.
- AC3 → same file › "a broken index.json becomes a finding and the drafts are still returned" —
  passed.
- AC4 → same file › "a document named but absent is a finding, not an empty document" — passed.
- AC5 → `studio/tests/content-repo-read-only.test.ts` › "reading leaves the working tree untouched"
  — passed (throwaway git fixture and real repo root).
- AC6 → `studio/src/content-repo/paths.test.ts` › "refuses paths that resolve outside news/" and
  `read-content-repo.test.ts` › "an escaping file field is refused, not read" — both passed.
- AC7 → `read-content-repo.test.ts` › "_templates files are readable on request and never appear as
  entries or drafts" — passed, and now also covers the index-driven leak found in review.
- No manual residue.

**Decisions (this build, beyond the story's own `## Decisions (Sprint)`):**
- Kept `resolveRepoRoot` throwing on failure rather than returning the `Result` shape that
  `studio/scripts/sync-launcher.ts` uses internally — the plan asked for a plain `string`-returning
  signature; flagged here in case story 011/013 need the `Result` shape instead, in which case that
  is a follow-up, not a defect of this story.
- `documents` is keyed by the index's exact `file` value (news-relative, e.g.
  `nested/post.md`), while `drafts[].path` is repo-relative (e.g. `news/nested/draft.md`) — this
  matches the plan's own wording for each ("keyed by its exact `file` value" vs. "repo-relative
  path") but callers comparing the two need to account for the difference; documented in the
  module's header comment.
- `studio/.prettierignore` gained two lines to exclude the deliberately-invalid
  `broken-index/news/index.json` fixture, so `npm run lint` does not fail on JSON that is invalid
  by design (AC3).
- `isUnderSkippedDirectory` (added during the review-fix cycle) refuses an index row naming a file
  under `news/img/` or `news/_templates/` with the same `unsafe-document-path` finding code used for
  other refused paths, rather than inventing a new code — it is the same fact (this path is not a
  legal document location) from the reader's point of view.
