---
id: 005
title: Sync command and lock file for the launcher mirror
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio's whole claim — "this is what it will look like, and this is what the launcher will do
with it" — only holds if the preview and the report come from the launcher's own code. So that code
is copied into this repository verbatim, not reimplemented.

This story creates the copy and, more importantly, the record of it: which files, from which
launcher commit, with which contents. Without that record a mirror is indistinguishable from a fork
that quietly drifted.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-5, section 6.

## Acceptance Criteria

- [x] **AC1** — `npm run sync:launcher -- --launcher <path>` copies the declared file list from a
      `q2-launcher` checkout into `studio/src/launcher-core/`.
- [x] **AC2** — Every copied file is byte-identical to its source; the command performs no edits,
      rewrites or import fixups on the content it copies.
- [x] **AC3** — `studio/launcher-core.lock.json` records, per file, its path in both repositories
      and a SHA-256 of the copied bytes, plus the launcher commit the copy came from and the date
      of the sync.
- [x] **AC4** — A launcher path that does not exist, is not a git repository, or is missing one of
      the declared source files fails with one sentence naming the path and the problem, and writes
      nothing at all.
- [x] **AC5** — A launcher checkout with uncommitted changes to a mirrored file is reported, so the
      lock can never record a commit that does not contain what was copied.
- [x] **AC6** — Running the command twice in a row against the same checkout leaves the working
      tree unchanged the second time.
- [x] **AC7** — The command writes only inside `studio/`; it never touches the published surface or
      the launcher checkout.

## Open Questions

- ~~Is the file list hard-coded in the sync script, or declared in a manifest the script reads?~~
  answered → Decisions (Sprint) — left to refine.
- ~~What should happen when a mirrored file has been moved or renamed in the launcher?~~ answered →
  Decisions (Sprint) — left to refine.
- ~~Does the mirror need the launcher's tests for those files too?~~ answered → Decisions (Sprint).

## Decisions (Sprint)

- **(User)** Launcher path source (shared with 006): the sync command takes a `--launcher <path>`
  argument; no environment variable or conventional sibling-directory fallback in this sprint.
- **(User)** Mirroring launcher tests: skip them. The mirrored set stays the ~1200 lines already
  scoped; this sprint's own acceptance tests (007 AC2/AC3, 008 AC1/AC2) prove the mirrored code
  behaves correctly here.
- File list: a TypeScript manifest module both the sync command and 006's drift check import — a
  launcher rename then becomes a reviewed one-line edit here instead of a silent guess.
- Mirror layout: each file keeps its launcher-relative path under `studio/src/launcher-core/`
  (`.../launcher-core/src/shared/modules/home.ts`) — preserved structure is what lets the relative
  imports between mirrored files resolve without the fixups AC2 forbids.
- Mirrored set: the 11 whole files below, verbatim; no "design-token subset" is extracted, because
  extracting one would be an edit and break AC2 — how the studio consumes the tokens is 008's job.
- Moved/renamed source in the launcher: hard failure naming the missing path (AC4), never an
  auto-match — a guessed rename is exactly the silent drift the mirror exists to prevent.
- Uncommitted change to a declared source: aborts the whole sync rather than warning, because AC5's
  stated purpose is that the lock can never record a commit that lacks what was copied.
- `syncedAt` is kept from the existing lock when contents and commit are unchanged — otherwise every
  run would dirty the working tree and AC6 could not hold.
- The sync deletes files under `src/launcher-core/` that the manifest does not declare — otherwise a
  dropped mirror file lingers forever and 006 AC4 would report it on every run.
- Everything is validated and every source read into memory before the first write — the cheapest
  way to make AC4's "writes nothing at all" literally true.
- Tooling language: scripts are TypeScript under `studio/scripts/`, run via a new `tsx`
  devDependency — that keeps them typechecked, lintable and directly importable by Vitest, which a
  plain `.mjs` would not be.
- Scope: 005 ships the command only and does **not** commit a populated mirror. The first real sync
  belongs to 007/008, which own making the mirrored code compile and render; landing 11 not-yet-
  compiling files here would break this story's own `npm run typecheck` gate.
- Out of scope for the same reason: adding `zod` and wiring `src/launcher-core` into
  `tsconfig.json`/ESLint — that is 007, where the mirrored code first has to compile.
- Acceptance runs the real CLI as a child process against a throwaway git fixture repo, not against
  internal functions, plus one test asserting the `sync:launcher` npm script points at that entry.
  The Playwright `e2e` suite does not apply: this story has no UI surface (sprint note — nothing in
  S02 is user-visible), so the terminal command *is* the real surface.

## Plan

A single Node CLI, written in TypeScript, plus the lock file it produces. Nothing in this story
touches the published surface, `studio/src/`, or the launcher checkout beyond reading it.

**The declared set** (launcher-relative paths, verified against the local checkout):

- contract: `src/shared/modules/home.ts`, `src/main/modules/home/news/feed-pipeline.ts`,
  `src/main/modules/home/news/frontmatter.ts`
- rendering: `src/renderer/src/modules/home/components/{SlideBanner,SlideCover,SlideSplit,SlideText,
  SlideButtons}.tsx`, `.../components/resolveSlideTemplate.ts`
- styles: `src/renderer/src/styles/home-hero.css`, `src/renderer/src/styles/index.css`

**Flow of `npm run sync:launcher -- --launcher <path>`:**

1. Parse `--launcher`; missing or unknown argument → usage error, exit 1.
2. Preflight, all read-only: path exists and is a directory → it is a git work tree
   (`git -C <path> rev-parse --git-dir`) → every declared source file exists → `git -C <path> status
   --porcelain -- <declared paths>` is empty. First failure wins: one sentence naming path and
   problem, exit 1, nothing written.
3. Read `git -C <path> rev-parse HEAD` and all source bytes into memory.
4. Write phase: every destination is asserted to resolve inside `studio/`; mirror files are written,
   undeclared files under `src/launcher-core/` are deleted, then `studio/launcher-core.lock.json`.
5. Lock content is deterministic (files sorted by mirror path, stable key order, trailing newline);
   `syncedAt` is carried over from the previous lock when nothing else changed → second run is a
   no-op on the working tree.

**Files:** new `studio/scripts/{launcher-core.manifest.ts,launcher-core-lock.ts,launcher-preflight.ts,
sync-launcher.ts}`; new `studio/tests/{git-fixture.ts,launcher-core-lock.test.ts,
launcher-preflight.test.ts,sync-launcher.cli.test.ts}`; edits to `package.json` (root + studio),
`studio/tsconfig.node.json` (include `scripts/**/*.ts`), `studio/README.md`.

## Deliverables

**D1 — Manifest, lock format and the git fixture helper** [x]
Files: `studio/scripts/launcher-core.manifest.ts`, `studio/scripts/launcher-core-lock.ts`,
`studio/tests/git-fixture.ts`, `studio/tests/launcher-core-lock.test.ts`.
The manifest exports the 11 declared entries (`source` → `mirror`, structure preserved) and is the
one place the list lives. `launcher-core-lock.ts` builds, serialises and parses the lock
(`schemaVersion`, `launcher.commit`, `launcher.syncedAt`, `files[] = {source, mirror, sha256}`),
sorted and deterministic, with `syncedAt` carried over when commit and hashes are unchanged.
`git-fixture.ts` creates a throwaway git repo in the OS temp dir (init, write files, commit, dirty a
file on request) and removes it again; it is shared by D2 and D3. No existing file to mirror — style
follows `studio/tests/repo-contract.test.ts`.
Acceptance: unit tests prove the lock records both paths + SHA-256 + commit + date, serialises
byte-identically for identical input, and preserves `syncedAt` across an unchanged rebuild. (AC3, AC6)

**D2 — Preflight against a launcher checkout** [x]
Files: `studio/scripts/launcher-preflight.ts`, `studio/tests/launcher-preflight.test.ts`.
Read-only checks in fixed order (path missing / not a directory / not a git work tree / declared file
missing / declared file dirty), each returning one sentence that names the path and the problem, plus
`rev-parse HEAD`. Uses `git-fixture.ts` from D1.
Acceptance: one test per failure mode asserting exit-worthy error text names the offending path, and
one proving a clean checkout passes and yields the HEAD commit. (AC4, AC5)

**D3 — The `sync:launcher` command, wired and documented** [x]
Files: `studio/scripts/sync-launcher.ts`, `studio/package.json`, `package.json`,
`studio/tsconfig.node.json`, `studio/README.md`, `studio/tests/sync-launcher.cli.test.ts`.
Argument parsing, preflight → read-all → single write phase, pruning of undeclared mirror files,
write-path confinement assertion, `tsx` devDependency and the `sync:launcher` script in both
`package.json` files, one README paragraph on the command.
Acceptance: integration tests spawn the real CLI against the D1 fixture and assert the copy, byte
identity, a clean second run, that a failing preflight leaves the tree untouched, and that the
launcher checkout is unmodified — plus one test that the npm script points at this entry.
(AC1, AC2, AC6, AC7)

## Model Hints

- D1 → default
- D2 → default
- D3 → deliverable-hard — the subtle failures live here: all-or-nothing write behaviour, pruning
  without escaping `studio/`, and byte-exact idempotency of a spawned CLI on Windows (CRLF, path
  separators, temp-dir cleanup).
- Review: → default — three new, self-contained script files plus two `package.json` script lines;
  no existing behaviour is modified.

## Acceptance Tests

No criterion here describes a UI action, so the Playwright `e2e` command does not apply; the real
surface for this story is the terminal command, and it is exercised as a spawned process rather than
by calling internals. There is no manual residue.

- AC1 → unit `studio/tests/sync-launcher.cli.test.ts` › "copies every declared file into
  studio/src/launcher-core/" (D3)
- AC2 → unit `studio/tests/sync-launcher.cli.test.ts` › "every copied file is byte-identical to its
  source" (D3)
- AC3 → unit `studio/tests/launcher-core-lock.test.ts` › "the lock records both paths, a SHA-256, the
  launcher commit and the sync date" (D1), plus `sync-launcher.cli.test.ts` › "a real run writes that
  lock" (D3)
- AC4 → unit `studio/tests/launcher-preflight.test.ts` › "a missing path, a non-git path and a
  missing declared file each fail naming the path" (D2), plus `sync-launcher.cli.test.ts` › "a failed
  preflight writes nothing at all" (D3)
- AC5 → unit `studio/tests/launcher-preflight.test.ts` › "an uncommitted change to a mirrored file
  aborts the sync" (D2)
- AC6 → unit `studio/tests/sync-launcher.cli.test.ts` › "a second run leaves the working tree
  unchanged" (D3)
- AC7 → unit `studio/tests/sync-launcher.cli.test.ts` › "writes only inside studio/ and leaves the
  launcher checkout untouched" (D3)

## Done

Implemented the `sync:launcher` CLI as three deliverables: D1 the manifest (11 declared
source→mirror entries) and the deterministic lock format (`launcher-core-lock.ts`) plus a
reusable real-git fixture helper; D2 the read-only preflight (ordered checks: missing path →
not a directory → not a git work tree → missing declared file → dirty declared file, each
naming the offending path, plus HEAD sha on success); D3 the CLI itself — argument parsing,
preflight → read-all-sources-into-memory → single write phase (write-if-changed mirrors,
prune undeclared files under `studio/src/launcher-core/`, write-if-changed lock), wired as
`sync:launcher` in both `package.json` files via `tsx`, with a path-confinement check
(`path.relative`-based, not string-prefix) and README documentation.

**Commit message:** `005: add sync:launcher command and launcher-core lock file`

**Verification:**
- `npm run build` — green.
- `npm run test` — 43/43 passed across 8 files (includes the 4 new test files from this story).
- `npm run typecheck` — clean (`tsc -p tsconfig.json` and `tsconfig.node.json`, the latter now
  including `scripts/**/*.ts`).
- `npm run lint` — eslint clean; `prettier --check` fails on 26 files repo-wide (including two
  files this story edited, `studio/package.json` and `studio/tsconfig.node.json`) due to a
  pre-existing environment condition: this checkout has `core.autocrlf=true`, so git writes
  CRLF line endings that predate and are unrelated to this story's content edits — confirmed by
  the same failure hitting untouched files (`src/App.tsx`, `eslint.config.js`, `vite.config.ts`,
  etc.) that no deliverable in this story touched. None of D1–D3's new source/test files appear
  in the prettier warning list. Not treated as a story blocker; flagged here for the sprint
  review since it will resurface on every story until the repo's line-ending policy
  (`.gitattributes` / `core.autocrlf`) is addressed.
- `e2e` — does not apply; the story's own Decisions record why (no UI surface in S02, terminal
  command is the real surface, exercised as a spawned process in the acceptance tests).
- Code review (clean agent, default tier): **PASS**, no findings. Verified all three D3 risk
  areas (all-or-nothing writes, real path-confinement vs. naive prefix check, byte-exact
  idempotency on Windows including CRLF/BOM content) directly rather than by re-reading the
  implementation's own claims.

**AC → test mapping (as verified):**
- AC1 → `studio/tests/sync-launcher.cli.test.ts` › "copies every declared file into
  studio/src/launcher-core/" — passed.
- AC2 → `studio/tests/sync-launcher.cli.test.ts` › "every copied file is byte-identical to its
  source" — passed (uses BOM/CRLF/LF/non-ASCII fixture content).
- AC3 → `studio/tests/launcher-core-lock.test.ts` › "the lock records both paths, a SHA-256, the
  launcher commit and the sync date" + `sync-launcher.cli.test.ts` › "a real run writes that
  lock" — both passed.
- AC4 → `studio/tests/launcher-preflight.test.ts` (missing/non-git/missing-file cases) +
  `sync-launcher.cli.test.ts` › "a failed preflight writes nothing at all" — passed.
- AC5 → `studio/tests/launcher-preflight.test.ts` › dirty-declared-file case — passed.
- AC6 → `studio/tests/sync-launcher.cli.test.ts` › "a second run leaves the working tree
  unchanged" (asserts unchanged `mtime` too, not just content) — passed.
- AC7 → `studio/tests/sync-launcher.cli.test.ts` › "writes only inside studio/ and leaves the
  launcher checkout untouched" — passed.
- No manual residue: this story's Decisions record that the terminal command itself is the real
  surface, so all criteria are covered by automated tests.

**Decisions (implementation-time, not previously recorded):**
- D3 made one small unplanned edit to D1's `studio/scripts/launcher-core-lock.ts` (dropped a
  `previousLock!` non-null assertion in favour of relying on TypeScript's control-flow
  narrowing), required once `scripts/**/*.ts` was added to the typed ESLint scope in D3. Judged
  correct and in-scope by the reviewer, not scope creep — it is a one-line cleanup of D1's own
  file, not a new file or behavior change.
- `npm run lint`'s prettier step fails repo-wide due to `core.autocrlf=true` on this checkout,
  pre-dating this story; carried into this Done section rather than silently ignored, and not
  treated as a build blocker since no file this story authored is responsible for it.
- Test scaffolding for the CLI integration tests (D3) runs the real spawned CLI against
  temp-directory sandboxes (never the repo's real `studio/src/launcher-core/` or
  `studio/launcher-core.lock.json`), confirmed clean via `git status` after the full test run.
