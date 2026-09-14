---
id: 016
title: Library view of the news directory
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Before anyone edits anything, they need to see what is there. Today that means opening
`index.json`, cross-referencing four `.md` files by name, and holding the visibility dates in your
head to work out what a launcher would actually be showing right now.

The library is the studio's home screen: the feed as it stands, in the order it will appear, with
each entry's real state visible at a glance — published, scheduled, expired, draft, or dropped.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-15.

## Acceptance Criteria

- [ ] **AC1** — Every published entry is listed in the order the launcher will deliver it, showing
      its title, template, `order` value and status.
- [ ] **AC2** — Drafts are listed and marked as invisible to the launcher, separately from published
      entries.
- [ ] **AC3** — A scheduled entry shows the date it becomes visible; an expired one shows the date
      it stopped being visible.
- [ ] **AC4** — An entry that the launcher would drop is marked as dropped, with the reason readable
      without leaving the list.
- [ ] **AC5** — An entry whose delivered template differs from its declared one shows both.
- [ ] **AC6** — Selecting an entry marks it as the current entry, which later stories use as the
      preview and editor target.
- [ ] **AC7** — An empty or unreadable `news/` produces a clear explanation, not a blank screen.

## Open Questions

- ~~What is the primary sort — delivered order, or most recently edited? Delivered order matches
  what the launcher does; recency matches what an author is usually looking for.~~ answered →
  Decisions (Sprint)
- ~~Do drafts sit in the same list with a badge, or in their own section?~~ already answered by
  AC2 ("separately from published entries") — no user question needed.
- ~~Should the library show a thumbnail of an entry's image, and if so, does that make the list slow
  enough to matter on a large feed?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Primary sort is delivered order (the launcher's own order value), matching AC1's
  wording literally rather than sorting by recency.
- Drafts sit in their own section, separate from published entries — this is what AC2 already
  specifies ("separately from published entries"), so no open decision remained here.
- **(User)** The library shows a thumbnail of each entry's image. The current feed is small enough
  that this is not a performance concern; add virtualization or lazy-loading only if a later, larger
  feed makes it slow.
- The library reads only through the `news` descriptor's reader from story 014 (which is backed by
  story 015's bridge client) — no `fetch` in a component and no Node filesystem import, so the view
  stays swappable when another content type becomes editable.
- Interface taken from 014/015: the descriptor's reader resolves asynchronously to the story-010
  `ContentRepoRead` shape, delivered as JSON by the bridge's `GET /__studio/fs/read` route through
  `studio/src/bridge/client.ts`, with images at `/news-img/<name>`. If either shape shifts during
  the sprint, only `studio/src/library/use-news-library.ts` adapts — every other module here takes
  plain data.
- Status is derived in a pure model module rather than read from a field: `report-types.ts` has no
  single status, so the model combines `EntryVerdict.delivered`, `EntryVerdict.visibility` and the
  reader's drafts into one `LibraryStatus`.
- Status precedence is dropped > draft > visibility (published/scheduled/expired), because a dropped
  entry's state is the one an author has to act on first.
- Published rows are sorted by the report's `delivered.order`/`delivered.position`, not by index
  position, so the list is literally what the launcher would deliver (the user's sort decision).
- Drafts are taken from `ContentRepoRead.drafts` and carry no order value, since they are not in
  `index.json` and have no delivered position.
- Declared and delivered template are shown side by side only when they differ (AC5); identical
  values render once, so a mismatch stands out instead of drowning in repetition.
- The current entry lives in a small React context (`studio/src/context/`) rather than page state,
  because story 017 selects an entry from a finding and would otherwise reach into a page.
- Model and hook live in a flat domain directory `studio/src/library/`, following 014's
  `content-types/` precedent and this repository's existing flat domain convention instead of a
  `features/` tree.
- UI files are grouped by domain under `studio/src/organisms/library/` (organisms may group by
  domain per `/frontend-guidelines`), which keeps 014's flat shell organisms untouched.
- A thumbnail is rendered from the bridge's image URL for the entry's declared image; a missing or
  refused image renders a labelled placeholder, never a broken `<img>` — the missing image is
  already a finding and must not become a second, silent failure.
- No status is signalled by colour alone: every badge carries its word, which also keeps 017's
  colour-blind requirement consistent across both surfaces.
- Semantic design tokens are used for every colour; the token block in `studio/src/styles/index.css`
  is created here only if story 014 has not already created it, and its names are then reused. No
  raw palette class or hex value in either case.
- The e2e spec covers the data-dependent states by stubbing the bridge's `GET /__studio/fs/read`
  response with a fixture feed via `page.route`: the real `news/` holds four plain published
  entries, so scheduled,
  expired, dropped, mismatched and empty states have no real-surface trigger otherwise. The app,
  the bridge client, the model and the rendering all run for real — only the file bytes are fixed.
- AC1 and AC6 are additionally exercised unstubbed against the repository's real `news/`, so the
  happy path is proven end to end and not only against a fixture.
- Three distinct non-list states exist (AC7): loading, empty (readable, but no entries and no
  drafts) and unreadable (reader or bridge error findings) — "nothing there" and "could not look"
  must never look the same.

## Plan

1. **Library model** (`studio/src/library/`): `LibraryRow`, `LibraryStatus`, `LibraryModel` types
   plus `buildLibraryModel({ read, report, repositoryFindings })` — a pure function mapping the
   S03 report data onto rows: title, declared/delivered template, order, status, visibility date,
   drop reason, image path, plus a separate draft list and the empty/unreadable state.
2. **Badge** (`studio/src/molecules/status/EntryStatusBadge.tsx`): one status, always with its word.
3. **Row + view** (`studio/src/organisms/library/`): `LibraryEntryRow` (thumbnail, title, template
   pair, order, badge, date, drop reason, selected state), `LibraryStateNotice` (loading, empty,
   unreadable) and `LibraryView` composing the published section and the drafts section. All
   presentational: data and handlers come in as props.
4. **Data + selection** (`studio/src/library/use-news-library.ts`,
   `studio/src/context/current-entry-context.tsx`): the hook calls the `news` descriptor's reader
   through the registry, runs `buildNewsReport` + `collectRepositoryFindings`, returns the model and
   resolves thumbnail URLs; the context holds `currentEntryId` + `selectEntry` for 016 and 017.
5. **Shell wiring** (`studio/src/pages/studio/StudioPage.tsx`): the `news` mount region renders
   `LibraryView` inside the current-entry provider, replacing story 015 D4's interim
   `NewsBridgeSummary`; e2e spec plus its fixture feed.
6. **Order:** D1 → D2 → D3 → D4 → D5. D5 is the only one that depends on 014's shell and 015's
   bridge being merged.

## Deliverables

- **D1 — Library model (pure).**
  Files: `studio/src/library/library-types.ts`, `studio/src/library/library-model.ts`,
  `studio/src/library/library-model.test.ts`.
  Pattern to mirror: `studio/src/report/report-types.ts` and `studio/src/report/build-news-report.ts`
  (pure, data-in/data-out, never throws).
  Acceptance: published rows come back in delivered order with title, declared and delivered
  template, order value and status; scheduled/expired rows carry their date; dropped rows carry
  their reason text; drafts come back as their own list; empty and unreadable inputs produce the two
  distinct states. Tests in `library-model.test.ts` against `studio/tests/fixtures/content-repo`
  plus inline variants for scheduled/expired/dropped/mismatch.

- **D2 — Status badge.**
  Files: `studio/src/molecules/status/EntryStatusBadge.tsx`,
  `studio/src/molecules/status/EntryStatusBadge.test.tsx`, `studio/src/styles/index.css` (only if no
  token block exists yet).
  Pattern to mirror: `/design-tokens` semantic roles; `studio/src/pages/studio/StudioPage.test.tsx`
  for the RTL style.
  Acceptance: each of the five statuses renders its own word and a token-based style; no hex value
  and no raw palette class anywhere in the file; the status is readable with colour ignored.

- **D3 — Row, state notice and the two sections.**
  Files: `studio/src/organisms/library/LibraryEntryRow.tsx`,
  `studio/src/organisms/library/LibraryStateNotice.tsx`,
  `studio/src/organisms/library/LibraryView.tsx`,
  `studio/src/organisms/library/LibraryView.test.tsx`,
  `studio/src/organisms/library/LibraryEntryRow.test.tsx`.
  Pattern to mirror: `studio/src/organisms/ContentTypeNav.tsx` and `ContentTypeStateNotice.tsx`
  from story 014.
  Acceptance: the published section lists rows in the given order; drafts render in their own
  section, labelled invisible to the launcher; a row shows both templates only when they differ, its
  visibility date, its drop reason, and a placeholder when no thumbnail URL is given; the three
  non-list states each render their own explanation. No data fetching in these files.

- **D4 — Data hook and current-entry context.**
  Files: `studio/src/library/use-news-library.ts`, `studio/src/library/use-news-library.test.ts`,
  `studio/src/context/current-entry-context.tsx`,
  `studio/src/context/current-entry-context.test.tsx`.
  Pattern to mirror: story 014's `createContentTypeRegistry({ source })` injection style — the hook
  takes the descriptor, never a global.
  Acceptance: the hook resolves the model from a descriptor whose reader returns fixture data,
  reports the loading and unreadable states without throwing, and resolves an image URL per entry;
  the context exposes `currentEntryId` and `selectEntry` and is consumable by a second component
  (the seam story 017 uses).

- **D5 — Shell wiring and the e2e spec.**
  Files: `studio/src/pages/studio/StudioPage.tsx`, `studio/src/pages/studio/StudioPage.test.tsx`,
  `studio/src/organisms/NewsBridgeSummary.tsx` (deleted, plus its test),
  `studio/e2e/library-view.spec.ts`, `studio/e2e/fixtures/library-feed.ts`.
  Pattern to mirror: `studio/e2e/studio-shell.spec.ts` (goto + role queries, `localhost-only`
  fixture); the mount region from story 014's D4.
  Acceptance: selecting `news` shows the library in place of story 015 D4's interim
  `NewsBridgeSummary` (which is removed here, not left beside it); clicking an entry marks it
  current and keeps it marked; `npm run e2e` covers every AC listed below. The fixture module
  stubs `**/__studio/fs/read*` for the state cases; the existing `studio/e2e/file-bridge.spec.ts`
  keeps proving the unstubbed bridge path.

## Model Hints

- D1 → `deliverable-hard` — the status derivation fuses three sources (`delivered`, `visibility`,
  the reader's drafts) that share no status field, and story 017's panel must agree with it, so a
  wrong precedence here surfaces as a contradiction in another story.
- D2 → default.
- D3 → default.
- D4 → default.
- D5 → default.
- Review: → default — the story adds new modules plus one small shell swap inside story 014's mount
  region; there is no existing behaviour it can regress.

## Acceptance Tests

- AC1 → e2e `studio/e2e/library-view.spec.ts` › "the library lists the published feed in delivered
  order with title, template, order and status" (D5, unstubbed against the real `news/`) **and**
  unit `studio/src/library/library-model.test.ts` › "published rows come back in delivered order"
  (D1)
- AC2 → e2e `studio/e2e/library-view.spec.ts` › "drafts are listed in their own section and marked
  invisible to the launcher" (D3/D5)
- AC3 → e2e `studio/e2e/library-view.spec.ts` › "a scheduled entry shows its visible-from date and
  an expired entry its visible-until date" (D5)
- AC4 → e2e `studio/e2e/library-view.spec.ts` › "a dropped entry is marked dropped and its reason is
  readable in the list" (D5)
- AC5 → e2e `studio/e2e/library-view.spec.ts` › "an entry whose delivered template differs from the
  declared one shows both" (D5)
- AC6 → e2e `studio/e2e/library-view.spec.ts` › "selecting an entry marks it as the current entry"
  (D4/D5, unstubbed against the real `news/`)
- AC7 → e2e `studio/e2e/library-view.spec.ts` › "an empty news directory explains itself" **and**
  › "an unreadable news directory explains itself, not as an empty list" (D3/D5)

AC2–AC5 and AC7 run through the real app and the real bridge client with the bridge's file responses
fixed by `page.route` (see Decisions), because the repository's own `news/` contains only four plain
published entries and therefore cannot trigger those states. AC1 and AC6 additionally run against
the untouched repository content. No manual residue.

Coverage gate: AC1 → D1 + D5, AC2 → D3 + D5, AC3 → D1 + D3 + D5, AC4 → D1 + D3 + D5, AC5 → D3 + D5,
AC6 → D4 + D5, AC7 → D1 + D3 + D5. Every criterion has a deliverable and a named test.

## Done

<Filled by `/build 016`.>
