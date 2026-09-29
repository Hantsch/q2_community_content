---
id: 021
title: Preview an entry outside its visibility window
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A post written today for a release next month has `visibleFrom` set to next month. Every honest
preview of it therefore shows nothing at all, which is correct and completely useless to the person
writing it.

The same is true in the other direction: an expired entry is often exactly the one you want to look
at, because you are reusing it or working out why it stopped appearing.

The studio needs to be able to say "show me this as if it were visible" without lying about the
entry's real state.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-19.

## Acceptance Criteria

- [x] **AC1** — An entry with a `visibleFrom` in the future can be previewed as if it were visible.
- [x] **AC2** — An entry with a `visibleUntil` in the past can be previewed the same way.
- [x] **AC3** — While the override is active it is visibly an override, on the preview itself — it
      can never be mistaken for the entry's real state.
- [x] **AC4** — The override changes nothing in the repository.
- [x] **AC5** — The validation report keeps stating the entry's real visibility regardless of the
      override; the report and the preview never disagree about the facts.
- [x] **AC6** — With the override off, a scheduled or expired entry previews as what the launcher
      would show, which is nothing, with the reason stated.

## Open Questions

- ~~Is a simple on/off override enough, or should the studio offer a "preview as of &lt;date&gt;"
  clock? The clock is more work, but it answers a question the toggle cannot: what will the whole
  feed look like on release day, with entries ageing in and out around each other.~~ answered → Decisions (Sprint)
- ~~Does the override belong to the preview, or to the library — that is, should the library also be
  able to show the feed as of a chosen date?~~ answered → Decisions (Sprint)
- ~~Should the studio warn about an entry whose `visibleFrom` is *so* far in the future that it looks
  like a typo (a year out, for example)?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Visibility override: a simple on/off toggle in the preview only, no date clock
- The override lives in the preview only; the library, the validation panel and `npm run validate`
  never see it — this follows directly from the user's decision and is what makes AC5 structural.
- No "suspiciously far in the future" warning in this story — no AC asks for it, the concept's
  report section (§7) names no such rule, and any threshold would be an invented rule; it can
  become its own story if a walk-through shows the need.
- The toggle is offered only when the selected entry's real visibility (`EntryVerdict.visibility`)
  is `scheduled` or `expired` — for a published entry it would mean nothing, and a dropped entry
  has no slide to show.
- Drafts are out of scope — the ACs speak of index entries, and a draft's verdict is defined by
  story 020, built in parallel.
- The override is ephemeral React state in the preview: off by default, reset to off whenever the
  selected entry changes, never persisted — the honest view is always the one you land on (AC6),
  and nothing about it can reach the repository (AC4).
- Under the override the preview renders the pipeline's own resolved slide for that id (the
  pre-visibility-filter list from `resolveFeed()`), never a slide rebuilt from declared fields —
  the override may skip exactly one rule, the visibility window, and nothing else (a scheduled
  `split` without an image still previews as `text`).
- The override marker is studio chrome attached to the preview frame (outside the iframe), stating
  the real state in text, e.g. "Override — previewing as if visible. Real state: scheduled for
  <date>" — putting it inside the iframe would break story 018's isolation (its AC3), and text
  rather than colour alone keeps it unmistakable (design-tokens accessibility floor).
- The reason in the "nothing would be shown" state (AC6) and the real state in the marker (AC3)
  are the report's own scheduled/expired finding message for that entry, so preview and report
  literally quote the same fact (AC5).
- The preview uses the same `now` the report was built with; there is no second clock (AC5).

## Plan

Builds on story 018's slide preview (iframe, delivered form, "nothing would be shown" state) and
the report's existing visibility verdict (`studio/src/report/visibility-order.ts`,
`EntryVerdict.visibility`). No change to the report, the library model or `launcher-core/`.

1. **D1 — decision model (pure).** `studio/src/preview/visibility-override.ts`: given the selected
   entry's `EntryVerdict` and the override flag, answer whether the preview renders a slide or the
   "nothing would be shown" state, whether it is an override, and the reason/real-state text
   (the report's own scheduled/expired finding message). Unit-tested, including "the verdict is
   not modified".
2. **D2 — UI + wiring + e2e.** A toggle and an override marker attached to story 018's preview
   organism (outside the iframe), driven by D1; the slide shown under override is the pipeline's
   resolved slide for the id. Own e2e fixture with scheduled / expired / scheduled-fallback
   entries; e2e spec proves AC1–AC6 through the real app.

Order: D1 → D2. Frontend work follows `/frontend-guidelines` and `/design-tokens` (semantic
tokens, visible focus, accessible name, status not by colour alone).

## Deliverables

- **D1 — Visibility-override decision model.**
  New `studio/src/preview/visibility-override.ts` + `studio/src/preview/visibility-override.test.ts`
  (mirror the style of `studio/src/report/visibility-order.ts` and its test; fixtures from
  `studio/src/report/__fixtures__/news-tree.ts` via `buildNewsReport`).
  Export `decidePreviewVisibility(verdict: EntryVerdict, overrideOn: boolean)` returning a
  discriminated result:
  - `verdict.visibility.state === 'published'` → render slide, `override: false`,
    `overrideAvailable: false`.
  - `'scheduled'` / `'expired'`, override off → `hidden` with `reason` = the entry's own finding
    message of kind `scheduled` / `expired` from `verdict.findings` (verbatim, e.g.
    "not yet visible; scheduled for 2099-01-01T00:00:00Z"), `overrideAvailable: true`.
  - same, override on → render slide, `override: true`, `realState` = that same finding message.
  - `delivered === 'dropped'` / `'not-applicable'` → not handled here (`overrideAvailable: false`,
    defer to story 018's existing drop state); the override flag is ignored.
  Pure: no clock read, no IO, does not mutate `verdict`.
  Tests (names as listed): "a scheduled entry is hidden with the report's reason while the override
  is off", "an expired entry is hidden with the report's reason while the override is off",
  "with the override on a scheduled or expired entry renders and is marked as an override",
  "the override is not offered for published or dropped entries", "deciding the preview never
  modifies the verdict" (deep-equal snapshot before/after), "a scheduled split without an image is
  still delivered as text under the override" (built via `buildNewsReport` with a future
  `visibleFrom`: assert `verdict.delivered.template === 'text'` — the override uses that verdict
  and its resolved slide, not the declared template).

- **D2 — Override toggle and marker in the preview, plus its e2e.**
  Files: story 018's slide-preview organism (under `studio/src/organisms/`, the component that
  renders the selected entry's delivered slide in an iframe and its "nothing would be shown"
  state — find it in the code, it is not named here because 018 is built first); new
  `studio/src/organisms/preview/VisibilityOverrideControl.tsx` +
  `VisibilityOverrideControl.test.tsx`; new `studio/e2e/fixtures/visibility-override-feed.ts`
  (mirror `studio/e2e/fixtures/library-feed.ts`: `page.route('**/__studio/fs/read*')`, far-future
  `2099-01-01T00:00:00Z` / far-past `2000-01-01T00:00:00Z` dates); new
  `studio/e2e/visibility-override.spec.ts` (mirror `studio/e2e/library-view.spec.ts`, import
  `test`/`expect` from `./fixtures/localhost-only`).
  Behaviour:
  - The preview calls `decidePreviewVisibility` (D1) for the selected entry. Override state is
    local `useState(false)` in the preview, reset to `false` when `currentEntryId` changes; never
    written to storage, the URL, the bridge, or any context the library/validation panel reads.
  - `hidden` → story 018's "nothing would be shown" state, showing D1's `reason` text.
  - `overrideAvailable` → render `VisibilityOverrideControl`: a labelled switch/checkbox
    "Preview as if visible" (accessible name, visible focus, ≥ 44 px touch target, semantic tokens
    only).
  - `override: true` → render the slide in the iframe **and** a marker attached to the preview
    frame, outside the iframe document, with role `status` and text "Override — previewing as if
    visible. Real state: <D1 realState>"; not colour-only.
  - The slide rendered under override is the pipeline's resolved slide for that id
    (`resolveFeed()` output, before `filterAndSortSlides()`). If story 018's slide lookup only
    searches the delivered list, switch it to the resolved list; never construct a `NewsSlide`
    from `declared` fields.
  - The report, `useNewsLibrary`, `LibraryView` and `ValidationPanel` receive no override input.
  Fixture entries: one published `text`; `scheduled-entry` (`text`, `visibleFrom` far future);
  `expired-entry` (`text`, `visibleUntil` far past); `scheduled-fallback` (`template: split`, no
  image, `visibleFrom` far future — delivered as `text`).
  Component tests in `VisibilityOverrideControl.test.tsx`: "the switch has an accessible name and
  reports its state", "the override marker names the real state in text".
  E2E tests in `studio/e2e/visibility-override.spec.ts` (literal names — see Acceptance Tests):
  select entries by clicking their library row; read the slide via the preview iframe
  (`page.frameLocator`) the same way story 018's e2e does. The AC4 test records every request
  (`page.on('request')`) while toggling on/off and between entries and asserts none has a method
  other than `GET`, and that the repository's tracked `news/` files hash identically before and
  after (read with `node:fs`, as `library-view.spec.ts` reads `news/index.json`).

## Model Hints

- D1 → default
- D2 → default
- Review: → default — the plausible wrong implementations (feeding a shifted `now` into the report,
  rebuilding the slide from declared fields, putting the marker inside the iframe) are each caught
  by a named e2e or unit test below, so no second pass is needed.

## Acceptance Tests

- AC1 → e2e `studio/e2e/visibility-override.spec.ts` › "a scheduled entry previews as if visible with the override on"
  (also asserts `scheduled-fallback` previews as `text`); unit
  `studio/src/preview/visibility-override.test.ts` › "with the override on a scheduled or expired entry renders and is marked as an override"
- AC2 → e2e `studio/e2e/visibility-override.spec.ts` › "an expired entry previews as if visible with the override on"
- AC3 → e2e `studio/e2e/visibility-override.spec.ts` › "the override is marked on the preview and names the real state"
  (marker visible next to the frame, contains the real state, and is absent from the iframe
  document); component `studio/src/organisms/preview/VisibilityOverrideControl.test.tsx` › "the override marker names the real state in text"
- AC4 → e2e `studio/e2e/visibility-override.spec.ts` › "toggling the override writes nothing to the repository"
- AC5 → e2e `studio/e2e/visibility-override.spec.ts` › "the validation panel and library keep the real visibility while the override is on";
  unit `studio/src/preview/visibility-override.test.ts` › "deciding the preview never modifies the verdict"
- AC6 → e2e `studio/e2e/visibility-override.spec.ts` › "with the override off a scheduled or expired entry previews as nothing with the reason";
  unit `studio/src/preview/visibility-override.test.ts` › "a scheduled entry is hidden with the report's reason while the override is off"

Coverage gate: AC1 D1+D2 · AC2 D1+D2 · AC3 D2 · AC4 D2 · AC5 D1+D2 · AC6 D1+D2 — every criterion
has a deliverable and a named test; no manual residue.

## Done

Summary: `decidePreviewVisibility` (pure) decides render / hidden / deferred from the report's own verdict. The slide preview gets a "Preview as if visible" switch (scheduled/expired entries only) and a role=status marker outside the iframe naming the real state. Held slides come from `resolveFeed()` (pre-visibility-filter), so a scheduled split without image still shows as text.

Commit message: `021: visibility override in preview (toggle, marker outside frame, real state kept)`

Decisions:
- `preview-model.ts` `nothing` state gained an optional `held` ({verdict, slide}) for scheduled/expired entries, to carry the resolved slide; existing shape unchanged (needed by D2, not listed in Plan).
- D1 returns kind `deferred` for dropped/not-applicable, and also when a scheduled/expired verdict has no matching finding (no invented reason).
- Override state resets during render when the held entry id changes; the iframe stays mounted.
- Unfixed review notes (minor, no AC impact): SlidePreview falls back to `model.reason` in a practically unreachable branch; no unit test on `held` (covered by e2e); switch focus ring uses focus-within; no test compares preview `now` with report `now` (fixtures use 2099/2000).

Verification (narrow gate): build, typecheck green; `npm run test --workspace studio -- --changed HEAD` green; `npm run e2e --workspace studio -- e2e/visibility-override.spec.ts` 6/6 green. Lint: one eslint error in the new component test was fixed (eslint + prettier clean on all 021 files); repo-wide prettier failures on untouched files are pre-existing.
AC -> test, all passed: AC1 e2e "a scheduled entry previews as if visible with the override on" + unit; AC2 e2e "an expired entry ..."; AC3 e2e "the override is marked on the preview and names the real state" + component test; AC4 e2e "toggling the override writes nothing to the repository"; AC5 e2e "the validation panel and library keep the real visibility ..." + unit "never modifies the verdict"; AC6 e2e "with the override off ..." + unit. No manual residue. Review: default stage, PASS. Full gate pending (sprint).

tiers: D 2 / hard 0 · review default · cycles 0 · agents 5
