---
id: 011
title: The declared-versus-delivered report
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the story the whole project was started for. The news contract is deliberately forgiving:
a `cover` without an image is not rejected, it is quietly downgraded to `text`; a button pointing at
`gist.github.com` is not an error, it simply disappears; an entry with an empty body is dropped
while the rest of the feed carries on. Every one of those rules is right at runtime and invisible to
the author.

The report states them out loud, before publishing, in the author's terms: what you declared, what
the launcher will actually deliver, and — wherever those differ — which rule made the difference.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-11, section 7.

## Acceptance Criteria

- [ ] **AC1** — Every entry gets a verdict naming its declared template and the template it will be
      delivered as.
- [ ] **AC2** — A `split` or `cover` with no usable image is reported as falling back to `text`,
      naming the image path that was not found.
- [ ] **AC3** — An unknown `template` value is reported as falling back to `text` — as a note, not
      an error, because the contract treats it as a supported outcome.
- [ ] **AC4** — A dropped entry names the rule that dropped it: missing title, empty body,
      frontmatter that did not parse, an index row without `id` or `file`, or a duplicate `id`.
- [ ] **AC5** — Each button is reported as kept or dropped, and a dropped one names the reason —
      host not `github.com` or `raw.githubusercontent.com`, missing label or url, or being the
      fourth button.
- [ ] **AC6** — Visibility is reported as published, scheduled from a date, or expired since a date,
      evaluated against a clock the caller supplies rather than the wall clock.
- [ ] **AC7** — The delivered order is reported per entry, and two entries sharing an `order` value
      are flagged with the tie-break the launcher will apply.
- [ ] **AC8** — Every verdict is derived from the mirrored pipeline's own output; the report
      classifies and explains, it does not decide.

## Open Questions

- ~~What severity model does the report use — error / warning / info? A fallback is not a failure, but
  it is almost always a mistake, and flattening both into "warning" loses that.~~ answered → Decisions (Sprint)
- ~~Is a scheduled entry a finding at all, or just a state? It is often exactly what the author
  intended.~~ answered → Decisions (Sprint)
- ~~Should the report be able to explain *why* an entry is in a given position, beyond its `order`
  value — for example when a tie-break decided it?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Severity model: error / warning / info. Drops are `error`, fallbacks are `warning`
  (not fatal but almost always a mistake), states like scheduled/expired are `info`.
- **(User)** Scheduled entries: reported as `info`, not counted as a finding/drop — it is often
  exactly what the author intended.
- **(User)** Position explanation: yes, name the tie-break when one decided an entry's position
  (directly serves AC7).
- Module, not command: 011 ships a pure library under `studio/src/report/` with no IO and no
  printing — because 012 (CLI) and S04/S05 (UI) are named as the consumers, so a verdict that only
  existed inside a renderer would be the exact failure 012's requirement calls out.
- Input shape: `buildNewsReport({ index, documents, now, images? })` — the same `{ index, documents }`
  the mirrored `resolveFeed()` takes and story 010's reader produces, so 011 is testable from
  fixtures today and 010 only has to hand over that shape later.
- Two-phase pipeline call: the report calls `resolveFeed()` and then `filterAndSortSlides(slides, now)`
  itself instead of `buildFeed()`, because the difference between the two lists *is* the visibility
  and order verdict — only that way does AC6/AC7 come from the pipeline rather than from a re-check.
- Declared side is read with the mirrored `parseFrontmatter()`, never with an own parser, so
  "declared" in AC1 means exactly what the launcher read.
- Verdict attribution works by classifying the pipeline's `NewsFeedWarning.reason` strings against a
  known pattern table; the mirror may not be hand-edited (CLAUDE.md), so its prose is the only
  channel it offers. Any reason matching no pattern is still reported verbatim as a `warning` — the
  report never swallows a warning it failed to recognise.
- AC2 vs AC8, resolved: the *fallback verdict* is only ever the pipeline's (`split`/`cover` with no
  usable `image` field in frontmatter), and the report names the declared `image` value where there
  is one, otherwise states that no image was declared. A declared image path that is absent from
  `news/img/` is reported as a separate `warning` marked `source: 'studio'` — the launcher fetches
  that path over HTTP and renders a broken image, it does not fall back — because claiming a
  fallback there would be the report deciding, which AC8 forbids.
- Severity of an unknown `template` (AC3): `warning`, not `info`. The user's severity decision puts
  every fallback at `warning`, and AC3 only requires "not an error", which `warning` satisfies.
- Expired entries count as `info` visibility states, not as drops, per the user's severity decision —
  so the drop count in the summary stays the count of entries the contract rejected.
- Drafts, orphan images and duplicate-id *repository* views stay out: 013 owns them. 011 reports only
  what the pipeline said about the rows `index.json` actually names.
- Findings carry `source: 'pipeline' | 'studio'` so AC8 is checkable in the data itself, not only in
  the tests.

## Plan

1. **Model (`studio/src/report/report-types.ts`).** `ContentReport { entries, findings, summary }`;
   `EntryVerdict { id, file, indexPosition, declared, delivered, visibility, buttons, findings }`;
   `Finding { severity: 'error'|'warning'|'info', kind, message, entryId?, file?, source }`.
   `delivered` is `'dropped'` or `{ template, order, position, buttons }`.
2. **Warning classifier (`classify-warning.ts`).** Pattern table `NewsFeedWarning.reason` →
   `{ kind, severity }`: entry drops → `error`; template fallbacks, button drops, malformed dates,
   missing `order`, order ties → `warning`; visibility states → `info`. Unmatched → `warning` with
   `kind: 'unclassified'` and the reason verbatim.
3. **Spine (`build-news-report.ts`).** Call `resolveFeed({ index, documents })`, then
   `filterAndSortSlides(slides, now)`. Walk the index rows in order; for each, read the declared side
   with the mirrored `parseFrontmatter()`, find its slide in the resolved list (absent ⇒ dropped),
   attach the warnings carrying its `id`. Warnings without an `id` (bad index shape, missing
   `schemaVersion`, `index entry at position N`) become report-level findings.
4. **Template verdict.** Declared vs delivered template per entry; where they differ, the reason is
   the pipeline's own fallback warning, enriched with the declared `image` value. When `images` is
   supplied, a declared path not in that list adds the separate `source: 'studio'` finding.
5. **Button verdicts.** Zip declared `data.buttons` against `slide.buttons` in declaration order,
   consuming the entry's button warnings in pipeline order (`sanitizeButtons` emits one per dropped
   candidate, then the cap warning); allowed-but-unmatched leftovers are the cap victims.
6. **Visibility + order.** Resolved-but-not-filtered ⇒ not visible; `visibleFrom`/`visibleUntil`
   decide which label (`scheduled` / `expired`) and the date carried on it. Delivered position comes
   from the filtered list; entries sharing an `order` value are flagged with "index order decided:
   A before B"; entries with no usable `order` are grouped separately with the pipeline's own
   "sorts after the ordered ones" reason.
7. **Summary.** Counts: delivered as declared, fallen back, dropped, plus the finding counts per
   severity — the raw material 012's AC7 summary line needs.

Order: 1 → 2 → 3 → (4, 5, 6 independent) → 7. Nothing outside `studio/src/report/` is touched; the
mirror under `studio/src/launcher-core/` is imported only, never edited.

**Dependency on story 010 (in refinement in parallel):** none at build time. 011 consumes the
`{ index, documents }` shape and an optional `images: { name, size }[]` list — both exactly what 010
promises (its AC1/AC2) and what `studio/src/contract/read-news-tree.ts` already produces today. All
011 tests run on in-memory fixtures, so 011 can be built and merged before 010 lands; 012 is the
story that wires the real reader in.

## Deliverables

- **D1 — Report model, severity taxonomy and the warning classifier.**
  Files: `studio/src/report/report-types.ts` (new), `studio/src/report/classify-warning.ts` (new),
  `studio/src/report/classify-warning.test.ts` (new),
  `studio/src/report/__fixtures__/news-tree.ts` (new, mirror the pattern of
  `studio/src/mirror/__fixtures__/build-mirror-fixture.ts`).
  Acceptance: every `NewsFeedWarning.reason` the mirrored `feed-pipeline.ts` can emit is mapped to a
  kind and severity (drops `error`, fallbacks/button drops/order notes `warning`, states `info`); an
  unknown reason comes back as `kind: 'unclassified'`, severity `warning`, message verbatim. The
  fixture builder produces a `{ index, documents }` tree from entry descriptions, with no disk IO.

- **D2 — Report spine: per-entry declared vs delivered verdict.**
  Files: `studio/src/report/build-news-report.ts` (new),
  `studio/src/report/build-news-report.test.ts` (new).
  Acceptance: `buildNewsReport({ index, documents, now, images? })` calls `resolveFeed()` then
  `filterAndSortSlides()`; every index row yields one `EntryVerdict` naming its declared and
  delivered template or `'dropped'`; a dropped entry carries the pipeline's own reason (missing
  title, empty body, unparseable frontmatter, index row without `id`/`file`, duplicate `id`) at
  severity `error`; index-level warnings land in the report-level `findings`; every finding carries
  `source: 'pipeline'`. Plus the summary counts (delivered as declared / fallen back / dropped /
  findings per severity).

- **D3 — Template fallback explained.**
  Files: `studio/src/report/template-verdict.ts` (new),
  `studio/src/report/template-verdict.test.ts` (new), wired into `build-news-report.ts`.
  Acceptance: a `split`/`cover` falling back to `text` is reported at `warning` naming the declared
  `image` value, or stating that none was declared; an unknown `template` value is reported as a
  fallback to `text` at `warning`, never `error`; when `images` is supplied, a declared image path
  absent from it adds a finding with `source: 'studio'` that explicitly does **not** claim a
  template fallback.

- **D4 — Per-button kept/dropped verdicts.**
  Files: `studio/src/report/button-verdicts.ts` (new),
  `studio/src/report/button-verdicts.test.ts` (new), wired into `build-news-report.ts`.
  Acceptance: every declared button appears once as kept or dropped; a dropped one names the
  pipeline's reason — off-allowlist host (with the url), missing label/url, or beyond the cap of
  three; the filter-then-cap order of `sanitizeButtons()` is reproduced (five buttons, two
  off-allowlist ⇒ three kept, not one).

- **D5 — Visibility and order verdicts.**
  Files: `studio/src/report/visibility-order.ts` (new),
  `studio/src/report/visibility-order.test.ts` (new), wired into `build-news-report.ts`.
  Acceptance: each entry is `published`, `scheduled` (with its `visibleFrom`) or `expired` (with its
  `visibleUntil`) at severity `info`, decided by presence in the filtered list against the supplied
  `now` and never against the wall clock; the delivered position is reported per entry; two entries
  sharing an `order` value are flagged with the index-order tie-break naming which comes first;
  entries without a usable `order` are reported with the pipeline's "sorts after the ordered ones".

## Model Hints

- D1 → default
- D2 → default
- D3 → default
- **D4 → `deliverable-hard`** — pairing declared buttons with the pipeline's positional warning
  stream is the one piece of real cross-module inference here: `sanitizeButtons()` emits one warning
  per rejected candidate but nothing at all for the buttons the cap silently cuts, so a naive zip
  mislabels which button was dropped and why.
- D5 → default
- **Review: → `story-review-hard`** — AC8 is the story's whole discipline and it fails silently: an
  implementation that re-checks a host allowlist or a visibility window itself still produces green
  tests, and only a reviewer reading the diff against the mirror catches that a verdict was decided
  instead of classified.

## Acceptance Tests

All criteria are core-logic criteria on a library with no user surface (the surface is 012's command
and S04/S05's UI), so they are proven with `npm run test` (vitest) rather than the `e2e` harness —
per the profile's rule for criteria without a surface. No manual residue.

- AC1 → unit `studio/src/report/build-news-report.test.ts` › "every index row gets a declared and a
  delivered template" (D2)
- AC2 → unit `studio/src/report/template-verdict.test.ts` › "a cover without a usable image falls
  back to text and names the declared image path" (D3)
- AC3 → unit `studio/src/report/template-verdict.test.ts` › "an unknown template value is a warning,
  not an error" (D3)
- AC4 → unit `studio/src/report/build-news-report.test.ts` › "a dropped entry names the rule that
  dropped it" (D2), covering missing title, empty body, unparseable frontmatter, an index row
  without `id`/`file`, and a duplicate `id`
- AC5 → unit `studio/src/report/button-verdicts.test.ts` › "every declared button is reported as kept
  or dropped with its reason" (D4)
- AC6 → unit `studio/src/report/visibility-order.test.ts` › "visibility is published, scheduled or
  expired against the supplied clock" (D5)
- AC7 → unit `studio/src/report/visibility-order.test.ts` › "two entries sharing an order value are
  flagged with the tie-break" (D5)
- AC8 → unit `studio/src/report/classify-warning.test.ts` › "an unrecognised pipeline warning is
  passed through, never swallowed" (D1) and
  `studio/src/report/build-news-report.test.ts` › "every verdict traces to a pipeline warning or a
  pipeline slide" (D2), asserting that no finding with `source: 'pipeline'` exists that the
  pipeline's `warnings` array did not produce

## Done

<Filled by `/build 011`.>
