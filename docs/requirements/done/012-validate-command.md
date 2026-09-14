---
id: 012
title: Headless validate command
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Not every check needs a window. Before publishing, the useful question is a one-liner: is anything
in `news/` going to behave differently than I wrote it? A command answers that in a second, works
over SSH, and can be wired into a check later without anyone rebuilding it.

It is also the honest test of the report from story 011: if the verdicts only exist inside a React
component, they are a UI feature. If they come out of a command, they are a fact about the
repository.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-12.

## Acceptance Criteria

- [x] **AC1** — `npm run validate` prints, for every entry, its declared and delivered form and
      every finding attached to it, in a layout readable in a terminal.
- [x] **AC2** — `npm run validate -- --json` prints the same data as JSON, with no human-readable
      text mixed into the stream.
- [x] **AC3** — The command exits non-zero when at least one entry would be dropped, and 0 when
      every entry is delivered.
- [x] **AC4** — It runs without starting the studio, a dev server or a browser.
- [x] **AC5** — It works in a clone with no `q2-launcher` checkout present.
- [x] **AC6** — It reads the repository and writes nothing.
- [x] **AC7** — The summary line states counts a person can act on: entries delivered as declared,
      entries falling back, entries dropped, repository findings.

## Open Questions

- ~~Do fallbacks affect the exit code? A `cover` silently becoming `text` is usually a mistake, but
  failing on it would make the command unusable in a repository that has one deliberate case.
  A `--strict` flag is the obvious escape, if it is wanted.~~ answered → Decisions (Sprint)
- ~~Should the command accept a path argument to validate a single entry, or is the whole feed always
  the unit?~~ answered → Decisions (Sprint)
- ~~Should it report the mirror provenance from story 009 in its header, so a verdict from a stale
  mirror is visibly that?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Exit code and fallbacks: only drops fail the default exit code; a `--strict` flag also
  fails on fallbacks, for repositories/CI that want zero silent downgrades.
- **(User)** Scope: whole feed only, no path argument to validate a single entry — matches AC1/AC7's
  feed-wide framing.
- **(User)** Mirror provenance: shown in the command's header, using story 009's provenance data, so a
  verdict from a stale mirror is visibly marked as such.
- Layering: pure formatting/summarising in `studio/src/validate/`, Node I/O and argv in
  `studio/scripts/validate.ts` — the split story 009 already uses, keeping `node:fs` out of code the
  browser bundle may import.
- The script is defined in `studio/package.json` and re-exposed at repository root
  (`npm run validate --workspace studio --`), because the root mirrors every studio script one-to-one
  and AC1 names the bare `npm run validate`.
- Arguments: exactly `--json` and `--strict`, hand-parsed in `check-drift.ts`'s style; anything else is
  a usage error — the (User) scope decision rules out a path argument and the repo has no arg library.
- Exit codes are 0 and 1 only, usage errors included, because `check:drift` already established that
  vocabulary and a second one would have to be documented and remembered.
- Provenance never influences the exit code — story 009 decided an out-of-sync mirror warns rather
  than blocks.
- Provenance wording and data come from story 009's `readMirrorProvenance()` / `formatProvenance()`
  with no second string literal, because 009's AC4 makes that module the single owner of the wording.
- In `--json` mode stdout carries exactly one JSON document and every diagnostic, warning and usage
  error goes to stderr, since AC2 forbids human-readable text in the stream.
- The JSON payload carries a `schemaVersion` and the same facts as the text mode (provenance, entries,
  repository findings, summary), so the "wired into a check later" promise in the Requirement does not
  need the text output reverse-engineered.
- The exit code is decided exclusively by entry outcomes (drops, plus fallbacks under `--strict`);
  repository findings are counted and printed but never fail on their own, because AC3 defines the
  exit code purely in terms of entries being dropped — and a duplicate `id` that discards an entry
  already shows up as a dropped entry.
- Repository findings (story 013, which builds after this one) are consumed as an optional field of
  story 011's report and counted as 0 until 013 lands, so AC7 needs no CLI change later.
- The command aggregates and formats only; every verdict is taken from story 011's report, so that
  story's AC8 discipline ("classifies and explains, does not decide") survives into the CLI.
- Text layout is plain ASCII with no colour or TTY detection: a provenance header, one block per
  entry, then the summary line — readable in a terminal (AC1) and safe through a pipe.
- The report's clock (011 AC6) is the wall clock, with no flag to override it; determinism in the
  tests comes from fixtures with far-past and far-future dates rather than a production flag that
  exists only for tests.
- Acceptance runs through the command itself, spawned for real in Vitest, not through Playwright —
  the profile's `ui-acceptance-required` rule targets user actions in the studio UI, and story 009's
  AC2 set this precedent for a CLI-only story.

## Plan

A thin, honest shell around what 010 and 011 build: read the repository, hand it to the report, count,
print, exit. No new verdict logic lives here.

1. **Summary core** — `studio/src/validate/summary.ts`: `ValidationSummary`
   (`deliveredAsDeclared`, `fallingBack`, `dropped`, `repositoryFindings`, `total`),
   `summarise(report)` and `exitCodeFor(summary, { strict })`. Pure, no `node:*`.
2. **Text output** — `studio/src/validate/format-text.ts`: provenance header lines (from story 009's
   `formatProvenance`), one block per entry with declared → delivered plus its findings, then the
   summary line. Pure, returns `string[]`.
3. **JSON output** — `studio/src/validate/format-json.ts`: `toValidationPayload(...)` →
   `{ schemaVersion, mirror, entries, repositoryFindings, summary }`, JSON-serialisable, same facts
   as step 2.
4. **CLI** — `studio/scripts/validate.ts`: parse `--json` / `--strict`, resolve the repo root
   (`resolveRepoRoot` from `scripts/sync-launcher.ts`), read provenance (009), read the working tree
   (010), build the report (011), print via 2 or 3, set `process.exitCode`. Never writes.
   Plus `"validate"` in `studio/package.json` and the root `package.json`.

Order: 1 → 2 and 3 in parallel → 4.

**Dependencies.** 010 (reader) and 011 (report) are being refined in parallel and build before this
story. This story consumes their exported types and entry points as they end up named — the report
object with per-entry declared/delivered verdicts and findings, and the reader's repo-root-scoped
read. If the names differ from the ones sketched above, use the ones that exist; do not re-implement
reading or verdict logic here, and do not add a second npm script. Story 013 (repository findings)
builds after this one and only fills the `repositoryFindings` field this story already prints.

Nothing outside `studio/` (plus the root `package.json` script line) is touched; the published
surface and `studio/src/launcher-core/` are read-only here.

## Deliverables

- [x] **D1 — Summary core (pure).** `studio/src/validate/summary.ts` + `summary.test.ts`.
  `ValidationSummary`, `summarise(report)`, `exitCodeFor(summary, { strict })`.
  *Accepted when:* a feed where every entry is delivered as declared summarises to all-delivered and
  exit 0; one dropped entry gives exit 1 with and without `--strict`; a fallback gives 0 by default
  and 1 under `--strict`; `repositoryFindings` counts an absent field as 0. Mirrors the pure-core
  style of `studio/src/mirror/provenance.ts`.
- [x] **D2 — Text formatter.** `studio/src/validate/format-text.ts` + `format-text.test.ts`.
  Header from story 009's `formatProvenance`, per-entry blocks, summary line. No colour, no TTY
  checks. *Accepted when:* every entry appears with its declared and its delivered form and each of
  its findings; the header names the launcher commit and the mirror verdict using 009's labels (no
  literal re-typed); the summary line states the four counts from AC7.
- [x] **D3 — JSON payload.** `studio/src/validate/format-json.ts` + `format-json.test.ts`.
  *Accepted when:* the payload round-trips through `JSON.parse(JSON.stringify(...))` unchanged,
  carries `schemaVersion`, mirror provenance, one object per entry with declared/delivered/findings,
  `repositoryFindings` and the same counts as D2's summary line.
- [x] **D4 — CLI + scripts.** `studio/scripts/validate.ts`, `"validate"` in `studio/package.json` and
  in the root `package.json`, fixture content repositories under `studio/tests/fixtures/validate/`
  (reuse story 010's reader fixtures where they fit), and `studio/tests/validate-cli.test.ts` which
  spawns the real `npm run validate`. Mirrors `studio/scripts/check-drift.ts` (arg parsing, `Result`
  union, `process.exitCode`, never `process.exit`). *Accepted when:* text and `--json` runs both
  work against the fixtures, `--json` stdout parses as a single JSON document with nothing else on
  it, exit codes follow D1, the run needs no launcher checkout, and `git status --porcelain` is
  unchanged afterwards.
- [x] **D5 — Headless proof.** `studio/tests/validate-headless.test.ts`: asserts the static import
  graph of `studio/scripts/validate.ts` (following relative imports transitively) contains no
  `vite`, `react`, `playwright` or `.tsx` specifier, and that the spawned command terminates on its
  own without listening on a port. *Accepted when:* the test fails if someone imports a studio
  surface module into the CLI path.

## Model Hints

- D1, D2, D3, D5 → default tier. Each is one small pure file (or one static-analysis test) plus its
  test, single-layer, no regression surface.
- D4 → default tier. It is wiring in the shape of an existing CLI (`check-drift.ts`) with the same
  arg-parsing and exit-code conventions; the logic it wires up lives in D1–D3.
- Review: → default. Four small files, one new npm script and no change to existing behaviour; the
  only cross-story subtlety (consuming 010/011's shapes) is visible in the diff itself.

## Acceptance Tests

As verified — test names below are the real ones in the delivered files (unchanged from the plan
except AC7, where the "summary line" CLI test the plan sketched was not written as a separate case;
the unit test plus the dropped-entry CLI exit-code test between them still exercise the real
production code path, since `validate.ts` calls `formatValidationText` with no transformation in
between — noted as a deliberate, reviewed gap rather than silently reworded):

- AC1 → unit `studio/src/validate/format-text.test.ts` › "prints every entry with its declared and
  delivered form plus each finding (AC1)" (D2), plus cli `studio/tests/validate-cli.test.ts` ›
  "\"npm run validate\" prints a verdict for every entry of the fixture feed" (D4)
- AC2 → cli `studio/tests/validate-cli.test.ts` › "\"--json\" prints one JSON document and nothing
  else on stdout" (D4), plus unit `studio/src/validate/format-json.test.ts` › "the payload carries
  the same facts as the text output" (D3)
- AC3 → unit `studio/src/validate/summary.test.ts` › "drops fail the exit code, fallbacks only under
  --strict" (D1), plus cli `studio/tests/validate-cli.test.ts` › "exits 1 on a dropped entry and 0 on
  a clean feed" (D4)
- AC4 → integration `studio/tests/validate-headless.test.ts` › "the validate CLI imports no studio
  surface, dev server or browser module and terminates on its own" (D5)
- AC5 → cli `studio/tests/validate-cli.test.ts` › "runs in a fixture clone with no q2-launcher
  checkout present" (D4)
- AC6 → cli `studio/tests/validate-cli.test.ts` › "leaves `git status --porcelain` unchanged",
  reusing `studio/tests/git-fixture.ts` (D4)
- AC7 → unit `studio/src/validate/summary.test.ts` › "counts entries delivered as declared, falling
  back, dropped and repository findings" (D1), plus unit `studio/src/validate/format-text.test.ts` ›
  "states all four AC7 counts in the summary line" (D2) — the CLI-level restatement the plan sketched
  was judged redundant with these two and the existing exit-code CLI test; see the review note above.

No `manual residue`. No Playwright criterion: no AC here describes a user action in the studio UI —
the real surface of this story is the command, and the CLI tests spawn it for real (the precedent
story 009 set for AC2).

## Done

Implemented `npm run validate`, a headless CLI wrapping story 010's reader and story 011's report:
`studio/src/validate/summary.ts` (`ValidationSummary`, `summarise`, `exitCodeFor`),
`studio/src/validate/format-text.ts` (plain-ASCII terminal output, header from story 009's
`formatProvenance`), `studio/src/validate/format-json.ts` (`toValidationPayload`, `schemaVersion:
1`), and `studio/scripts/validate.ts` (the CLI itself, mirroring `check-drift.ts`'s
`Result`/`parseArguments`/`main()` shape, wired to `resolveRepoRoot`, `readMirrorProvenance`,
`readContentRepo` and `buildNewsReport`, mapping story 010's `{text}`/`{name,path,bytes}` shapes to
story 011's `string`/`{name,size}` input shapes). Added `"validate"` to `studio/package.json` and
the root `package.json`, fixtures under `studio/tests/fixtures/validate/{clean-feed,dropped-entry}/`,
and three new test files: `studio/tests/validate-cli.test.ts` (spawns the real CLI),
`studio/tests/validate-headless.test.ts` (static import-graph proof plus a spawn-terminates proof),
and the three `studio/src/validate/*.test.ts` unit suites.

Commit message:

```
012: add the headless validate command
```

Verification:
- `npm run build` — green.
- `npm run typecheck` — green, no errors.
- `npm run test` — 177 passed, 4 failed. The 4 failures (`tests/mirror-set.test.ts`,
  `tests/mirrorDrift.test.ts`) are confirmed pre-existing `studio/src/launcher-core/` mirror-drift on
  this Windows checkout, unrelated to this story: identical failure set to the one documented in
  stories 010/011's own `## Done` sections, and confirmed again here via `git status` (no
  `launcher-core/` file touched by this story).
- `npm run lint` — `eslint .` clean (`npx eslint .` run directly returns no output); `prettier
  --check .` reports the same 79 repo-wide files both **with and without** this story's changes
  (`git stash` / `git stash pop` comparison run during this build) — a pre-existing CRLF-vs-LF
  environmental issue on this Windows checkout (`core.autocrlf=true`), not a regression from this
  story; none of this story's own new files appear only in the "with changes" run.
- `npm run e2e` — 9/9 passed (pre-existing suite, untouched by this story; this story has no
  criterion describing a studio-UI user action, per its own `## Acceptance Tests` note).
- Clean-agent review (default tier, per Model Hints): **PASS** on first pass. All AC1–AC7 confirmed
  with real evidence (file:line) against the delivered tests; confirmed the exit code is derived
  purely from `summary.dropped`/`summary.fallingBack` (never `repositoryFindings`), `--json` mode
  writes exactly one `console.log` line and routes all diagnostics to stderr, provenance wording is
  sourced only from story 009's `formatProvenance`, no writes anywhere in the CLI or its read path,
  `process.exit` is never called, the story 010→011 shape mapping (`{text}`→`string`,
  `bytes`→`size`) is correct, `repositoryFindings` degrades to `[]`/`0` gracefully in the field's
  absence, and no `studio/src/launcher-core/` file was touched. Two non-blocking nits noted (no fix
  needed): AC7's story-sketched CLI-level "summary line" test was not written as a separate case
  (covered instead by the unit test plus the existing exit-code CLI test exercising the same
  production code path — documented in `## Acceptance Tests` above); `ContentReport &
  { repositoryFindings?: ... }` is declared twice (summary.ts, format-json.ts) instead of shared —
  harmless duplication. Zero review-fix cycles needed.

AC → test mapping as verified: see the updated `## Acceptance Tests` section above — all AC1–AC7
map to real, passing tests with the exact test names in the delivered files. No `manual residue`.

Decisions (this build, beyond the story's own `## Decisions (Sprint)`):
- `repositoryFindings` is typed as an intersection add-on (`ContentReport & { repositoryFindings?:
  readonly unknown[] }`) in both `summary.ts` and `format-json.ts`, rather than adding the field to
  story 011's `report-types.ts` — that type belongs to story 013, which will give it a real shape;
  adding it here under a different, guessed shape would be a collateral edit to another story's
  contract.
- The CLI test harness (`validate-cli.test.ts`) spawns `tsx` with an explicit `--tsconfig` pointing
  at `studio/tsconfig.json`, because the sandbox's `cwd` (a bare temp dir) has no tsconfig of its own
  for `tsx` to auto-discover the `@shared/*` path alias the mirrored `contract/launcher-contract`
  module needs. This is a test-harness-only concern; `npm run validate` itself always runs with `cwd`
  inside `studio/`, where the alias resolves without any extra flag.
- No `manual residue`; no Playwright test — this story's real surface is the command itself, per the
  story's own note (the precedent story 009 set for a CLI-only story).
