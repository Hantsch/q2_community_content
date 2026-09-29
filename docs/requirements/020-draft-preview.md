---
id: 020
title: Preview a draft without publishing it
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The natural way to write a post is to write it, look at it, fix it, and only then decide it is ready.
The contract has no concept of a draft: an entry is either in `index.json` — and therefore live the
next time a launcher polls — or invisible.

That forces an author to either publish something unfinished to see it, or add and remove index rows
by hand while working. Both are exactly the kind of fiddling this project exists to remove. A `.md`
file with no index row is a perfectly good draft; the studio just has to be willing to render one.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-18.

## Acceptance Criteria

- [ ] **AC1** — A `.md` file in `news/` with no row in `index.json` can be selected and previewed.
- [ ] **AC2** — Previewing a draft writes nothing: `index.json` and every other repository file are
      byte-identical before and after.
- [ ] **AC3** — The preview marks a draft as a draft, so it can never be mistaken for something the
      launcher is already showing.
- [ ] **AC4** — A draft receives the same verdict a published entry would: a draft `cover` with a
      missing image previews as `text` and says so.
- [ ] **AC5** — A draft with frontmatter that does not parse shows the same drop verdict the
      launcher would produce, not a studio-specific error.
- [ ] **AC6** — The draft's position among the published entries is shown as it would be if it were
      published.

## Open Questions

- ~~Where does a draft's `order` come from for the purpose of AC6 — its own frontmatter, or the next
  free value the studio would assign on publishing? If the frontmatter has none, something has to be
  assumed, and the assumption should be visible.~~ answered → Decisions (Sprint)
- ~~Should the studio offer to create a draft's index row from the preview ("publish this"), or does
  that belong entirely to story 027?~~ answered → Decisions (Sprint)
- ~~Is there any value in a draft marker inside the file itself, or is "not in `index.json`" the
  definition and nothing more is needed?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **Order source (AC6):** the draft's own frontmatter `order`, exactly as the mirrored pipeline
  reads it — `feed-pipeline.ts` takes `order` from `data.order` and never from the index row, so
  anything else would be a studio assumption the launcher does not make.
- **Missing `order`:** no studio default; the pipeline's own behaviour (sorts after the ordered
  entries, warning "no usable order value; …") is shown, which makes the assumption visible without
  inventing one.
- **How a draft gets its verdict:** an in-memory copy of the read with one synthetic index row
  appended (`{ id: <draft path>, file: <path relative to news/> }`) and the draft's text added to
  `documents`, run through the unchanged `validators.buildReport()` — so "the same verdict a
  published entry would get" is the same code path, not a parallel one.
- **Synthetic id = the draft's repository path** (`news/….md`), the id `LibraryRow` already uses
  for drafts, because an id with a `news/` prefix and `.md` suffix cannot collide with a real
  entry's id and trigger a false duplicate-id drop.
- **Row appended at the end of the index:** only affects `order` ties (the pipeline sorts stably on
  index position), and appending is the least-surprising publish; the notice states it.
- **No "publish this" in the preview:** stories 018–023 are read-only (sprint notes) and
  publishing is story 027's criterion AC4.
- **No draft marker inside the file:** "not in `index.json`" is the concept's definition of a draft
  (glossary), and a marker in the file would be a second source of truth that can disagree.
- **Where the draft marker lives (AC3):** in studio chrome directly above the preview iframe, never
  inside it, because story 018's iframe must stay a faithful launcher render.
- **Where the draft verdict is stated (AC4, AC6):** in that same draft notice ("If published: …"),
  not in the validation panel, because the panel's `allClear`/summary describe the published feed
  and a hypothetical row must not change them.
- **Validation panel wording:** its draft notice currently claims "there is no launcher-facing
  verdict to report", which AC4 makes false; it is reworded to point at the preview.
- **AC2 proof:** the bridge is GET/HEAD-only today, so the e2e asserts every request the page sends
  during a draft preview is GET/HEAD and that every file under `news/` hashes identically before and
  after; a unit test proves the synthetic read never mutates its input.
- **e2e content:** a stubbed `GET /__studio/fs/read?type=news` response (story 016's
  `library-feed.ts` pattern), because the real `news/` holds no drafts.

## Plan

Story 018 renders the selected entry's delivered form in an iframe; this story makes a selected
draft flow through exactly that path, as if its row were already in `index.json`, in memory only.

1. **D1 — fold a draft into a read (pure).** `withDraftAsPublished(read, draftPath)` returns a new
   `ContentRepoRead` with one synthetic index row appended and the draft text in `documents`, plus
   the synthetic `entryId`. Nothing is mutated; nothing touches the bridge. Unit tests prove the
   verdict equals the one the same document gets as a real published row (AC4, AC5), the position
   (AC6) and the no-mutation guarantee (AC2).
2. **D2 — route a selected draft into the preview.** `useNewsLibrary` exposes
   `draftPreviewFor(draftId)` (synthetic read + report, same captured `now` as the library read);
   the preview host story 018 built uses it when the selected row is a draft, so the iframe,
   delivered-form rendering and the "nothing would be shown" dropped state all come from 018's
   existing code. e2e proves AC1, AC2, AC4 (renders as `text`) and AC5 through the real app.
3. **D3 — say it is a draft, and what publishing it would mean.** A `DraftPreviewNotice` above the
   iframe: Draft badge, "not in news/index.json — the launcher does not show it", the verdict if
   published (delivered vs declared template, the verdict's findings), and the would-be position.
   The validation panel's draft wording is corrected. e2e proves AC3, AC4 ("says so"), AC6.

Order: D1 → D2 → D3. Files: `studio/src/report/`, `studio/src/library/use-news-library.ts`, 018's
preview host, a new organism, `ValidationPanel.tsx`, one e2e spec + fixture. No write path, no
`launcher-core/` change, nothing under the published surface.

## Deliverables

- [ ] **D1 — `withDraftAsPublished()`: a draft folded into an in-memory read.**
  New `studio/src/report/draft-as-published.ts` (+ `draft-as-published.test.ts`); mirror the
  pure, never-throws style of `studio/src/library/library-model.ts`.
  Signature: `withDraftAsPublished(read: ContentRepoRead, draftPath: string):
  { read: ContentRepoRead; entryId: string } | undefined` (`ContentRepoRead` from
  `studio/src/content-repo/read-content-repo.ts`).
  - Returns `undefined` when `read.index.parsed` is false, `read.index.value.entries` is not an
    array, or no `read.drafts[i].path === draftPath`.
  - Otherwise returns a **new** read: `index.value` = a shallow copy with `entries` = the original
    entries plus `{ id: draftPath, file: <draftPath without its leading "news/"> }` appended at the
    end (no `order` on the row — the pipeline reads `order` from frontmatter only,
    `launcher-core/.../feed-pipeline.ts` `parseOrder(data.order)`); `documents` = the original plus
    `[<that file>]: { text: draft.text }`; `drafts` = the original minus this draft; every other
    field unchanged. `entryId = draftPath`. The input object and all nested objects are untouched.
  - No verdict logic here: callers run the result through the unchanged
    `buildNewsReport`/`validators.buildReport` (`studio/src/content-types/descriptors.ts`).
  - Tests (fixture reads built inline, mirroring `studio/src/report/__fixtures__/news-tree.ts`;
    run `buildNewsReport` over `toNewsReportInput`-shaped input, fixed `now`):
    "folding a draft in leaves the read it was given untouched" (deep-frozen input, structural
    equality after); "a draft cover with a missing image gets the verdict it would get as a
    published row" (declared `cover`, image absent from `images` → `delivered.template === 'text'`,
    and `delivered` + finding kinds/messages equal those of the same document added as a real
    last index row); "a draft whose frontmatter does not parse is dropped with the pipeline's own
    reason" (`delivered === 'dropped'`, error finding message equal to the published-row case);
    "a draft takes the delivered position its frontmatter order gives it" (published orders 10, 30,
    draft 20 → `position === 1`); "a draft without order sorts last with the pipeline's warning";
    "an unknown draft path or an unparsed index yields undefined".

- [ ] **D2 — a selected draft is previewed through story 018's preview.**
  Touches `studio/src/library/use-news-library.ts` (+ `use-news-library.test.ts`), the preview
  host story 018 added (the component that turns the selected library row into the iframe's input —
  locate it with `grep -rln "iframe" studio/src --include=*.tsx`, excluding `launcher-core/` and
  `mirror-runtime/`), new `studio/e2e/draft-preview.spec.ts`, new
  `studio/e2e/fixtures/draft-preview-feed.ts` (mirror `studio/e2e/fixtures/library-feed.ts`: a
  stubbed `GET /__studio/fs/read?type=news` via `page.route`, installed before `goto('/')`).
  - `useNewsLibrary` keeps the `read` and the `now` it built the report with, and exposes
    `draftPreviewFor(draftId: string): { read: ContentSourceRead; report: ContentReport;
    entryId: string } | undefined` = `withDraftAsPublished(read, draftId)` (D1) then
    `descriptor.validators.buildReport(syntheticRead, sameNow)`. `undefined` while loading, without
    a reader/validators, or when D1 returns `undefined`.
  - The preview host: when the selected row has `status === 'draft'` (its id is the draft path),
    feed 018's preview with the draft's synthetic read/report and `entryId` instead of the
    published ones — the same input shape 018 uses for a published entry. No second preview
    component, no draft-specific rendering, no change under `launcher-core/`. A draft whose verdict
    is `dropped` therefore shows 018's existing "nothing would be shown" state with its reason.
  - Fixture feed: published `text` entries at order 10 and 30; drafts `news/draft-cover.md`
    (`template: cover`, `image: img/missing.png` absent from `images`, `order: 20`),
    `news/draft-broken.md` (frontmatter that the mirrored `parseFrontmatter()` rejects, e.g. an
    unterminated `---` block), `news/draft-unordered.md` (`template: text`, no `order`).
  - e2e tests in `studio/e2e/draft-preview.spec.ts` (import `test`/`expect` from
    `./fixtures/localhost-only`): "a draft selected in the library is previewed in the slide frame";
    "previewing a draft sends only reads and leaves news/ byte-identical" (record every request;
    all `/__studio/` and `/news-img/` requests are GET/HEAD; SHA-256 of every file under the real
    repository's `news/`, recursive, equal before and after selecting and previewing each draft);
    "a draft cover with a missing image previews as text" (the iframe shows the `text` slide, not
    `cover`, using the same selector 018's e2e uses for the template); "a draft with unreadable
    frontmatter shows the launcher's drop reason" (018's dropped state, text contains
    "frontmatter could not be read").
  - Unit test in `use-news-library.test.ts`: "draftPreviewFor returns the draft's verdict from
    the same read and clock".

- [ ] **D3 — the draft notice above the preview, and the panel's wording.**
  New `studio/src/organisms/preview/DraftPreviewNotice.tsx` (+ `.test.tsx`) — props-in/JSX-out
  like `studio/src/organisms/ContentTypeStateNotice.tsx`; reuse
  `studio/src/molecules/status/EntryStatusBadge.tsx` with `status="draft"`; semantic tokens only
  (`/design-tokens`, `/frontend-guidelines`), status never colour-only. Mounted by the preview host
  from D2, **outside and above** the iframe, only when the selected row is a draft. Also
  `studio/src/organisms/ValidationPanel.tsx` (+ its test) and D2's `studio/e2e/draft-preview.spec.ts`.
  - Props: the draft's `EntryVerdict` (from D2's `draftPreviewFor(...).report.entries`, matched on
    `entryId`) and the delivered entry count (entries whose `delivered` has a `position`).
  - Renders, in a region `aria-label="Draft preview"`: the Draft badge; "Not in news/index.json —
    the launcher does not show this."; "If published:" then — when not dropped — "delivered as
    `<delivered.template>`" plus "(declared `<declared.template>`)" when they differ; every finding
    message of the verdict (these are the pipeline's own classified messages — never reworded);
    the position line: `position` present → "Position <position + 1> of <count> in today's feed,
    by its order <declared.order>"; no `position` and visibility `scheduled`/`expired` → that state
    and its date; `declared.order` absent → the pipeline's "no usable order value" finding already
    appears in the list; one line "Assumes its row is appended to the end of news/index.json."
  - `ValidationPanel.tsx` `DraftNotice`: replace "…so there is no launcher-facing verdict to report."
    with "…The preview shows the verdict it would receive if published." (existing
    `/is a draft/` assertions keep passing).
  - Component tests: "the notice names the draft and the fallback it would get";
    "the notice states the would-be position".
  - e2e tests (same spec as D2): "a draft preview carries a draft marker outside the slide frame and
    a published one does not" (region visible for a draft, absent for a published entry, and the
    iframe's own document contains no "Not in news/index.json" text); "a draft cover with a missing
    image says it falls back to text"; "a draft preview states where it would sit in the delivered
    feed" (`draft-cover.md` → "Position 2 of 3"; `draft-unordered.md` shows "no usable order
    value").

## Model Hints

- D1, D2, D3 → default. D1 is a small pure transform with an equivalence test against the real
  pipeline; D2 and D3 plug into 018's existing preview without new rendering logic.
- Review: → default — the plausible wrong turn (a hand-written draft verdict instead of the
  pipeline) is named in the D texts and caught by D1's equivalence tests plus a default diff read.

## Acceptance Tests

- AC1 → e2e `studio/e2e/draft-preview.spec.ts` › "a draft selected in the library is previewed in
  the slide frame" (D2)
- AC2 → e2e `studio/e2e/draft-preview.spec.ts` › "previewing a draft sends only reads and leaves
  news/ byte-identical" (D2); unit `studio/src/report/draft-as-published.test.ts` › "folding a
  draft in leaves the read it was given untouched" (D1)
- AC3 → e2e `studio/e2e/draft-preview.spec.ts` › "a draft preview carries a draft marker outside
  the slide frame and a published one does not" (D3)
- AC4 → unit `studio/src/report/draft-as-published.test.ts` › "a draft cover with a missing image
  gets the verdict it would get as a published row" (D1); e2e `studio/e2e/draft-preview.spec.ts` ›
  "a draft cover with a missing image previews as text" (D2) and › "a draft cover with a missing
  image says it falls back to text" (D3)
- AC5 → unit `studio/src/report/draft-as-published.test.ts` › "a draft whose frontmatter does not
  parse is dropped with the pipeline's own reason" (D1); e2e `studio/e2e/draft-preview.spec.ts` ›
  "a draft with unreadable frontmatter shows the launcher's drop reason" (D2)
- AC6 → unit `studio/src/report/draft-as-published.test.ts` › "a draft takes the delivered position
  its frontmatter order gives it" and › "a draft without order sorts last with the pipeline's
  warning" (D1); e2e `studio/e2e/draft-preview.spec.ts` › "a draft preview states where it would sit
  in the delivered feed" (D3)

## Done

<Filled by `/build 020`.>
