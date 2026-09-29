---
id: 019
title: Preview width switcher
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A slide does not have one appearance. The launcher's window starts at a minimum width of 940 pixels,
defaults to 1280 and is routinely dragged out to 1920, and the templates behave differently across
that range — the `cover` template in particular anchors its image to the right edge and loses area
on the left as the hero narrows, which is exactly where the author put the text.

An author who only ever sees one width will publish an image whose subject is cropped out of
existence on somebody else's monitor.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-17.

## Acceptance Criteria

- [ ] **AC1** — The preview can be switched between 940, 1280 and 1920 pixels wide.
- [ ] **AC2** — Switching changes the preview's real viewport width: the content re-lays out, it is
      not a scaled-down picture of a wider rendering.
- [ ] **AC3** — The current width is labelled, including which one is the launcher's minimum and
      which its default.
- [ ] **AC4** — A `cover` entry visibly loses image area on its left between 1920 and 940, matching
      the launcher's own right-anchoring behaviour.
- [ ] **AC5** — A preview wider than the studio window remains fully inspectable rather than being
      clipped out of reach.
- [ ] **AC6** — The selected width persists while the author switches between entries.

## Open Questions

- ~~Is a free-form width — a drag handle or a number field — worth having in addition to the three
  fixed steps? The fixed steps match what the launcher tests; a handle catches what lies between
  them.~~ answered → Decisions (Sprint)
- ~~Does the preview height matter as well? The hero is a fixed height in the launcher, in which case
  only width carries meaning.~~ answered → Decisions (Sprint)
- ~~Should the studio be able to show two widths side by side, which is how a cropping problem
  actually becomes obvious?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **Fixed steps only, no free-form width:** the three widths are what the ACs, CS-17 and the
  launcher's own measurements name, and a handle is speculative scope nobody asked for.
- **Width only, height untouched:** the mirrored hero is a fixed height (`h-80`) with no width or
  height media queries in `home-hero.css`, so the iframe keeps whatever height story 018 gives it.
- **One width at a time, no side-by-side view:** no AC asks for it and quick switching already
  exposes the crop; it is a candidate follow-up story, not part of this one.
- **The selected width is the iframe's viewport width:** AC1/AC2 ask for the preview's real
  viewport to be N px, and the launcher's window chrome around the hero is not part of the mirror,
  so the studio does not invent an inset for it (the kit README's measured crop fractions at a
  940 px *window* will therefore be slightly stricter than the preview at 940 — noted for the sprint
  review, not solved here).
- **Default width is 1280:** it is the launcher's own default window width.
- **Widths are hardcoded in the studio (940 / 1280 / 1920) with their launcher meaning:** the
  launcher's `WINDOW_MIN_WIDTH` / default constants are not in the mirrored file set, and adding a
  file to the mirror is a launcher-side change outside this story.
- **Wider-than-window previews scroll horizontally, never scale:** AC2 forbids a scaled picture,
  so the only way to keep a 1920 px viewport inspectable in a narrower studio (AC5) is a scroll
  container.
- **The width lives in a studio-level context, in memory only:** AC6 asks for persistence across
  entry switches, not across reloads, and a context above the preview survives the preview
  remounting for a different entry.

## Plan

Story 018 delivers the iframe preview of the selected entry. This story adds a three-step width
control above it and makes the iframe's viewport that many pixels wide.

1. `studio/src/preview/preview-widths.ts` — the three widths with their labels (minimum /
   default), the default `1280`.
2. `studio/src/context/preview-width-context.tsx` — provider + hook holding the selected width,
   mirroring `current-entry-context.tsx`; mounted in `StudioPage.tsx` next to
   `CurrentEntryProvider`, so switching entries never resets it.
3. `studio/src/molecules/preview/PreviewWidthSwitcher.tsx` — a labelled button group
   (`aria-pressed`) plus a readout of the current width and its launcher meaning.
4. 018's preview organism: render the switcher, wrap the iframe in a horizontally scrolling
   container, set the iframe's `width` and `min-width` to the selected px (no transform).
5. e2e `studio/e2e/preview-width.spec.ts` against the repository's own `news/` (unstubbed): switch,
   real viewport, labels, scroll reach, persistence (D1); cover left-crop between 1920 and 940 (D2).

Order: D1, then D2 (D2 only adds a test on top of D1's mechanism).

## Deliverables

- **D1 — Width switcher on the preview, with a real viewport and scroll reach** (AC1, AC2, AC3,
  AC5, AC6)
  - Read first: `/frontend-guidelines` and `/design-tokens` (studio rules: atomic layers, semantic
    tokens only — no raw palette classes or hex values, visible focus state, touch target floor).
    Never edit anything under `studio/src/launcher-core/`.
  - New `studio/src/preview/preview-widths.ts`: `PREVIEW_WIDTHS` =
    `[{ px: 940, note: 'launcher minimum' }, { px: 1280, note: 'launcher default' }, { px: 1920 }]`
    and `DEFAULT_PREVIEW_WIDTH = 1280`; a comment names the source (launcher window minimum 940,
    default 1280, commonly maximised to 1920 — see `news/_templates/cover/README.md`).
  - New `studio/src/context/preview-width-context.tsx`: `PreviewWidthProvider` +
    `usePreviewWidth()` (`{ width, setWidth }`), in-memory `useState` initialised to
    `DEFAULT_PREVIEW_WIDTH`. Mirror `studio/src/context/current-entry-context.tsx`. Mount it in
    `studio/src/pages/studio/StudioPage.tsx` alongside `CurrentEntryProvider`, so the width survives
    switching entries and the preview remounting.
  - New `studio/src/molecules/preview/PreviewWidthSwitcher.tsx`: a `role="group"` with accessible
    name "Preview width", one `<button aria-pressed>` per width whose accessible name contains the
    px value and its note (e.g. "940 px — launcher minimum", "1280 px — launcher default",
    "1920 px"), plus a visible readout `data-testid="preview-width-current"` reading e.g.
    "1280 px (launcher default)".
  - Edit story 018's preview organism — the component that renders the preview `<iframe>` (look
    under `studio/src/organisms/preview/`; `git log --oneline -- studio/src/organisms` names 018's
    commit): render the switcher above the frame; wrap the iframe in a container with
    `overflow-x: auto` and `max-width: 100%`; give the iframe `width` **and** `min-width` of the
    selected px (so no flex/grid parent can shrink it) and no `transform`/`zoom`. Keep the height
    018 set. Adjust 018's own tests only if they assert the iframe's width.
  - Tests in new `studio/e2e/preview-width.spec.ts` (import `test`/`expect` from
    `./fixtures/localhost-only`; run unstubbed against the repository's own `news/`, reading entry
    ids/titles from `news/index.json` the way `studio/e2e/library-view.spec.ts` does; default
    Playwright viewport 1280×720):
    - "the preview switches between 940, 1280 and 1920 pixels wide" — for each button: click it,
      the iframe element's `getBoundingClientRect().width` in the studio page equals the px value.
    - "switching the width changes the preview's real viewport, not its scale" — per width: inside
      the frame `document.documentElement.clientWidth` equals the px value, the rendered slide
      root's bounding width equals it too, and the iframe's computed `transform` is `none`.
    - "the width control names the launcher's minimum and default and shows the current width" —
      the three buttons are found by their names above; exactly one is `aria-pressed="true"`
      (1280 initially); after selecting 1920 the readout reads "1920 px".
    - "a preview wider than the studio window can be scrolled into full view" — select 1920; the
      scroll container's `scrollWidth` ≥ 1920 > its `clientWidth`; after scrolling it to the end the
      iframe's right edge is ≤ the container's right edge, and at `scrollLeft = 0` its left edge is
      ≥ the container's left edge.
    - "the selected width persists while switching entries" — select 940, select a different entry
      in the library, the 940 button is still pressed and the iframe is still 940 px wide.

- **D2 — Proof that a `cover` loses image area on its left as the preview narrows** (AC4)
  - No production code expected; if the test fails, the fix lies in D1's viewport wiring, never in
    `studio/src/launcher-core/`.
  - Add to `studio/e2e/preview-width.spec.ts` (from D1) the test "a cover entry loses image area
    on its left between 1920 and 940": pick the repository's own `cover` entry by reading
    `template:` from the `news/*.md` files listed in `news/index.json` (currently
    `2026-09-12-welcome-to-the-community.md`, image 2560×640), select it in the library, wait for
    the frame's `img.home-hero-cover-image` to be `complete`. At 1920 and at 940, measure inside the
    frame: box `w,h` from `getBoundingClientRect()`, `naturalWidth/naturalHeight`, computed
    `object-fit` and `object-position`. Assert `object-fit` is `cover` and the horizontal
    `object-position` is `100%` (right edge anchored — all horizontal overflow falls on the left);
    compute the visible width fraction `min(1, (w/h) / (naturalWidth/naturalHeight))` from those
    measured values; assert the fraction at 940 is strictly smaller than at 1920 and below 1.

## Model Hints

- D1 → default
- D2 → default
- Review: → default — every AC is checked through the real surface with measured browser values
  (a scaled-down iframe fails the bounding-width and inner-clientWidth pair), so there is no
  plausible wrong implementation left that the tests and a default review would both miss.

## Acceptance Tests

- AC1 → e2e `studio/e2e/preview-width.spec.ts` › "the preview switches between 940, 1280 and 1920 pixels wide"
- AC2 → e2e `studio/e2e/preview-width.spec.ts` › "switching the width changes the preview's real viewport, not its scale"
- AC3 → e2e `studio/e2e/preview-width.spec.ts` › "the width control names the launcher's minimum and default and shows the current width"
- AC4 → e2e `studio/e2e/preview-width.spec.ts` › "a cover entry loses image area on its left between 1920 and 940"
- AC5 → e2e `studio/e2e/preview-width.spec.ts` › "a preview wider than the studio window can be scrolled into full view"
- AC6 → e2e `studio/e2e/preview-width.spec.ts` › "the selected width persists while switching entries"

## Done

<Filled by `/build 019`.>
