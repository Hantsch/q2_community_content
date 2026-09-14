---
id: 006
title: Drift check for the launcher mirror
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A mirror that silently falls behind is worse than no mirror: the preview keeps looking
authoritative while showing a layout the launcher no longer has, and the validation report keeps
stating rules that have since changed. The failure is invisible precisely when it matters.

Two different people need two different answers from this check. Whoever has a launcher checkout
needs to know whether the mirror still matches it. A community contributor, who has no launcher
checkout at all, needs the check to not fail for a reason they cannot act on — but still to catch a
locally edited mirror file.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-6, section 6.

## Acceptance Criteria

- [x] **AC1** — `npm run check:drift` recomputes every hash in `studio/launcher-core.lock.json`
      against the files on disk and fails when a mirrored file was edited locally, naming each file.
- [x] **AC2** — With a launcher checkout available, the check additionally compares each mirrored
      file against the launcher's current source and fails on any difference, naming the file's path
      in both repositories.
- [x] **AC3** — With no launcher checkout on the machine, the check prints one skip line explaining
      what was not compared, runs AC1 regardless, and exits 0.
- [x] **AC4** — A mirrored file present on disk but absent from the lock — and the reverse — is
      reported; neither passes silently.
- [x] **AC5** — The check is read-only in both repositories.
- [x] **AC6** — The failure output says what to do about it (re-sync, or move the change into the
      launcher), not just that hashes differ.

## Open Questions

- ~~Where does the launcher path come from?~~ answered → Decisions (Sprint).
- ~~Is a stale mirror (launcher ahead, nothing edited) a hard failure or a warning?~~ answered →
  Decisions (Sprint).
- ~~Should this check run as part of `npm run lint`/`npm run test`, or stay standalone?~~ answered →
  Decisions (Sprint).

## Decisions (Sprint)

- **(User)** Launcher path source (shared with 005): a `--launcher <path>` argument, same as the
  sync command.
- **(User)** Stale mirror (launcher ahead, mirror unedited): hard failure. A stale mirror is exactly
  the silent-drift failure mode this sprint exists to catch.
- **(User)** Wiring: `check:drift` stays a standalone command in this sprint; it is not wired into
  `npm run lint` or `npm run test`.
- Script layout: a thin CLI `studio/scripts/check-drift.mjs` over a pure module
  `studio/scripts/lib/drift.mjs` — the launcher's own tooling is `scripts/*.mjs`, and splitting the
  logic out is what makes it unit-testable here and reusable by 009.
- Precedence of 005: if 005's sync command has already established a different script location or
  shared helpers for the file manifest, hashing and lock parsing, 006 follows and reuses them —
  005 builds first and a second copy of that knowledge is a second source of truth.
- Command wiring: `check:drift` is a script in `studio/package.json`, delegated from the root
  `package.json` like every other verify command, so `npm run check:drift -- --launcher <path>`
  works from the repository root.
- Typecheck coverage: `studio/tsconfig.node.json` gains `allowJs`/`checkJs` and the scripts glob so
  the tooling stays inside `npm run typecheck` instead of becoming an untyped corner.
- Argument semantics: no `--launcher` is the AC3 skip path (exit 0); a `--launcher` that is given
  but missing or not a git repository is a hard failure — the user asserted a checkout exists,
  which is exactly 005 AC4's stance.
- Exit codes are 0 and 1 only; no acceptance criterion distinguishes failure kinds and the findings
  text carries the detail.
- Verdict per file comes from a three-way comparison (lock hash vs file on disk vs launcher
  source): only the lock hash tells a locally edited file apart from a launcher that moved ahead,
  and AC6 needs a different remedy for each.
- A missing or unparseable `launcher-core.lock.json` fails with exit 1: without the lock nothing
  can be proven, and passing quietly is the drift this story exists to catch (009 turns the same
  state into "provenance unknown").
- Read-only (AC5) is proven by assertion, not by a flag: the tests hash both trees before and after
  the run and require `git status --porcelain` in the fixture launcher to stay empty.
- The acceptance path is the real CLI, spawned as a process — this story has no browser surface and
  the studio's Playwright harness is a Chromium suite that could only fake the command, not prove it.
- Test fixtures are synthetic temp repositories (a fake mirror, a fake launcher checkout created
  with `git init`): the check has to be provable on a machine with no `q2-launcher` checkout, which
  is AC3's whole point.
- The core returns a structured report (lock metadata, per-file verdicts, overall status) rather
  than printing — 009 AC1/AC3 need exactly that data, and producing it here avoids a second walk.

## Plan

1. **Core module** `studio/scripts/lib/drift.mjs` — `checkDrift({ repoRoot, launcherPath })` returns
   `{ ok, skippedLauncherCompare, lock: { commit, syncedAt, fileCount }, findings[] }`. It reads
   `studio/launcher-core.lock.json`, re-hashes every listed file under `studio/src/launcher-core/`
   (SHA-256, raw bytes), walks that directory for files the lock does not list, and reports lock
   entries with no file on disk. No printing, no writes.
2. **Launcher comparison** in the same module: when `launcherPath` is given, validate it (exists,
   is a git repo, mirrored sources present), hash each launcher source and classify per file —
   `clean`, `locally-edited` (disk ≠ lock), `stale` (disk = lock ≠ launcher), `missing`, `orphan`.
   Without a path, set `skippedLauncherCompare` and keep the integrity findings.
3. **CLI** `studio/scripts/check-drift.mjs` — parses `--launcher <path>`, prints one line per
   finding with its remedy (stale → `npm run sync:launcher -- --launcher <path>`; locally edited →
   move the change into `q2-launcher` and re-sync, per `CLAUDE.md`), prints the skip line in the
   no-checkout case, exits 0/1. Wire `check:drift` into `studio/package.json` and `package.json`,
   document it in `studio/README.md`.

Affected files: `studio/scripts/lib/drift.mjs`, `studio/scripts/check-drift.mjs`,
`studio/package.json`, `package.json`, `studio/tsconfig.node.json`, `studio/README.md`,
`studio/tests/drift-core.test.ts`, `studio/tests/drift-launcher.test.ts`,
`studio/tests/check-drift-cli.test.ts`. Order: D1 → D2 → D3. Depends on story 005 for the lock
file's shape and the mirrored file manifest; nothing here writes to either repository.

## Deliverables

- [x] **D1 — Mirror integrity core.** `studio/scripts/lib/drift.mjs` with `checkDrift()` covering lock
  parsing, re-hashing, on-disk-but-not-in-lock, in-lock-but-not-on-disk and the missing/unparseable
  lock case; `studio/tsconfig.node.json` extended so the module is typechecked. Plus its test in
  `studio/tests/drift-core.test.ts` (temp-dir fixture mirror, no launcher path).
  *Acceptance:* every AC1/AC4 case returns a finding naming the file; a clean fixture returns
  `ok: true`. Mirror the fixture/temp-dir style of `studio/tests/boundary.test.ts`.
  Files: `studio/scripts/lib/drift.mjs`, `studio/tsconfig.node.json`, `studio/tests/drift-core.test.ts`.

- [x] **D2 — Launcher comparison and skip path.** Extend `drift.mjs` with launcher-path validation, the
  three-way classification (`stale` vs `locally-edited`) and the `skippedLauncherCompare` branch.
  Plus its test in `studio/tests/drift-launcher.test.ts` using a synthetic `git init` launcher
  checkout.
  *Acceptance:* a launcher-ahead file is `stale` and fails; a locally edited file is
  `locally-edited`; both are named with their path in both repositories; without a path the run is
  `ok: true` with the skip flag set; before/after hashes of both trees are identical and the fixture
  launcher's `git status --porcelain` stays empty.
  Files: `studio/scripts/lib/drift.mjs`, `studio/tests/drift-launcher.test.ts`.

- [x] **D3 — CLI, wording and wiring.** `studio/scripts/check-drift.mjs`, the `check:drift` scripts in
  `studio/package.json` and root `package.json`, a short section in `studio/README.md`. Output:
  one line per finding with its remedy, one skip line, a final summary. Plus its test in
  `studio/tests/check-drift-cli.test.ts`, which spawns the command against the fixtures.
  *Acceptance:* `npm run check:drift` exits 0 on a clean mirror with no `--launcher` and prints the
  skip line; exits 1 with the remedy sentence on an edited and on a stale mirror; `npm run lint`
  and `npm run typecheck` stay green.
  Files: `studio/scripts/check-drift.mjs`, `studio/package.json`, `package.json`,
  `studio/README.md`, `studio/tests/check-drift-cli.test.ts`.

## Model Hints

- D1 → default
- D2 → **deliverable-hard** — the three-way comparison (lock vs disk vs launcher) is the subtle
  part: mis-classifying a stale file as locally edited hands the contributor the wrong remedy, and
  the same code must touch neither checkout while reading a foreign git repository.
- D3 → default
- Review: → default — tooling only, no user-facing surface, and every criterion is covered by a
  test that runs the real command.

## Acceptance Tests

- AC1 → unit `studio/tests/drift-core.test.ts` › "a locally edited mirrored file is reported by
  name" (D1), plus CLI `studio/tests/check-drift-cli.test.ts` › "check:drift exits 1 and names the
  edited file" (D3)
- AC2 → unit `studio/tests/drift-launcher.test.ts` › "a launcher that moved ahead fails the check,
  naming the path in both repositories" (D2)
- AC3 → CLI `studio/tests/check-drift-cli.test.ts` › "without --launcher the check prints one skip
  line, still verifies the mirror and exits 0" (D3)
- AC4 → unit `studio/tests/drift-core.test.ts` › "a file on disk that the lock does not list, and a
  lock entry with no file, are both reported" (D1)
- AC5 → unit `studio/tests/drift-launcher.test.ts` › "the check writes to neither repository"
  (before/after hashes of both trees plus `git status --porcelain` on the fixture launcher) (D2)
- AC6 → CLI `studio/tests/check-drift-cli.test.ts` › "a stale mirror says re-sync, a locally edited
  one says move the change into the launcher" (D3)

No manual residue. `ui-acceptance-required` is satisfied through the real surface this story has —
the spawned CLI; the repository's Playwright `e2e` suite is a browser harness and is not applicable
to a command-line story.

Test files as actually written (unchanged from the plan above, all in `studio/tests/`):
`drift-core.test.ts`, `drift-launcher.test.ts`, `check-drift-cli.test.ts`.

## Done

Implemented the drift check for the `studio/src/launcher-core/` mirror: a pure core
(`studio/scripts/drift.ts`) that re-hashes every mirrored file against
`studio/launcher-core.lock.json`, optionally three-way-compares against a real launcher checkout,
and a thin CLI (`studio/scripts/check-drift.ts`, wired as `check:drift` in both `package.json`
files) that prints one line per finding with a remedy and exits 0/1. Followed story 005's actual
shape (flat `.ts` under `studio/scripts/`, run via `tsx`) instead of the plan's originally assumed
`lib/*.mjs` layout, per the story's own "Precedence of 005" decision — no `.mjs` files, no
`tsconfig.node.json` change (already covers `scripts/**/*.ts`).

**Commit message:** `006: add drift check for the launcher mirror`

**Decisions (implementation-time):**
- Script layout deviates from the plan's `studio/scripts/lib/drift.mjs` / `check-drift.mjs`: used
  `studio/scripts/drift.ts` and `studio/scripts/check-drift.ts` (flat, TypeScript, `tsx`-run) to
  match story 005's actual convention, as the story's Decisions section directs. The planned
  `tsconfig.node.json` `allowJs`/`checkJs` change was dropped as moot — `.ts` files under
  `studio/scripts/` were already covered by the existing `scripts/**/*.ts` include.
- D2 reused `launcher-preflight.ts`'s checkout-level validation (path exists / is a directory / is
  a git work tree) by extracting `launcherCheckoutProblem()`, shared with `runPreflight`
  (`runPreflight`'s own behaviour, used by `sync:launcher`, is unchanged). D2 did NOT reuse
  `runPreflight`'s later checks (missing declared file, dirty working tree) — a missing source
  becomes a per-file `launcher-source-missing` finding rather than aborting the whole run, and an
  uncommitted change in the launcher does not block a read-only comparison, since the check hashes
  whatever is actually on disk.
- Classification precedence: `locally-edited` (disk hash ≠ lock hash) is decided and the file
  `continue`d past before the launcher is ever consulted, so a file that is both locally edited and
  behind a launcher that also moved ahead is always reported as `locally-edited`, never `stale` —
  only the lock-vs-disk comparison proves a local edit happened.
- Every finding carries the mirror-relative path (`file`) and, when a launcher was compared, the
  launcher-relative source path (`launcherFile`) — satisfying AC2/AC6's "names the file's path in
  both repositories" with one shared shape D3's CLI consumes directly.

**Verification:**
- `npm run build` — pass.
- `npm run test` — 57/57 tests pass (11 suites), including the 3 new suites for this story.
- `npm run typecheck` — pass.
- `npm run lint` — fails only on 24 pre-existing files unrelated to this story (CRLF/prettier
  warnings on files this story never touched — verified via `git status --porcelain` before any
  change and independently confirmed by the reviewer); every file this story added or modified is
  eslint- and prettier-clean.
- `e2e` — not applicable per this story's own Decisions/Acceptance Tests section: no UI surface,
  the spawned CLI process is the real acceptance surface.
- AC1 → `drift-core.test.ts` "a locally edited mirrored file is reported by name" + CLI test "exits
  1 and names the edited file" — both passed.
- AC2 → `drift-launcher.test.ts` "a launcher that moved ahead fails the check, naming the path in
  both repositories" — passed; precedence over `locally-edited` covered by an added test (see
  review fix below).
- AC3 → CLI test "without --launcher the check prints one skip line, still verifies the mirror and
  exits 0" — passed.
- AC4 → `drift-core.test.ts` "a file on disk that the lock does not list, and a lock entry with no
  file, are both reported" — passed.
- AC5 → `drift-launcher.test.ts` "the check writes to neither repository" (before/after hashes plus
  `git status --porcelain` on the fixture launcher) — passed.
- AC6 → CLI test "a stale mirror says re-sync, a locally edited one says move the change into the
  launcher" — passed.
- No manual residue.

**Review outcome:** clean-agent review (default tier) returned PASS on all six criteria, confirmed
no scope creep, no weakened tests, `runPreflight` behaviour unchanged, and the lint noise
pre-existing and unrelated. One finding: the test meant to prove `locally-edited` takes precedence
over `stale` built a launcher fixture whose content matched the lock, so the overlapping case was
never actually exercised. Fixed in one review-fix cycle — a dedicated test now uses three distinct
byte contents (lock/mirror, edited-on-disk, moved-ahead-in-launcher) and asserts the sole finding
is `locally-edited`; full suite re-verified green afterward (57/57).
