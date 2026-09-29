---
id: 018
title: Slide preview of the selected entry
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the thing the author actually wanted: the post, on screen, as the launcher will show it,
while it is still being written.

Story 008 proved the mirrored components render. This story puts them in front of the author,
driven by the entry they selected in the library, inside a document of their own — because a
preview that inherits the studio's own styling is no longer evidence of anything.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-16, section 4.

## Acceptance Criteria

- [x] **AC1** — The selected entry renders with the mirrored slide components inside an iframe.
- [x] **AC2** — The preview renders the **delivered** form: an entry that falls back to `text`
      previews as `text`, not as the template that was declared.
- [x] **AC3** — No studio chrome style affects the preview, and no mirrored hero style affects the
      studio chrome — proven by a test, not by looking at it.
- [x] **AC4** — An entry's image is displayed, loaded from `news/img/` through the file bridge.
- [x] **AC5** — An entry's buttons render, showing only the ones the launcher would keep.
- [x] **AC6** — An entry the launcher would drop shows an explicit "nothing would be shown" state
      with the reason, rather than an empty frame.
- [x] **AC7** — Changing the selected entry updates the preview without a page reload.

## Open Questions

- ~~Does the preview show one slide, or the whole carousel with its rotation and dots? One slide is
  what an author is working on; the carousel is what a user will actually see, including how this
  post sits next to the others.~~ answered → Decisions (Sprint)
- ~~The launcher renders body copy from markdown. Which markdown features does it actually support,
  and does the preview have to match that exactly to be honest?~~ answered → Decisions (Sprint)
- ~~Should the preview have a background matching the launcher's home screen around the slide, so the
  slide is seen in the context it will live in?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Preview scope: shows ONE slide (delivered form, in an iframe), not the carousel
- Markdown: the preview renders none, because the launcher renders none either: every mirrored
  template renders the body as a plain string child (`<p className="home-hero-body">{slide.body}</p>`),
  and the mirrored `home-hero.css` says "Plain text only (no markdown)". This also answers 023.
- Context around the slide: only the hero shell, not the home screen. The slide's layout depends on
  the hero's fixed height and stage inset. The rest of the home screen is not mirrored, and
  hand-building it would break the concept's "the studio never becomes the renderer" non-goal.
- The hero shell is three wrapper elements carrying the launcher's exact class lists, copied from
  `q2-launcher` `src/renderer/src/modules/home/NewsHero.tsx` (section `home-hero h-80 shrink-0
  border-b border-line bg-panel` → `home-hero-stage` → `home-hero-frame`). `home-hero-frame-enter`
  is left out because it is the carousel's slide-change animation. Only the markup is copied; no
  studio CSS rule is added.
- The delivered slide comes from the mirrored `resolveFeed()` (through
  `src/contract/launcher-contract.ts`), run over the same read the report was built from. It is never
  rebuilt from `declared`, because that would re-implement the pipeline's text fallback (image
  stripped, fields re-parsed) outside the mirror.
- The report's shape stays untouched (no slide field on `DeliveredEntry`), because
  `format-json.ts` copies `entries` verbatim into `npm run validate`'s JSON output.
- The preview sets `imageUrl` only when the slide's `image` is among the read's `images` (the same
  comparison `buildDeclaredImageMissingFinding` makes). That matches the launcher's image step
  ("not on disk → no `imageUrl`"). The mirrored templates then render their own no-image layout, and
  the missing file is already a `declared-image-missing` finding.
- Buttons are the pipeline's delivered `buttons` as they are, with no studio-side filter, because
  the pipeline's `sanitizeButtons` is what the launcher keeps.
- The "nothing would be shown" state covers every entry the launcher shows nothing for right now:
  - dropped: the reason is the entry's error findings;
  - scheduled or expired: the reason is its visibility date;
  - a selected draft or an id with no verdict: a "not in `news/index.json`" reason, until 020.

  Previewing a scheduled entry's slide would be a lie, and 021 adds its override on top of this
  state.
- The nothing state is studio chrome, rendered in place of the frame, because it is the studio's
  statement, not launcher rendering. The iframe stays mounted but hidden, so switching entries
  never reloads the frame document.
- The frame is its own Vite HTML entry (`studio/preview-frame.html`), updated by `postMessage` with
  a ready handshake, rather than `srcdoc` or a portal. A separate document means Vite injects the
  mirrored CSS only there, and messaging keeps AC7 reload-free and 019's viewport real.
- The frame's scripts live in `src/mirror-runtime/`, the ESLint rendering door onto the mirror, so
  no new lint exemption is needed. The message protocol lives in `src/preview/` and imports no CSS.
- `preview-frame.html` is added to Vite's build inputs next to `index.html`, so `npm run build`
  compiles the frame and the built app never points at a missing page.
- Frame size in this story is 1280 × 320 px (the launcher's default window width and the hero's
  height), in a horizontally scrolling container. 019 owns switching the width, so the width is one
  exported constant.
- The preview region sits above the library/validation row, because that is the only place wide
  enough for a 1280 px frame (and later 1920 px).
- Slide buttons in the preview are inert (`onOpenUrl` is a no-op), so the preview never navigates.
- e2e setup: AC1, AC4 and AC7 run unstubbed against the real `news/`, which has four entries, three
  of them with images. AC2, AC5 and AC6 stub `GET /__studio/fs/read` the way 016 does, because the
  real feed has no fallback, filtered-button or dropped entry.

## Plan

Build order: D1 → D2 → D3 → D4. The work is read-only; there are no writes and no bridge changes.

1. **Preview model (D1).** A pure `buildSlidePreviewModel({ read, report, entryId })` returns one of
   three states: `idle`, `slide` (the pipeline's own `NewsSlide` plus `imageUrl`) or `nothing`
   (with a reason). `useNewsLibrary` also exposes the `read` it already holds, and `descriptors.ts`
   exports its `toNewsReportInput` adaptation so the model and the report share one input.
2. **Frame document (D2).** Adds `studio/preview-frame.html` and a mount script in
   `src/mirror-runtime/`. The script imports `mirrorStyles`, renders the hero shell plus
   `TEMPLATE_COMPONENTS[resolveSlideTemplate(slide)]` (the map is extracted from `mirrorCheck.tsx`),
   posts `ready` to its parent and renders each same-origin `render` message from the parent. The
   protocol types and guards live in `src/preview/preview-protocol.ts`.
3. **Preview organism (D3).** `SlidePreview` keeps one iframe mounted. It posts the current slide
   on every `ready` and on every model change, and shows the idle or nothing notice in chrome while
   the frame is hidden.
4. **Wiring + e2e (D4).** `NewsLibrary` in `StudioPage.tsx` builds the model from the hook's `read`
   and `report` plus `currentEntryId`, and renders `SlidePreview` above the existing row. The e2e
   spec and a stubbed feed fixture prove AC1–AC7 through the real surface.

Affected: `studio/src/preview/` (new), `studio/src/mirror-runtime/`, `studio/preview-frame.html`,
`studio/vite.config.ts`, `studio/src/library/use-news-library.ts`,
`studio/src/content-types/descriptors.ts`, `studio/src/organisms/preview/` (new),
`studio/src/pages/studio/StudioPage.tsx`, `studio/e2e/`. Nothing under `src/launcher-core/` changes,
and `npm run check:drift` stays green.

Not in this story: width switching (019), draft preview (020), the visibility override (021), and
the carousel.

## Deliverables

- [x] **D1 — The preview model (pure) (AC2, AC4, AC5, AC6).**
  Files:
  - new `studio/src/preview/preview-model.ts` and `studio/src/preview/preview-model.test.ts`;
  - `studio/src/library/use-news-library.ts` and `studio/src/library/use-news-library.test.ts`
    (additive `read: ContentSourceRead | null` on the result, `null` while loading or unbound);
  - `studio/src/content-types/descriptors.ts` (export the existing `toNewsReportInput`, unchanged).

  Pattern to mirror: `studio/src/library/library-model.ts` (pure, data in and data out, never
  throws).

  Exports
  `type SlidePreviewModel = { state: 'idle' } | { state: 'slide'; slide: NewsSlide } | { state: 'nothing'; reason: string }`
  and `buildSlidePreviewModel({ read, report, entryId })`. Import `resolveFeed` and `NewsSlide` only
  from `studio/src/contract/launcher-contract.ts`, because ESLint forbids importing
  `launcher-core/` directly.

  Rules, in this order:
  1. `entryId`, `read` or `report` is `null` → `idle`.
  2. No `EntryVerdict` with that id (for example a draft) → `nothing`, with the reason "Not in
     news/index.json — the launcher does not show it."
  3. The first verdict with that id has `delivered === 'dropped'` → `nothing`. The reason is that
     verdict's `error`-severity finding messages, joined with "; ". Fall back to "The launcher drops
     this entry." if there are none.
  4. `visibility.state` is `scheduled` → `nothing`, "Scheduled — the launcher shows it from
     <visibleFrom>." `expired` → `nothing`, "Expired — the launcher stopped showing it at
     <visibleUntil>."
  5. Otherwise, take the slide with that id from the `slides` returned by
     `resolveFeed({ index, documents })`, with `index` and `documents` taken from
     `toNewsReportInput(read, …)` (`resolveFeed` reads no clock). Add `imageUrl` only when `slide.image` equals the `name` of an entry in `read.images`.
     The URL is `newsImageUrl()` of the image's final path segment; a throw means no `imageUrl`. The
     same logic as `thumbnailUrlFor` in `use-news-library.ts` — export and reuse it rather than
     copying it.

  Never rebuild a slide from `declared`.

  Tests in `preview-model.test.ts` use inline index/document fixtures (pattern:
  `studio/src/report/__fixtures__/news-tree.ts`):
  - "the previewed slide is the pipeline's own resolved slide": `toEqual` against
    `resolveFeed(...).slides.find(...)` plus `imageUrl`, with a title carrying surrounding
    whitespace;
  - "a cover without an image previews as text";
  - "buttons are the pipeline's delivered buttons": 4 declared, one off-allowlist → 3;
  - "an image absent from the repository yields no imageUrl";
  - "a dropped entry yields nothing with its reason";
  - "a scheduled or expired entry yields nothing with its date";
  - "an id without a verdict yields nothing".

  *Accepted when:* all of these pass and `npm run typecheck` is clean.

- [x] **D2 — The frame document (AC1, AC3 static side).**
  Files:
  - new `studio/preview-frame.html` (pattern: `studio/mirror-check.html`, root
    `#preview-frame-root`);
  - new `studio/src/mirror-runtime/previewFrame.tsx` (mount script; imports `./mirrorStyles`, never
    `src/styles/index.css`);
  - new `studio/src/mirror-runtime/PreviewFrameApp.tsx` and its test
    `studio/src/mirror-runtime/PreviewFrameApp.test.tsx`;
  - new `studio/src/mirror-runtime/slideTemplates.ts` (the `TEMPLATE_COMPONENTS` map moved out of
    `studio/src/mirror-runtime/mirrorCheck.tsx`, which then imports it);
  - new `studio/src/preview/preview-protocol.ts`;
  - `studio/vite.config.ts` (`build.rollupOptions.input`: `index.html` + `preview-frame.html`).

  The protocol module:
  - exports `PREVIEW_FRAME_PATH = '/preview-frame.html'`;
  - defines message types `{ type: 'q2-preview:ready' }` (frame → parent) and
    `{ type: 'q2-preview:render'; slide: NewsSlide }` (parent → frame);
  - has type guards `isReadyMessage` and `isRenderMessage`;
  - imports only types from `studio/src/contract/launcher-contract.ts`, and no CSS.

  `PreviewFrameApp`:
  - on mount, posts `ready` to `window.parent` with `targetOrigin` `window.location.origin`;
  - accepts a `render` message only when `event.source === window.parent` and
    `event.origin === window.location.origin`;
  - renders `<section className="home-hero h-80 shrink-0 border-b border-line bg-panel"><div
    className="home-hero-stage"><div className="home-hero-frame" data-testid="preview-frame-slide">`
    around `TEMPLATE_COMPONENTS[resolveSlideTemplate(slide)]`, with `onOpenUrl` a no-op. These
    class lists are copied from launcher `NewsHero.tsx` — cite it in a comment; leave out
    `home-hero-frame-enter`;
  - renders nothing before the first message;
  - adds no studio CSS, inline style or token.

  Tests (jsdom, dispatching `MessageEvent`s on `window`):
  - "the frame posts ready to its parent on mount";
  - "a render message from the parent renders the mirrored template inside the hero shell"
    (`.home-hero > .home-hero-stage > .home-hero-frame > .home-hero-slide-<template>`);
  - "a message from another origin or source is ignored".

  *Accepted when:* the tests pass, `npm run build` emits the frame page,
  `studio/e2e/mirrored-rendering.spec.ts` still passes after the map extraction, and
  `npm run check:drift` passes.

- [x] **D3 — The `SlidePreview` organism (AC6, AC7 mechanics).**
  Files: new `studio/src/organisms/preview/SlidePreview.tsx` and
  `studio/src/organisms/preview/SlidePreview.test.tsx`.

  Patterns to mirror:
  - `studio/src/organisms/ValidationPanel.tsx` (presentational, data via props);
  - `/design-tokens` semantic tokens only, with no hex value or raw palette class.

  Props: `{ model: SlidePreviewModel }`. Exports `PREVIEW_WIDTH_PX = 1280` and
  `HERO_HEIGHT_PX = 320`.

  Renders:
  - one `<iframe title="Slide preview" src={PREVIEW_FRAME_PATH}>` at those pixel sizes, inside an
    `overflow-x-auto` container. The iframe is **always mounted** and gets the `hidden` attribute
    unless the state is `slide`; it must never be keyed or unmounted by the state;
  - for `idle`, a notice "Select an entry to preview it.";
  - for `nothing`, a `role="status"` notice with the heading "Nothing would be shown" and the
    reason.

  Messaging:
  - A `message` listener on `window` accepts `ready` only when
    `event.source === iframe.contentWindow` and `event.origin === window.location.origin`.
  - On every such `ready`, and on every change of `model` while the frame is ready, post
    `{ type: 'q2-preview:render', slide }` to `iframe.contentWindow` with `targetOrigin`
    `window.location.origin`.
  - The latest slide is kept in a ref, so a `ready` that arrives after a model change still gets
    the current slide. Clean up the listener on unmount; it must also be correct under StrictMode's
    double effects.

  Tests (jsdom; spy on `iframe.contentWindow.postMessage`, simulate `ready` by dispatching a
  `MessageEvent` with `source: iframe.contentWindow`):
  - "nothing is posted before the frame is ready";
  - "the current slide is posted on ready";
  - "a new model is posted without remounting the iframe" (same element before and after a
    rerender);
  - "a ready from another source is ignored";
  - "the nothing state shows its reason and hides the frame";
  - "the idle state asks for a selection".

  *Accepted when:* all of these pass and lint is clean.

- [x] **D4 — Wiring and the e2e proof (AC1–AC7).**
  Files:
  - `studio/src/pages/studio/StudioPage.tsx` and `studio/src/pages/studio/StudioPage.test.tsx`;
  - new `studio/e2e/slide-preview.spec.ts`;
  - new `studio/e2e/fixtures/preview-feed.ts`.

  Patterns to mirror: `studio/e2e/library-view.spec.ts` (imports `test`/`expect` from
  `./fixtures/localhost-only`) and `studio/e2e/fixtures/library-feed.ts` (a `page.route` stub of
  `**/__studio/fs/read*` with the same read-response shape).

  Wiring: `NewsLibrary` takes `read` from `useNewsLibrary`. It computes
  `buildSlidePreviewModel({ read, report, entryId: currentEntryId })` and renders
  `<SlidePreview model=… />` above the existing library/validation `flex` row, wrapping both in a
  `flex flex-col gap-8`.

  `StudioPage.test.tsx` gains "the slide preview region renders beside the library".

  The fixture stubs a feed with four entries:
  - a published `text` entry;
  - a `cover` with no `image:` line (it falls back to `text`);
  - an entry with four buttons, one on `https://example.com/…` (off-allowlist) and three on
    `github.com`;
  - a dropped entry: an unknown template with no title and no body.

  e2e tests (use `page.frameLocator('iframe[title="Slide preview"]')`):
  - "the selected entry renders with the mirrored slide components inside an iframe" (unstubbed:
    select the real split entry; the frame shows `.home-hero-slide-split` and its title);
  - "an entry that falls back to text previews as text, not as its declared template" (stubbed:
    `.home-hero-slide-text` present, `.home-hero-slide-cover` absent);
  - "no studio chrome style reaches the preview and no mirrored style reaches the studio chrome":
    - no `style[data-vite-dev-id]` in the frame ends with `/src/styles/index.css`, and at least one
      in the frame contains `/launcher-core/`;
    - none in the parent contains `/launcher-core/`;
    - every custom property that the mirrored `renderer/src/styles/index.css` defines (read at test
      time) computes empty on the parent's `documentElement`;
    - the frame's `.home-hero` computes to 320px tall;
  - "an entry's image loads from news/img through the file bridge" (unstubbed cover entry: the
    frame's `img` `src` starts with `/news-img/` and `naturalWidth > 0`);
  - "only the buttons the launcher would keep are rendered" (stubbed: three buttons, and the
    `example.com` one's label is absent);
  - "an entry the launcher would drop shows why nothing would be shown" (stubbed: the status
    notice shows "Nothing would be shown" plus the reason, and the iframe is hidden);
  - "changing the selected entry updates the preview without a reload" (unstubbed: set a marker on
    `window` in both the page and the frame, then select a second entry. The frame shows its
    title, and both markers still exist).

  *Accepted when:* `npm run e2e --workspace studio -- studio/e2e/slide-preview.spec.ts` passes,
  and the existing `library-view.spec.ts` and `validation-panel.spec.ts` still pass.

## Model Hints

- D3 → `deliverable-hard`. The cross-document handshake fails silently: a render posted before the
  frame's listener exists is lost (the first selection shows an empty frame). A keyed or
  conditionally mounted iframe reloads its document on every switch, which breaks AC7. And a missing
  `event.source`/origin check lets any window drive the preview.
- D1, D2, D4 → default.
- Review: → default. The two quiet failure modes are covered by tests a default review sees:
  - a slide rebuilt from `declared` is caught by D1's `toEqual` against the pipeline's own slide;
  - style bleed is caught by D4's two-direction `data-vite-dev-id` and computed-style checks.

## Acceptance Tests

- AC1 → e2e `studio/e2e/slide-preview.spec.ts` › "the selected entry renders with the mirrored
  slide components inside an iframe" (D4), plus unit
  `studio/src/mirror-runtime/PreviewFrameApp.test.tsx` › "a render message from the parent renders
  the mirrored template inside the hero shell" (D2)
- AC2 → e2e `studio/e2e/slide-preview.spec.ts` › "an entry that falls back to text previews as text,
  not as its declared template" (D4), plus unit `studio/src/preview/preview-model.test.ts` › "the
  previewed slide is the pipeline's own resolved slide" and › "a cover without an image previews as
  text" (D1)
- AC3 → e2e `studio/e2e/slide-preview.spec.ts` › "no studio chrome style reaches the preview and no
  mirrored style reaches the studio chrome" (D4). The static guard
  `studio/tests/studioStylesheets.test.ts` from story 008 keeps running.
- AC4 → e2e `studio/e2e/slide-preview.spec.ts` › "an entry's image loads from news/img through the
  file bridge" (D4), plus unit `studio/src/preview/preview-model.test.ts` › "an image absent from the
  repository yields no imageUrl" (D1)
- AC5 → e2e `studio/e2e/slide-preview.spec.ts` › "only the buttons the launcher would keep are
  rendered" (D4), plus unit `studio/src/preview/preview-model.test.ts` › "buttons are the pipeline's
  delivered buttons" (D1)
- AC6 → e2e `studio/e2e/slide-preview.spec.ts` › "an entry the launcher would drop shows why nothing
  would be shown" (D4), plus unit `studio/src/preview/preview-model.test.ts` › "a dropped entry
  yields nothing with its reason" (D1) and `studio/src/organisms/preview/SlidePreview.test.tsx` ›
  "the nothing state shows its reason and hides the frame" (D3)
- AC7 → e2e `studio/e2e/slide-preview.spec.ts` › "changing the selected entry updates the preview
  without a reload" (D4), plus unit `studio/src/organisms/preview/SlidePreview.test.tsx` › "a new
  model is posted without remounting the iframe" (D3)

There is no manual residue. Every criterion runs through the real app, the real bridge and a real
browser. Only AC2, AC5 and AC6 fix the bridge's file bytes (see Decisions).

Coverage gate:

| AC | Deliverables | Tests |
| --- | --- | --- |
| AC1 | D2 + D3 + D4 | e2e + unit |
| AC2 | D1 + D4 | e2e + unit |
| AC3 | D2 + D4 | e2e |
| AC4 | D1 + D4 | e2e + unit |
| AC5 | D1 + D2 + D4 | e2e + unit |
| AC6 | D1 + D3 + D4 | e2e + unit |
| AC7 | D3 + D4 | e2e + unit |

Every criterion has a deliverable and a named test.

## Done

Adds the one-slide preview: pure `buildSlidePreviewModel` (idle / slide / nothing with reason), a separate Vite frame document (`preview-frame.html`) that renders the hero shell plus the mirrored template and is driven by a `postMessage` ready handshake, the always-mounted `SlidePreview` iframe organism, and its wiring above the library row in `StudioPage`. Drafts, width switching and the visibility override stay with 019-021.

Commit message: `018: slide preview of the selected entry (iframe frame document, handshake, nothing state)`

Verification (narrow gate): `npm run build`, `typecheck` green; `npm run test --workspace studio -- --changed HEAD` 107/107; `npm run e2e --workspace studio -- studio/e2e/slide-preview.spec.ts` 7/7 (library-view, validation-panel, mirrored-rendering specs also green in the deliverable runs). `npm run lint`: eslint green; `prettier --check .` red on ~165 files this story did not touch (pre-existing); story-touched files are prettier-clean. `npm run check:drift` reports 6 launcher-core files locally edited; git shows no change under `launcher-core/`, so it predates this story (not fixed here). Full gate pending (sprint's).
AC -> test as verified: AC1 e2e "the selected entry renders…" + PreviewFrameApp "a render message…"; AC2 e2e "falls back to text…" + preview-model tests; AC3 e2e "no studio chrome style reaches the preview…"; AC4 e2e "image loads from news/img…" + model test; AC5 e2e "only the buttons…" + model test; AC6 e2e "drops… shows why" + model and SlidePreview tests; AC7 e2e "changing the selected entry…" + SlidePreview "a new model is posted without remounting". All passed. No manual residue.
Review: default stage, PASS, 1 cycle, no fix cycle needed.

Decisions:
- Image lookup uses the bare file name of `verdict.declared.image` against `read.images[].name`, because the pipeline's resolved slide never carries the raw image path; the slide itself is still the pipeline's own plus `imageUrl`. Looser than the report's exact comparison for an `img/`-prefixed declaration (review F1, accepted).
- AC3 custom-property check: `--font-sans`, `--font-mono`, `--radius-xs/sm/md` are also defined by Tailwind's own theme on the parent, so for those five the test asserts the parent value differs from the mirrored value; every other mirrored property must compute empty. Parent/frame `data-vite-dev-id` checks are as planned (frame check excludes `/launcher-core/` ids since the mirrored sheet also ends in `/src/styles/index.css`).
- Ready state resets only on unmount, not on iframe `load` (ready can precede `load`).
- Unfixed review notes: F2 (model throw maps silently to idle), F4 (e2e asserts the AC6 reason non-empty, exact text covered by unit test), F5 (model rebuilt each render re-posts an identical slide; harmless), F6 (no `onLoad` fallback for a lost ready; unlikely).
- Prettier run over `mirror-runtime/` touched line endings only (no content diff).

tiers: D 4 / hard 1 · review default · cycles 0 · agents 6
