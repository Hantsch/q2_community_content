# Sprint S02 review — The launcher's contract and rendering live here, verifiably

## Overview

Goal: the launcher's news contract and its slide rendering run inside this repository, copied
verbatim, with a lock file that says which launcher commit they came from and a check that fails
when they drift apart.

| Story | Status | Commit |
| --- | --- | --- |
| 005 — Sync command and lock file for the launcher mirror | done | `005: add sync:launcher command and launcher-core lock file` |
| 006 — Drift check for the launcher mirror | done | `006: add drift check for the launcher mirror` |
| 007 — The mirrored news contract runs unmodified in the studio | done | `007: run the mirrored launcher contract in the studio` |
| 008 — The mirrored slide rendering runs unmodified in the studio | done | `008: mirror the slide rendering set and prove it renders in the studio` |
| 009 — Mirror provenance is reported, not buried | done | `009: report mirror provenance in the drift CLI and as a virtual module` |

All five stories are done; nothing is blocked.

## Implemented stories

- **005** — `npm run sync:launcher -- --launcher <path>` copies 11 (later extended to 18) declared
  launcher files byte-identically into `studio/src/launcher-core/` and writes a deterministic
  `studio/launcher-core.lock.json` (per-file SHA-256, launcher commit, sync date). Validates the
  launcher checkout first (exists, is a git repo, all declared files present, none dirty) and
  writes nothing at all on any failure.
- **006** — `npm run check:drift` re-hashes the mirror against the lock, and — when `--launcher` is
  given — three-way compares lock/disk/launcher to tell a locally edited mirror file apart from a
  launcher that has simply moved on. No `--launcher` prints one skip line and still checks mirror
  integrity, exiting 0. A stale mirror (launcher ahead) is a hard failure, matching the sprint's
  (User) decision.
- **007** — The mirrored `home.ts`/`feed-pipeline.ts`/`frontmatter.ts` now typecheck and run
  unmodified: `@shared/*` is mapped in the studio's build config (not rewritten at sync time), one
  boundary module (`studio/src/contract/launcher-contract.ts`) is the sole door into the mirror,
  and a guard test proves no contract rule exists a second time anywhere else in `studio/src`.
- **008** — The four slide templates, `SlideButtons` and its `Button`/`cn` import closure, and the
  launcher's whole `styles/` entry graph are mirrored and proven to render — real classes, real
  design tokens, the three bundled Fontsource fonts (with a licence note), and a real repository
  image — from a standalone `studio/mirror-check.html` page that the studio shell never imports.
- **009** — A provenance module reports the launcher commit, sync date, file count and drift
  verdict from the lock file alone (no launcher checkout, no git history needed). The drift CLI
  now names the launcher commit on every run, and the same verdict vocabulary
  (`in-sync`/`out-of-sync`/`unknown`) is exposed to the future studio surface as a build-time Vite
  virtual module.

## Findings & decisions

- **Repo-wide CRLF/Prettier mismatch** (all five stories) — this Windows checkout has
  `core.autocrlf=true` and no `.gitattributes`, so `prettier --check` fails on ~24–34 files on
  every run, none of them touched by the story reporting it. Confirmed pre-existing and unrelated
  each time (via `git stash`/`git status` before any change). Worth fixing once, centrally,
  instead of re-verifying it away in every future story — see roadmap follow-up below.
- **007's mirror path has an extra `src/` segment** versus the shorthand used in the story's own
  planning text (`launcher-core/src/shared/...`, not `launcher-core/shared/...`) — real path
  confirmed against `studio/scripts/launcher-core.manifest.ts` before wiring the `@shared/*`
  alias. Future stories referencing mirror paths should read the manifest, not the story text.
  Same caution surfaced independently in 008.
- **008 extended 005's manifest** (`launcher-core.manifest.ts`) to add `Button.tsx`, `lib/cn.ts`
  and the four sibling stylesheets `index.css` imports — the manifest is sync tooling, not mirror
  content, so editing it stayed inside the "mirror is never hand-edited" rule. This is expected to
  recur: later stories that render more of the mirror will likely extend the manifest again.
- **007 temporarily excluded `src/launcher-core/src/renderer/**` from `tsconfig.json`** because the
  renderer's own dependencies weren't mirrored yet; 008 closed that gap by mirroring them and
  removing the exclusion. No renderer code was left out of `typecheck`/`build` by the end of the
  sprint.
- **007's single-source guard (D4)** is a copy-detector (catches a verbatim re-implementation of a
  contract rule), not a full behavioural-equivalence detector — a differently worded
  re-implementation of the same rule could still slip past it. Accepted as meeting AC4's literal
  wording; a heavier static-analysis check would be disproportionate to this story's scope.
- **007's `read-news-tree.ts`** builds file URLs by string concatenation instead of
  `pathToFileURL` — safe on this checkout, a real but low-probability edge case on POSIX paths
  with special characters. Left as a note, not fixed.
- **CS-9's "provenance visible in the studio" is only half delivered.** 009 built the structured
  data (`virtual:mirror-provenance`) and the CLI-level reporting; there is no rendered UI yet,
  because the studio has no surface to render it in until M4/S04. This is a named, deliberate gap,
  not a missed criterion — none of 009's acceptance criteria describe a UI.
- **Sprint-level (User) decisions held without exception**: `--launcher` argument (not env var or
  sibling convention), stale mirror = hard failure, `check:drift` stays standalone (not wired into
  lint/test), no launcher tests mirrored, Fontsource fonts bundled with a licence note, and
  out-of-sync preview will warn rather than block once a preview exists.

## Blocked / open

None. All five stories reached `done`; no story required a user decision beyond the clarification
round at sprint start.

## Acceptance

Acceptance is the test suite; every criterion below was proven by an automated test, run for real
(spawned CLI processes, a real Vite dev server, real Playwright browsers) rather than asserted
against the implementation's own claims. `ui-acceptance-required: true` applies only where a
story describes something a user does through a rendered surface — stories 005–007 and 009 have no
such surface this sprint (their own Decisions record why: terminal commands and structured data
are the real surface), so their criteria are proven by `npm run test`/spawned-CLI tests. Story
008's browser-level criteria (AC3, AC4, AC6) are proven by the Playwright `e2e` suite
(`studio/e2e/mirrored-rendering.spec.ts`), the real surface for a claim about what renders in a
browser.

| Story | Criterion | Proved by |
| --- | --- | --- |
| 005 | AC1 copies declared files | `sync-launcher.cli.test.ts` › "copies every declared file" |
| 005 | AC2 byte-identical, no edits | `sync-launcher.cli.test.ts` › "byte-identical to its source" |
| 005 | AC3 lock records path/hash/commit/date | `launcher-core-lock.test.ts` + `sync-launcher.cli.test.ts` |
| 005 | AC4 bad launcher path fails, writes nothing | `launcher-preflight.test.ts` + `sync-launcher.cli.test.ts` |
| 005 | AC5 uncommitted mirrored-file change is reported | `launcher-preflight.test.ts` dirty-file case |
| 005 | AC6 second run is a no-op | `sync-launcher.cli.test.ts` › "second run leaves tree unchanged" |
| 005 | AC7 writes only inside `studio/` | `sync-launcher.cli.test.ts` › "writes only inside studio/" |
| 006 | AC1 locally edited file reported | `drift-core.test.ts` + CLI test |
| 006 | AC2 launcher-ahead file fails, both paths named | `drift-launcher.test.ts` |
| 006 | AC3 no-checkout skip line, exit 0 | CLI test, no-`--launcher` case |
| 006 | AC4 orphans both directions reported | `drift-core.test.ts` |
| 006 | AC5 read-only in both repos | `drift-launcher.test.ts`, before/after hashes + `git status` |
| 006 | AC6 remedy wording per case | CLI test, stale vs. locally-edited wording |
| 007 | AC1 mirrored contract compiles unmodified | `launcher-core-toolchain.test.ts` |
| 007 | AC2 pipeline over real `news/` yields 4 entries, correct templates/orders | `news-contract.test.ts` |
| 007 | AC3 no-title dropped, cover-no-image → text | `news-contract-fixtures.test.ts` (2 tests) |
| 007 | AC4 no rule exists outside the mirror | `contract-single-source.test.ts` |
| 007 | AC5 mirror reached only via boundary module | `contract-single-source.test.ts` + `launcher-core-unmodified.test.ts` |
| 007 | AC6 `check:drift` still passes | `launcher-core-unmodified.test.ts` |
| 008 | AC1 four components render, no source edits | `mirroredSlides.test.tsx` |
| 008 | AC2 DOM/classes match the mirrored source's own markup | `mirroredSlides.test.tsx` |
| 008 | AC3 `home-hero.css` applied, every custom property resolves | `mirrorStyles.test.ts` (static) + `mirrored-rendering.spec.ts` (live, e2e) |
| 008 | AC4 fonts available locally, no network | `mirrored-rendering.spec.ts` (e2e) |
| 008 | AC5 no studio stylesheet targets a mirrored class | `studioStylesheets.test.ts` |
| 008 | AC6 image renders from `news/img/` | `mirrored-rendering.spec.ts` (e2e) |
| 008 | AC7 `check:drift` still passes | `mirrorDrift.test.ts` |
| 009 | AC1 provenance module reports commit/date/count/verdict | `provenance.test.ts` |
| 009 | AC2 drift CLI names the launcher commit | `drift-provenance.test.ts` |
| 009 | AC3 provenance available as structured data | `provenance-virtual-module.test.ts` (real Vite dev server) |
| 009 | AC4 out-of-sync reported with the same wording everywhere | `provenance.test.ts` + `drift-provenance.test.ts` |
| 009 | AC5 survives a fresh clone (no launcher checkout, no git history) | `read-provenance.test.ts` |
| 009 | AC6 missing/unparseable lock → "unknown", never a crash or false-clean | `read-provenance.test.ts` (2 tests) |

No criterion was covered a level below its real surface, and no `manual residue` was declared in
any of the five stories — every criterion this sprint has a passing automated test behind it.
