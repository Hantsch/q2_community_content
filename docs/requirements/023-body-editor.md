---
id: 023
title: Body editor with live preview
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The body is the post. Everything else is metadata about where and when it appears.

It is also the field with the least feedback today: an empty body drops the entry entirely, a body
that is too long for the template overflows or gets cut, and how markdown is rendered is decided
somewhere in the launcher. Writing it with the slide updating next to you is the difference between
writing a news post and filling in a form.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-21.

## Acceptance Criteria

- [ ] **AC1** — The body is editable as markdown, as plain text the author controls.
- [ ] **AC2** — The preview updates as the body changes, without a save and without a reload.
- [ ] **AC3** — An empty body is flagged as the drop cause it is, in the editor, not only in the
      report.
- [ ] **AC4** — The editor never inserts HTML, styling or layout into the body.
- [ ] **AC5** — Markdown the launcher does not render is flagged, so an author does not write
      something that will appear as literal characters on the slide.
- [ ] **AC6** — A body long enough to overflow its template is visible as such in the preview, at
      every preview width.

## Open Questions

- ~~Which markdown features does the launcher actually render? AC5 cannot be written honestly without
  that list, and it has to come from the launcher's renderer rather than from an assumption.~~
  answered → Decisions (Sprint)
- ~~Plain textarea, or an editor with a toolbar and shortcuts? The toolbar is friendlier for
  community contributors and is also the thing most likely to insert something the contract forbids.~~
  answered → Decisions (Sprint)
- ~~Is there a sensible length guideline per template, and if so is it a warning or just something the
  preview makes obvious?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **The launcher renders no markdown at all.** The mirrored slides put the body into a single
  `<p className="home-hero-body">{slide.body}</p>` (`launcher-core/src/renderer/src/modules/home/components/SlideText.tsx:23`,
  likewise `SlideSplit.tsx:32`, `SlideCover.tsx:29`, `SlideBanner.tsx:24`; `home-hero.css:283` says
  "Plain text only (no markdown)"), so every markdown construct appears as literal characters — this
  is the list AC5 is written against, taken from the renderer, and a drift-guard test pins it.
- **AC1 "editable as markdown" is read as "the body is the raw text the author types"**, because
  the renderer decides that the body is plain text and the criterion's own wording ("plain text the
  author controls") already says so.
- **Plain `<textarea>`, no toolbar, no shortcuts**, because there is no rendered formatting a toolbar
  could offer, and a textarea structurally cannot hold markup (AC4), whereas a `contenteditable`
  would accept pasted HTML.
- **No character-count length guideline**; overflow is measured in the rendered frame at the current
  width and shown as a warning, because the cut point depends on template and width (the cover
  content column is 45% capped at 560px, `home-hero.css:215-216`) and a fixed number would lie at
  some width.
- **Literal-markdown detection is a small hand-written, conservative line lint with no new
  dependency**, because the only question is "will these characters show literally" and a false
  positive costs a dismissible warning, not a blocked save.
- **Body findings never block editing or saving**; the empty body is an error-severity flag, the
  others are warnings, because 024 AC5 owns the "save an entry that will be dropped" confirmation.
- **"Empty" means empty after trimming**, because the mirrored `parseFrontmatter` trims the body
  (`frontmatter.ts:127`) before `body: z.string().min(1)` (`shared/modules/home.ts:259`) drops it.
- **The editor holds the raw body bytes after the frontmatter fence — no trimming or normalising**,
  because 024's round trip must be lossless and only the linter/preview apply the parser's trim.
- **Line-break collapse is not flagged**; the preview shows it truthfully through the mirrored
  component, and it is not a literal-character case (AC5).
- **The preview re-derives on every change, no debounce**, because resolving one document through
  the mirrored pipeline is cheap and a debounce would make AC2 flaky to observe.
- **Overflow = clamped (`scrollHeight > clientHeight`) or clipped by the fixed-height hero**, measured
  after `document.fonts.ready`, on every body change and every width change, because the body is cut
  by `-webkit-line-clamp: 4` inside a 320px `overflow: hidden` hero (`home-hero.css:279-289`, `:36`).
- **Findings and the overflow indicator live in studio chrome, outside the iframe**, because 018 AC3
  forbids studio styles inside the preview.

## Plan

Builds on 018 (preview iframe), 019 (width switcher) and 022 (entry working copy + editor panel).
No writes to disk (read-only until 024), no new dependencies, nothing under `launcher-core/`.

1. **Pure core (D1)** — `studio/src/editor/body-document.ts`: split a document into its verbatim
   frontmatter head and raw body, and re-join with a new body (head bytes untouched).
   `studio/src/editor/body-lint.ts`: `lintBody(body)` → findings: `empty-body` (error) and
   `literal-markdown` (warning, construct + line). A drift-guard test proves the mirrored slides
   render the body as plain text, so AC5's "flag everything" stays true after a re-sync.
2. **Component (D2)** — `BodyEditor` organism: a labelled `<textarea>` plus its findings list
   (`SeverityBadge`), controlled `value`/`onChange`, emits exactly what the textarea holds.
3. **Wiring (D3)** — add the body to 022's working copy, render `BodyEditor` in 022's editor panel,
   and feed 018's preview from the working document text so it follows every keystroke. e2e spec
   `e2e/body-editor.spec.ts` with a stubbed bridge fixture proves AC1–AC5 on the real surface.
4. **Overflow (D4)** — measure `.home-hero-body` inside the preview frame after fonts are ready and on
   every body/width change; show "Body is cut off at <width>px" in chrome next to the frame. e2e in
   `e2e/body-overflow.spec.ts` at 940/1280/1920, including a boundary body cut at 940 but not 1920.

Order: D1 → D2 → D3 → D4. Affected: `studio/src/editor/*`, `studio/src/organisms/editor/BodyEditor*`,
022's editor panel + working-copy module, 018's preview source hook, 018/019's preview frame
component, `studio/e2e/body-editor*.spec.ts`, `studio/e2e/fixtures/body-editor-feed.ts`.

## Deliverables

- **D1 — Body document split and body lint (pure, no UI).**
  Files: new `studio/src/editor/body-document.ts`, `studio/src/editor/body-lint.ts`, their tests
  `studio/src/editor/body-document.test.ts`, `studio/src/editor/body-lint.test.ts`, and
  `studio/src/editor/launcher-body-is-plain-text.test.tsx` (`// @vitest-environment jsdom`). Mirror the
  pure-module + colocated-test pattern of `studio/src/library/library-model.ts`.
  - `splitDocument(text): { head: string; body: string }` — `head` is everything up to and including
    the closing `---` fence line (and its line ending), byte-for-byte; `body` is the rest, untrimmed.
    A document without frontmatter has `head: ''`. Must agree with the mirrored `parseFrontmatter`
    (`studio/src/contract/launcher-contract.ts` re-export) on where the body starts: for every fixture,
    `parseFrontmatter(text).body === splitDocument(text).body.trim()`.
    `withBody(text, body): string` returns `head + body`; `withBody(t, splitDocument(t).body) === t`.
  - `lintBody(body): BodyFinding[]`, `BodyFinding = { code: 'empty-body' | 'literal-markdown';
    severity: 'error' | 'warning'; construct?: string; line?: number; message: string }`.
    `empty-body` when `body.trim() === ''` (whitespace-only included), message says the launcher drops
    the entry and shows nothing. `literal-markdown`, one per occurrence, for: bold/italic (`**x**`,
    `*x*`, `__x__`, `_x_`), strikethrough `~~x~~`, inline code `` `x` ``, fenced code ```` ``` ````,
    heading (`#` at line start), list item (`- `, `* `, `+ `, `1. ` at line start), blockquote (`> `),
    link `[t](u)`, image `![a](u)`, autolink `<https://…>`, HTML tag `<b>`/`</p>`, horizontal rule
    (`---`/`***` line), HTML entity (`&amp;`, `&#39;`). Message: "`<construct>` is not rendered by the
    launcher — these characters appear literally on the slide". Conservative: no finding for
    intraword underscores (`snake_case`), a lone `*` (`5 * 3`), or a plain `<` / `&` in prose.
  - Drift guard: render the mirrored `SlideText`, `SlideSplit`, `SlideCover`, `SlideBanner` (see
    `studio/src/mirror-runtime/mirroredSlides.test.tsx` for how they are rendered) with body
    `**bold** [l](https://x) <b>h</b>` and assert `.home-hero-body` has no element children and its
    `textContent` equals the body verbatim.
  - Acceptance: tests below pass; no file outside `studio/src/editor/` changes.
  - Tests: `body-lint.test.ts` › "an empty or whitespace-only body is flagged as the drop cause";
    `body-lint.test.ts` › "every markdown construct the launcher does not render is flagged with its
    line"; `body-lint.test.ts` › "plain prose with underscores, a lone asterisk and an ampersand is not
    flagged"; `body-document.test.ts` › "split and rejoin round-trips byte-for-byte and agrees with
    parseFrontmatter"; `launcher-body-is-plain-text.test.tsx` › "the mirrored slides render the body as
    plain text".

- **D2 — `BodyEditor` component.**
  Files: new `studio/src/organisms/editor/BodyEditor.tsx`, `studio/src/organisms/editor/BodyEditor.test.tsx`
  (`// @vitest-environment jsdom`, @testing-library/react). Mirror `studio/src/organisms/ValidationPanel.tsx`
  for list + `SeverityBadge` usage and `studio/src/styles/index.css` `@theme` tokens for colour (no raw
  palette classes, no hex; extend the existing `@theme` block only if a role is missing).
  - Props: `{ value: string; onChange(body: string): void }`. Renders a `<label>`led `<textarea>`
    (accessible name "Body", monospace not required, visible focus state) with `value` verbatim — no
    trim, no normalisation, no toolbar, no shortcuts, no `contenteditable`.
  - Below it, the findings from `lintBody(value)` (`studio/src/editor/body-lint.ts`, D1) as a list:
    `SeverityBadge` + message + "line N" where present; the textarea's `aria-describedby` points at the
    list; `aria-invalid` when an `empty-body` finding is present. Test ids: `body-editor`,
    `body-finding` (one per finding, `data-code` = finding code).
  - `onChange` receives exactly `event.target.value`.
  - Tests: `BodyEditor.test.tsx` › "the body editor is a plain textarea that emits exactly what was
    typed"; `BodyEditor.test.tsx` › "an empty body shows the drop-cause error on the field".

- **D3 — Wire the body into the working copy and the live preview, plus its e2e.**
  Files: 022's working-copy module and editor panel (find them from 022's frontmatter editor organism
  under `studio/src/organisms/editor/`), 018's preview-source hook (the code that turns the selected
  entry's document text into the delivered slide or the drop state), new `studio/e2e/body-editor.spec.ts`,
  new `studio/e2e/fixtures/body-editor-feed.ts` (mirror `studio/e2e/fixtures/library-feed.ts`: stubbed
  `GET /__studio/fs/read?type=news` via `page.route`, installed before `goto('/')`).
  - The working copy gains `body`, initialised from `splitDocument(onDiskText).body` (D1,
    `studio/src/editor/body-document.ts`) when an entry is selected; `BodyEditor` (D2) renders in the
    editor panel under the frontmatter form, bound to it. Changing the body counts as an unsaved change
    for 022's leave-warning. Nothing is written to disk.
  - The preview renders from the working document text: if 022's working copy already produces one,
    substitute the body into it; otherwise use `withBody(onDiskText, workingBody)` and note in Done that
    frontmatter edits are not yet previewed. The delivered form still comes from the mirrored pipeline
    (018's path), so an emptied body shows 018's "nothing would be shown" drop state.
  - Fixture entries: a `text` entry "Body Entry" with body `Plain body.`, a `cover` entry with an image.
  - Tests (e2e, `studio/e2e/body-editor.spec.ts`): "the body is edited as the raw text the author types";
    "the preview follows the body while typing, without a save or a reload" (assert `.home-hero-body` in
    the frame updates per edit, no non-GET `/__studio/` request, and a `window` marker set before typing
    survives); "an emptied body is flagged in the editor as the reason the entry is dropped" (clear, then
    whitespace-only: `body-finding[data-code=empty-body]` visible and the preview shows the drop state);
    "pasted rich text arrives as plain text and the slide body holds no markup" (grant clipboard
    permissions, write a `ClipboardItem` with `text/html` `<b>x</b>` and `text/plain` `x`, press
    Control+V in the textarea: value is `x`, the frame's `.home-hero-body` has no element children);
    "markdown the launcher does not render is flagged while typing" (type `**bold**` and `[a](https://x)`:
    two `literal-markdown` findings naming the constructs).

- **D4 — Overflow indicator in the preview, at every width.**
  Files: 018/019's preview frame component (the one owning the iframe and the current width), new
  `studio/src/editor/measure-body-overflow.ts` + `measure-body-overflow.test.ts` (jsdom, stubbed
  geometry), new `studio/e2e/body-overflow.spec.ts`, extend `studio/e2e/fixtures/body-editor-feed.ts`.
  - `measureBodyOverflow(doc: Document): boolean` — true when the frame's `.home-hero-body` is clamped
    (`scrollHeight > clientHeight + 1`) or its bottom lies below the bottom of its nearest
    `overflow: hidden` ancestor inside `.home-hero` (the hero is fixed at 320px, `home-hero.css:36`,
    clamp at `:287`). Measurement only — never a character count or a per-template threshold.
  - The frame component measures after `iframe.contentDocument.fonts.ready`, after every render caused
    by a body change and after every width change, and shows, in studio chrome outside the iframe,
    `Body is cut off at <width>px — the launcher shows only what fits` (test id `body-overflow`,
    warning tokens from `studio/src/styles/index.css`). Hidden when it fits or when the entry is dropped.
  - Fixture bodies: `Short body.` (fits everywhere), a ~1200-character body (cut everywhere), and a
    `cover` boundary body calibrated so it is cut at 940 but fits at 1920 (the cover column is 45% of
    the slide, capped at 560px, `home-hero.css:215-216`).
  - Tests: `measure-body-overflow.test.ts` › "a clamped or hero-clipped body counts as overflow, a
    fitting one does not"; e2e `studio/e2e/body-overflow.spec.ts` › "a body that overflows its template
    is flagged at 940, 1280 and 1920"; › "a body that fits is not flagged at any width"; › "a cover body
    cut at 940 but not at 1920 is flagged only where it is cut"; › "typing past the cut raises the
    indicator without a reload".

## Model Hints

- D4 → deliverable-hard: the overflow verdict is a cross-frame DOM measurement that must re-run on
  three independent triggers (font load, body change, 019's width change) inside 018's iframe, and the
  easy wrong versions — measuring before fonts load, measuring once per entry, or measuring the
  parent document — each pass a single-width long-body test.
- D1, D2, D3 → default.
- Review: → default — the plausible cheat (a character-count overflow threshold) is caught by D4's
  boundary-width e2e, and AC5's "everything is literal" claim is pinned by D1's drift-guard test.

## Acceptance Tests

- AC1 → e2e `studio/e2e/body-editor.spec.ts` › "the body is edited as the raw text the author types";
  component `studio/src/organisms/editor/BodyEditor.test.tsx` › "the body editor is a plain textarea
  that emits exactly what was typed"; unit `studio/src/editor/body-document.test.ts` › "split and rejoin
  round-trips byte-for-byte and agrees with parseFrontmatter" (D1, D2, D3)
- AC2 → e2e `studio/e2e/body-editor.spec.ts` › "the preview follows the body while typing, without a
  save or a reload" (D3)
- AC3 → e2e `studio/e2e/body-editor.spec.ts` › "an emptied body is flagged in the editor as the reason
  the entry is dropped"; unit `studio/src/editor/body-lint.test.ts` › "an empty or whitespace-only body
  is flagged as the drop cause"; component `studio/src/organisms/editor/BodyEditor.test.tsx` › "an
  empty body shows the drop-cause error on the field" (D1, D2, D3)
- AC4 → e2e `studio/e2e/body-editor.spec.ts` › "pasted rich text arrives as plain text and the slide
  body holds no markup"; component `studio/src/organisms/editor/BodyEditor.test.tsx` › "the body editor
  is a plain textarea that emits exactly what was typed" (D2, D3)
- AC5 → e2e `studio/e2e/body-editor.spec.ts` › "markdown the launcher does not render is flagged while
  typing"; unit `studio/src/editor/body-lint.test.ts` › "every markdown construct the launcher does not
  render is flagged with its line" and › "plain prose with underscores, a lone asterisk and an
  ampersand is not flagged"; unit `studio/src/editor/launcher-body-is-plain-text.test.tsx` › "the
  mirrored slides render the body as plain text" (D1, D3)
- AC6 → e2e `studio/e2e/body-overflow.spec.ts` › "a body that overflows its template is flagged at 940,
  1280 and 1920", › "a body that fits is not flagged at any width", › "a cover body cut at 940 but not
  at 1920 is flagged only where it is cut", › "typing past the cut raises the indicator without a
  reload"; unit `studio/src/editor/measure-body-overflow.test.ts` › "a clamped or hero-clipped body
  counts as overflow, a fitting one does not" (D4)

## Done

<Filled by `/build 023`.>
