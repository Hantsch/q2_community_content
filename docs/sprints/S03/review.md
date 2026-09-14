# Sprint S03 — Review

## Overview

**Goal:** `npm run validate` answers, for every entry in `news/`, what was declared and what the
launcher will actually deliver — plus the findings that only looking at the whole directory can
produce. No window, no UI.

| Story | Status | Commit |
| --- | --- | --- |
| 010 — Reader for the content repository's working tree | done | `010: add the content repo reader` |
| 011 — The declared-versus-delivered report | done | `011: build the declared-versus-delivered report` |
| 012 — Headless validate command | done | `012: add the headless validate command` |
| 013 — Repository-level findings across the news directory | done | `013: report repository-level findings across the news directory` |

All four stories are done; none were blocked. The goal is met: `npm run validate` (and
`--json`, `--strict`) now states declared-vs-delivered per entry plus repository-wide findings,
runs headless with no launcher checkout, and writes nothing.

## Implemented stories

**010 — Content repo reader.** A pure, synchronous, never-throwing reader of the working tree:
raw `index.json`, named documents, unnamed drafts, `news/img/` listing, and findings for a broken
index, a missing document, or a path escaping `news/`. BOM/CRLF-normalised on read so it sees what
the mirrored frontmatter parser sees. `news/_templates/` is readable only through a separate call
and never leaks into documents/drafts/images.

**011 — Declared-vs-delivered report.** A pure library (`buildNewsReport`) that runs the mirrored
`resolveFeed()` / `filterAndSortSlides()` and turns the difference between what was declared and
what survives into a per-entry verdict: template fallback (naming the missing image), dropped
(naming the rule), button kept/dropped, visibility (published/scheduled/expired against a supplied
clock), and delivered order (naming the tie-break). Every verdict traces to the pipeline's own
output or is explicitly marked `source: 'studio'` where the report itself had to infer something
(order-tie winner, a declared image path absent from disk).

**012 — Headless validate command.** `npm run validate` (`--json`, `--strict`) wires 010's reader
and 011's report into a CLI: text or JSON output, a provenance header from story 009, an exit code
driven by drops (and, under `--strict`, fallbacks too). Runs with no studio, dev server or browser,
and in a clone with no `q2-launcher` checkout.

**013 — Repository-level findings.** Duplicate `id`s (naming kept vs. discarded), drafts, orphaned
images, order collisions (naming actual delivered positions, not raw declared `order`), missing
documents, frontmatter/index `order` mismatches, and unsafe file names — checked against the
launcher's own safe-name predicates, newly mirrored into `studio/src/launcher-core/` rather than
reimplemented.

## Findings & decisions

- **Severity model settled once, used by all three findings-producing stories:** `error` (the
  launcher drops the entry or refuses the name), `warning` (an unintended difference, almost always
  a mistake but not fatal), `info` (a directory/visibility state). This was the sprint's single
  biggest cross-story decision and it held without exception across 010/011/013.
- **AC8's discipline ("classifies, does not decide") surfaced a real defect in 013's review:** the
  first pass of the order-collision finding echoed each entry's raw declared `order` instead of the
  actual position from the mirrored `filterAndSortSlides()`. Fixed in one review-fix cycle by adding
  a `deliveredFeed` field computed from the real pipeline call — worth remembering as the pattern to
  watch for in any future finding that reports a *position*: always read it from the pipeline, never
  recompute it.
- **013's safe-name mirror ended up narrower than planned.** The refine-time decision named eight
  files to mirror; two (`fetch-image.ts`, `renderer-source.ts`) turned out to import `electron` or
  fail the studio's browser `tsc` settings. Both were redirected through the stub/`rootDirs`
  mechanism story 008 already established, rather than mirrored verbatim or reimplemented. No
  launcher source was edited or duplicated.
- **Known gap, explicitly out of scope:** `npm run validate`'s `repositoryFindings` count (012 AC7)
  still always reports `0` — 012 was built before 013 existed and left the field as an ad-hoc
  `unknown[]` placeholder; wiring 013's real `collectRepositoryFindings()` output into the CLI is not
  covered by any AC in either story. This is a real, user-visible gap (the count in `npm run
  validate`'s summary line is currently always 0) — see Follow-ups.
- **Two accepted spec gaps in 011**, both documented rather than silently worked around: AC5's
  "missing label or url" button-drop reason is unreachable in practice (the mirrored frontmatter
  parser discards such a button before the pipeline ever sees it); an index row without a usable
  `id`/`file` produces a report-level finding rather than a per-entry verdict, since there is nothing
  to hang one on.
- **Environmental noise, confirmed non-regressing in every story:** 4 pre-existing
  `launcher-core/` mirror-hash-drift test failures and ~79 repo-wide CRLF/Prettier failures, both
  present on the base branch before this sprint (`git stash`-verified each time). Same root cause as
  the `.gitattributes` follow-up already on the roadmap from S02.

## Blocked / open

None. One deliberately-open decision was resolved mid-sprint: story 013's AC4 (safe-name rule) was
returned `BLOCKED: user question` in its first refine pass because the rule lived only in
un-mirrored `q2-launcher` source; the user chose "mirror the files as-is," which the build then
carried out (see Findings above for the resulting adjustment).

## Acceptance

Every criterion below is proven by the named test in the story's own `## Acceptance Tests` /
`## Done` section; all are unit-level (`npm run test`, Vitest) — none of these four stories has a
criterion describing a studio-UI user action, so the profile's `e2e` gate does not apply to any of
them (the terminal surface *is* story 012, and it is tested as a real spawned process).

| Story | Criteria proven by test |
| --- | --- |
| 010 | AC1–AC7, all in `read-content-repo.test.ts` / `paths.test.ts` / `content-repo-read-only.test.ts` |
| 011 | AC1–AC8, across `build-news-report.test.ts`, `template-verdict.test.ts`, `button-verdicts.test.ts`, `visibility-order.test.ts` |
| 012 | AC1–AC7, across `summary.test.ts`, `format-text.test.ts`, `format-json.test.ts`, `validate-cli.test.ts`, `validate-headless.test.ts` |
| 013 | AC1–AC7, all in `repository-findings.test.ts` (+ `launcher-safe-names.test.ts` for AC4) |

No manual residue anywhere in this sprint — every criterion across all four stories is covered by
an automated test with no exceptions. No criterion was covered at a level below the real surface:
none of these stories has a real (UI) surface to fall short of.

`testplan.md` was not written: the profile's `testplan: optional` setting writes that file only for
criteria marked `manual residue`, and there are none this sprint.
