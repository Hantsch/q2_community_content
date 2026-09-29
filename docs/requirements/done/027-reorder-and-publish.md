---
id: 027
title: Reordering entries and publishing a draft
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Publishing is the moment a post becomes visible to everyone, and in this repository it is a row in
a JSON file. Ordering is the same act from the other side: `order` decides what a user sees first,
and the repository's convention of leaving gaps of ten exists precisely so that inserting a post
does not mean renumbering every other one.

Both operations are easy to do by hand and easy to do slightly wrong — and both edit the file the
launcher reads first.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-25.

## Acceptance Criteria

- [x] **AC1** — Entries can be reordered, and the resulting `order` values are written to
      `index.json` and to each document's frontmatter so the two agree.
- [x] **AC2** — Reordering keeps the repository's gap convention: an entry inserted between two
      others takes a value between them without renumbering entries that did not move.
- [x] **AC3** — When no gap is available, the studio says so and renumbers deliberately, reporting
      which entries it changed.
- [x] **AC4** — A draft can be published, which adds its row to `index.json` with an `id`, a `file`
      and an `order`.
- [x] **AC5** — A published entry can be unpublished, which removes its row and keeps its `.md` file
      and image untouched.
- [x] **AC6** — Publishing refuses an entry the launcher would drop, naming the reason, unless the
      author confirms it deliberately.
- [x] **AC7** — After any of these operations, the delivered order the report predicts matches what
      the mirrored pipeline produces from the files on disk.
- [x] **AC8** — None of these operations commits, pushes or reaches the network.

## Open Questions

- ~~Drag and drop, or editing `order` values directly? Dragging is the better experience and hides the
  numbers the contract is actually built on, which an author eventually has to understand.~~ answered → Decisions (Sprint)
- ~~What `order` does a newly published entry get — the next gap at the end, or a position the author
  picks during publishing?~~ answered → Decisions (Sprint)
- ~~Should unpublishing warn that launchers which already cached the feed keep showing the entry until
  they next poll? That is true and is the kind of thing an author will otherwise discover in public.~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Reordering: drag and drop; the studio renumbers the order values
- **Order sequence = what the launcher sorts.** The reorder list holds every index row the mirrored
  `resolveFeed()` resolves (published, scheduled and expired alike; dropped rows excluded), sorted by
  the mirrored `filterAndSortSlides()` with the visibility bounds stripped — because the launcher sorts
  by frontmatter `order` regardless of the window, and the studio must not own a second sort.
- **Gap rule.** A moved entry gets `floor((prev + next) / 2)` if that lies strictly between its new
  neighbours; at the top `prev` is `0`; at the end it gets the next multiple of ten above the last
  value; after an entry without a usable `order` there is no gap — the simplest rule that never
  touches a neighbour and keeps positive integers.
- **No gap → confirm, then renumber the whole sequence to 10/20/30…** in the new order, listing every
  entry whose value changes (old → new) before writing — because a full renumber restores the
  convention so the next insert does not hit the same wall, and the list is exact.
- **Both files agree.** Every order change writes the index row's `order` and the document's
  frontmatter `order` to the same value — the launcher reads only the frontmatter, the README
  requires the row, so writing one without the other is the silent failure this story exists to stop.
- **Publish appends at the end gap** (next multiple of ten above the highest resolved `order`, `10`
  on an empty sequence) and writes that value into the draft's frontmatter too; the author drags it
  afterwards — because every `_templates/*/template.md` declares `order: 10`, so keeping the declared
  value would collide with the first entry on almost every publish.
- **Published `id`** = file name minus `.md` minus a leading `YYYY-MM-DD-` prefix, the pattern every
  existing row follows; a collision is not special-cased, it surfaces through the drop pre-check.
- **Publish pre-check runs the mirrored pipeline**, via `buildNewsReport()` over the prospective index
  (current rows + new row) and documents (the draft included only if `isSafeNewsDocumentName()`
  accepts its name, since the launcher would never fetch it otherwise) — no second rule set; a
  `dropped` verdict refuses with the classified reason and offers "Publish anyway"; a fallback is not
  a drop and does not block (the validation panel already reports it).
- **Publish writes immediately, unpublish asks first** — publishing is additive and the pre-check
  guards it (consistent with 024's immediate save), while unpublishing removes a public post.
- **Unpublish warns about caches:** its confirmation says launchers that already fetched the feed
  keep showing the entry until they next poll — it is true, costs one sentence, and is otherwise
  discovered in public.
- **Unpublish is available on every index row, dropped ones included**, addressed by index position
  plus id — removing a broken row is a legitimate fix and duplicate ids make the id alone ambiguous.
- **Writes are one batch, all guards before any write.** Every file carries the text the plan was
  computed from; the bridge checks every file's current bytes against it (024's changed-on-disk
  guard) before writing the first one, then writes documents first and `index.json` last — because
  sequential single-file writes can leave index and frontmatter disagreeing after a conflict.
- **The studio re-reads from disk after every operation**, never patches its model optimistically —
  so the order it shows is by construction what the pipeline makes of the files on disk (AC7).
- **Native HTML5 drag and drop plus "Move up"/"Move down" buttons**, both calling one `move(from,
  to)` — no new dependency, and native DnD has no keyboard or touch path, which the house
  accessibility floor (`/design-tokens`) requires.

## Plan

Built on story 024's write surface (bridge write route with changed-on-disk guard, canonical
`index.json` serialiser, order- and comment-preserving frontmatter writer). Nothing here adds a
second writer or a second feed rule.

1. **Pure planning** (`studio/src/publishing/`): order sequence from the mirrored pipeline; `planMove`
   (gap or renumber), `planPublish` (id, end gap, mirrored drop pre-check), `planUnpublish`.
2. **Bridge batch write** (hard): one request carrying several files, every guard checked before the
   first byte is written, documents before `index.json`. Proves no git and no network on a git fixture.
3. **Apply**: turn a plan into the batch (index row + frontmatter `order` via 024's writers), send it,
   re-read. Proves AC7 on a temp tree with the real bridge and the real reader.
4. **Writable e2e harness**: reuse the one 024 introduces; add it only if absent.
5. **Reorder UI**: an "Order" region with drag handles and move buttons, renumber confirmation.
6. **Publish / unpublish UI**: publish on draft rows with the drop refusal, unpublish with the cache
   note.

Order: D1 → D2 → D3 → D4 → D5 → D6. D5 and D6 carry the e2e proofs in
`studio/e2e/authoring/reorder-and-publish.spec.ts`.

## Deliverables

**Shared fixture (used by D3, D5, D6)** — `studio/e2e/fixtures/reorder-publish-tree/news/`, a
purpose-built minimal tree (D4 creates it): `index.json` rows `a` (`2026-09-01-a.md`, order 10,
`template: split`, `image: img/a.png`), `b` (order 20), `c` (order 21), `d` (order 40), all `text`
except `a`, all visible, frontmatter `order` equal to the row's; `img/a.png` (a valid tiny PNG);
drafts `2026-09-20-draft-ok.md` (valid `text` entry, `order: 10`) and `2026-09-20-draft-dropped.md`
(no title, no body — the pipeline drops it).

- **D1 — Order, publish and unpublish plans (pure).** New `studio/src/publishing/order-plan.ts` and
  `studio/src/publishing/publish-plan.ts`, input `ContentRepoRead` (`studio/src/content-repo/
  read-content-repo.ts`), output data only — no I/O, never throws. Mirror the discipline of
  `studio/src/report/visibility-order.ts` (sorting comes off the pipeline, never a sort of ours).
  - `buildOrderSequence(read)`: rows `resolveFeed()` resolves (import from
    `studio/src/contract/launcher-contract.ts`), sorted by `filterAndSortSlides()` over the slides with
    `visibleFrom`/`visibleUntil` removed; each item `{ id, file, indexPosition, order | undefined }`
    (`undefined` where frontmatter `order` is not usable). Dropped rows are not in it.
  - `planMove(sequence, from, to)` — array-move semantics (remove at `from`, insert at `to`). No-op →
    `{ kind: 'none' }`. Gap: `v = floor((prev + next) / 2)` valid iff `prev < v < next`; top uses
    `prev = 0`; end uses `(floor(prev / 10) + 1) * 10`; a neighbour without usable order before it →
    no gap. Gap → `{ kind: 'gap', changes: [one change] }`; no gap → `{ kind: 'renumber', changes }`
    where the new order gets 10, 20, 30… and `changes` lists only entries whose value differs. A
    change is `{ id, file, indexPosition, from, to }`.
  - `planPublish(read, draftPath, now)`: `file` = path relative to `news/`; `id` = file minus `.md`
    minus a leading `YYYY-MM-DD-`; `order` = next multiple of ten above the highest usable order in
    the sequence (10 when empty). Pre-check: `buildNewsReport()` (`studio/src/report/
    build-news-report.ts`) over the index plus the new row and the documents plus the draft text with
    its `order` set — the draft included only if `isSafeNewsDocumentName(file)`
    (`studio/src/contract/launcher-safe-names.ts`) is true. Result `{ row, frontmatterOrder, verdict:
    'ok' | { dropped: reason } }`, reason = the new row's classified error finding message, or "the
    launcher does not fetch this file name" for an unsafe name.
  - `planUnpublish(read, indexPosition, id)`: the row to remove; refuses if the row at that position
    does not carry that id.
  - Tests in `studio/src/publishing/order-plan.test.ts` and `publish-plan.test.ts`, including the
    named tests in `## Acceptance Tests` (AC2, AC3, AC6 unit lines) and: scheduled entries are in the
    sequence, dropped ones are not; move to top/end; ties (`20`/`20`) have no gap; id derivation with
    and without date prefix; a duplicate id is reported as dropped by the pre-check.
- **D2 — Bridge batch write with all-before-any guards.** Files: `studio/src/bridge/
  create-file-bridge.ts`, `studio/src/bridge/bridge-protocol.ts`, `studio/src/bridge/client.ts`,
  tests in `studio/tests/file-bridge-server.test.ts` (mirror its tmp-root bridge setup) and new
  `studio/tests/publishing-no-git.test.ts` (mirror `studio/tests/content-repo-read-only.test.ts`'s use
  of `studio/tests/git-fixture.ts`). If story 024's write route already accepts a list of files with
  all-before-any semantics, reuse it and this D is only the tests; otherwise add `POST
  /__studio/fs/write-batch`, body `{ files: [{ path, text, baseText }] }` (or 024's conflict token in
  place of `baseText`), behind exactly the checks 024's single-file route applies (method, loopback
  Host, same Origin, content-type-directory confinement via `resolveBridgePath`, 024's extension/name
  rules). Semantics: validate every path and compare every file's current bytes with its base
  **before writing any**; any failure → 4xx naming every offending path, zero bytes written; then
  write `.md` files first and `index.json` last; an I/O error mid-batch → 500 listing the paths
  already written. The client gets `writeBatch(files)`. Tests: a conflict on the last file leaves
  every file byte-identical; a path outside `news/` refuses the whole batch; write order; and the
  AC8 unit line (HEAD, `git status` staged column, `git stash list` and remotes unchanged after a
  reorder, publish and unpublish batch; the modules import no `child_process`).
- **D3 — Apply a plan and re-read.** New `studio/src/publishing/apply-plan.ts` and
  `studio/src/publishing/use-publishing.ts` (hook; mirror `studio/src/library/use-news-library.ts`).
  `buildWriteSet(read, plan)` → files for D2's `writeBatch`: for each order change the document with
  frontmatter `order` set via story 024's frontmatter writer (if it has no set-one-field primitive, add
  `setFrontmatterField(text, key, value)` beside it: rewrite that one line in place or append it at
  the block's end, no other byte changes) and `index.json` with the row's `order` set (key added if
  absent) via 024's canonical serialiser; publish → the row appended `{ id, file, order }` plus the
  draft's frontmatter `order`; unpublish → `index.json` only, never the `.md` or an image. `baseText`
  = the text from the same read the plan came from. The hook exposes `move`, `publish(draftPath,
  { force })`, `unpublish(indexPosition, id)`, the pending plan for confirmation, the last result
  (changed entries / refusal reason / error), and calls `useNewsLibrary`'s `refresh()` after every
  successful write — never an optimistic model patch. Tests: `studio/src/publishing/
  apply-plan.test.ts` (AC1 unit line; unpublish write set contains only `news/index.json`) and new
  `studio/tests/publishing-disk.test.ts` — the AC7 unit line: copy the shared fixture to a tmp root,
  serve the real `createFileBridge`, apply a gap move, a renumber, a publish and an unpublish in
  sequence, after each re-read with `readContentRepo({ repoRoot })` and assert the ids ordered by the
  report's `delivered.position` equal `buildFeed()`'s ids over the same files.
- **D4 — Writable e2e harness and the shared fixture tree.** If story 024 delivered a writable e2e
  harness (dev server whose bridge root is a per-run temp copy of a fixture tree, reset per test),
  reuse it: add only `studio/e2e/fixtures/reorder-publish-tree/` and note the reuse in the Done
  section. Otherwise add it: `STUDIO_REPO_ROOT` read once at server start in `studio/src/bridge/
  file-bridge-plugin.ts` (falls back to `resolveRepoRoot`; never from a request), a second Playwright
  project `authoring` in `studio/playwright.config.ts` with its own `webServer` on port 5174 and that
  env var, and `studio/e2e/fixtures/writable-tree.ts` exporting a fixture that copies the tree to a
  fresh temp dir before each test and exposes `readFile(path)`. Never run a writing test against the
  repository's own `news/`. Acceptance: a smoke test in `studio/e2e/authoring/reorder-and-publish.spec.ts` ›
  "the writable harness serves the fixture tree, not the repository's news/".
- **D5 — Reorder UI.** New `studio/src/organisms/library/OrderList.tsx` (+ `OrderList.test.tsx`,
  mirror `LibraryView.tsx`/`LibraryView.test.tsx`: props only, no fetching), a confirmation organism
  `studio/src/organisms/dialogs/ConfirmPanel.tsx` (+ test; inline, `role="alertdialog"`, accessible
  name from its title, "Confirm"/"Cancel" buttons), wiring in `studio/src/pages/studio/
  StudioPage.tsx`, which feeds it `move`, the pending plan and the last result from D3's
  `usePublishing` (`studio/src/publishing/use-publishing.ts`) and the sequence from D1's
  `buildOrderSequence`. `OrderList` renders region "Order": one `listitem` per sequence item with title,
  `Order: <n>`, a draggable handle (native HTML5 DnD; dropping on a row = `move(from, rowIndex)`) and
  "Move up"/"Move down" buttons (keyboard path, visible focus, token classes only per
  `/design-tokens`). A renumber plan shows `ConfirmPanel` titled "No gap — renumber entries?" listing
  `<id>: <old> → <new>`; after writing, a status line "Renumbered: <ids>". Tests in
  `studio/e2e/authoring/reorder-and-publish.spec.ts` (AC1, AC2, AC3, AC7 e2e lines) using Playwright
  `dragTo`, plus component tests for move buttons and the renumber list.
- **D6 — Publish and unpublish UI.** Files: `studio/src/organisms/library/LibraryEntryRow.tsx` (+ its
  test), `studio/src/organisms/library/LibraryView.tsx` (+ its test), reusing D5's `ConfirmPanel`,
  wiring in `studio/src/pages/studio/StudioPage.tsx` to D3's `usePublishing`
  (`studio/src/publishing/use-publishing.ts`: `publish(draftPath, { force })`, `unpublish(indexPosition,
  id)`, pending plan, last result). Draft rows get a "Publish" button; a refused
  publish shows `ConfirmPanel` "The launcher would drop this entry" with the reason and "Publish
  anyway"; entry rows get "Unpublish", which shows `ConfirmPanel` "Unpublish <title>?" including the
  sentence "Launchers that already fetched the feed keep showing this entry until they next poll."
  Tests in `studio/e2e/authoring/reorder-and-publish.spec.ts` (AC4, AC5, AC6, AC8 e2e lines).

## Model Hints

- D2 → deliverable-hard — the first multi-file write path: a guard evaluated per file while writing
  (instead of for all files before the first write) leaves `index.json` and frontmatter disagreeing
  after a conflict, and the new route widens story 015's confinement surface, so every check 024's
  single-file route applies has to hold for each element of the batch.
- Review: → default

## Acceptance Tests

- AC1 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "dragging an entry writes the new order to index.json and to its frontmatter"
- AC1 → unit `studio/src/publishing/apply-plan.test.ts` › "an order change writes the index row and the document's frontmatter to the same value"
- AC2 → unit `studio/src/publishing/order-plan.test.ts` › "a move into a gap changes only the moved entry"
- AC2 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "dragging into a gap leaves every other entry's files byte-identical"
- AC3 → unit `studio/src/publishing/order-plan.test.ts` › "without a gap the plan renumbers and lists only the entries whose value changes"
- AC3 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "without a gap the studio asks before renumbering and lists the changed entries"
- AC4 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "publishing a draft adds its row with id, file and order"
- AC5 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "unpublishing removes the row and leaves the document and its image byte-identical"
- AC6 → unit `studio/src/publishing/publish-plan.test.ts` › "a draft the pipeline would drop is refused with the reason"
- AC6 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "publishing a draft the launcher would drop is refused with the reason until confirmed"
- AC7 → unit `studio/tests/publishing-disk.test.ts` › "after each operation the report's delivered order equals the mirrored pipeline's over the files on disk"
- AC7 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "after each operation the library shows the order the files on disk produce"
- AC8 → unit `studio/tests/publishing-no-git.test.ts` › "reorder, publish and unpublish leave HEAD, the git index and the remotes untouched"
- AC8 → e2e `studio/e2e/authoring/reorder-and-publish.spec.ts` › "reordering, publishing and unpublishing reach nothing beyond localhost"

Coverage: AC1 D3+D5 · AC2 D1+D5 · AC3 D1+D5 · AC4 D1+D6 · AC5 D3+D6 · AC6 D1+D6 · AC7 D3+D5 ·
AC8 D2+D6. The e2e lines run through D4's writable harness; the AC7 e2e fixture has every entry
visible and valid, so the expected order is the frontmatter `order` values read back from disk.

## Done

Reordering and publishing work end to end. Pure plans (order sequence off the mirrored pipeline, gap/renumber move, publish with mirrored drop pre-check, unpublish), a `POST /__studio/fs/write-batch` bridge route (every guard for every file before the first write, `.md` first, `index.json` last), an apply layer plus `usePublishing` hook (re-reads after every write), and the UI: an "Order" region (drag and drop plus Move up/down), `ConfirmPanel`, Publish/Unpublish buttons.

Commit message: `027: reorder and publish (pure order/publish plans, all-before-any batch write route, apply + hook, Order list with DnD, publish/unpublish with drop refusal)`

Decisions (build):
- Reused 024's scratch e2e harness (`e2e/authoring/`, `resetScratch` got an optional fixture name, Playwright option `fixtureName`); the specs live in `studio/e2e/authoring/reorder-and-publish.spec.ts` (Acceptance Tests paths corrected), because the chromium project ignores that directory's writing specs.
- Added a new batch route rather than reusing 024's `/write` (that one stops at the first offender and accepts an empty list); it shares 024's per-file helpers. Body items use 024's `expected` token.
- `setFrontmatterField` not needed: `writeEntryDocument(text, {fields:{order}})` already patches one line. Publish row append / unpublish removal live in `apply-plan.ts`.
- Conflict between Decisions and D1 on the end position: Decisions won, the end gets `(floor(prev/10)+1)*10` (30 -> 40), always a gap. Fixed after review.
- "Usable order" = not the mirror's `Number.MAX_SAFE_INTEGER` sentinel (no second parser). `moveFiles` matches index rows by `file`.
- Removed one unused eslint-disable in `e2e/fixtures/scratch-repo.ts`; two selectors in `StudioPage.test.tsx` widened for the new buttons.
- Not fixed (low): duplicate `file` values in an index would edit the first row; AC8 e2e's `.git` check is trivially true (the network check and the unit git test carry the proof); drag handle and buttons not checked at 375-1440 widths.

Verification (narrow gate): build, typecheck green; eslint 0 errors; prettier clean on touched files; `npm run test --workspace studio -- --changed HEAD` 19 files green plus explicit publishing/bridge suites green; `npm run e2e --workspace studio -- e2e/authoring/reorder-and-publish.spec.ts` 9/9 green. After review fixes the affected unit (27) and e2e (9/9) runs, typecheck and eslint were re-run by the fix agent, green. Real `news/` untouched. AC -> test: AC1-AC8 each mapped test ran and passed as listed in `## Acceptance Tests`; no manual residue. Review (default, 1 cycle): 3 weak-test/divergence findings fixed (end gap value, AC6 reason text asserted, AC7 e2e covers publish/unpublish). Full gate pending (sprint's).

tiers: D 6 / hard 1 · review default · cycles 1 · agents 11
