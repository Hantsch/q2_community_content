---
id: 017
title: Validation panel in the studio
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The report exists as data after story 011 and as terminal output after story 012. Neither is where
an author is looking while they write. The verdict has to sit next to the entry it is about, in the
same window, updating as the entry changes.

This is also where the two halves of the report meet: what is wrong with *this* entry, and what is
wrong across the directory as a whole.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-11, CS-13.

## Acceptance Criteria

- [x] **AC1** — The panel shows the selected entry's verdict: declared form, delivered form, and
      every finding attached to it.
- [x] **AC2** — A fallback is shown with the rule that caused it and the field to fix — the missing
      image path, the rejected button URL.
- [x] **AC3** — Repository-level findings from story 013 are shown in one place, separate from the
      selected entry's own findings.
- [x] **AC4** — Every finding names the file it concerns.
- [x] **AC5** — A repository with no findings shows an explicit all-clear state, not an empty area
      that could equally mean "not checked yet".
- [x] **AC6** — The panel distinguishes severities visually, and the distinction survives being read
      without colour.
- [x] **AC7** — The panel's verdicts and the `validate` command's verdicts agree for the same
      repository state, proven by a test rather than by inspection.

## Open Questions

- ~~Should a finding be clickable, jumping to the entry and ideally the field it concerns?~~
  answered → Decisions (Sprint)
- ~~Does the panel need to distinguish "this entry is fine" from "this entry is fine *and* it is a
  draft nobody will see"?~~ answered → Decisions (Sprint)
- ~~Where does the mirror provenance from story 009 appear — in this panel, or in the studio's
  chrome?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** A finding is clickable and jumps to select its entry in the library view (016), reusing
  the "current entry" mechanism from 016 AC6. Field-level jump is deferred — no editor exists yet in
  this sprint to jump a field into.
- **(User)** The panel distinguishes "fine" from "fine but a draft nobody will see", carrying the
  draft/visibility status from the library view (016 AC2) through to the panel so an author isn't
  misled into thinking a draft is live.
- **(User)** Mirror provenance from story 009 is shown in this panel, alongside the validation
  verdicts, since provenance affects how much to trust the result.
- Panel and CLI share one composition function (`buildValidationSnapshot`, browser-safe, taking the
  story 010 read as data), so AC7's agreement is structural instead of two assemblies that have to
  be kept identical by hand.
- This story wires `collectRepositoryFindings()` into `npm run validate` (the open roadmap follow-up
  from S03), because AC3 plus AC7 require the command to report the same repository findings the
  panel shows — otherwise the two provably disagree.
- The panel consumes a `ContentRepoRead` produced by story 015's browser-side reader (015 AC1 reuses
  story 010's reader), so it depends on that data shape and not on the bridge's transport details.
- Selection is a prop: `StudioPage` owns 016's "current entry" and passes `selectedEntryId` plus
  `onSelectEntry` into the panel — no store and no import of 016-internal modules, so the two
  stories stay independently reviewable.
- Mirror provenance reaches the browser through a dedicated computed bridge route that returns a
  `MirrorProvenance` object, not a file; it therefore does not widen 015 AC3's rule that only
  descriptor-declared directories are reachable by path. The route is added by this story.
- AC2's "field to fix" is derived on the presentation side from `Finding.kind` and
  `ButtonVerdict.reason`; the shipped report types of 011-013 are not changed, so no already
  accepted story regresses for the sake of a label.
- A finding without a `file` (repository-level findings about the feed as a whole) renders
  `news/index.json` as its file, so AC4 holds for every finding without inventing a path.
- "Updating as the entry changes" means re-validating on selection change and on an explicit
  re-check control; filesystem watching is deferred — no editor exists this sprint that could change
  a file from inside the studio.
- Severity carries a text label plus a glyph, with colour additive only (AC6). Since the panel is
  the studio's first status UI, it introduces the semantic status tokens in
  `studio/src/styles/index.css` per `/design-tokens` instead of using raw palette classes.
- Components live in `studio/src/organisms/` (the layer story 014 creates); the pure view-model
  logic lives in `studio/src/validate/panel-model.ts`, following this repository's flat
  domain-directory convention.
- AC5 and AC2's button-URL half are proven at component level over fixtures: the dev server always
  serves the real repository root (015's decision), and that repository has neither a findings-free
  state nor a fallback entry. Both criteria describe a rendered state, not a user action; everything
  the real repository can exhibit is proven through `npm run e2e`.

## Plan

1. **Shared snapshot** — `studio/src/validate/build-validation-snapshot.ts`:
   `buildValidationSnapshot({ read, mirror, now })` composes `buildNewsReport` +
   `toRepositoryScan`/`collectRepositoryFindings` + `summarise` into
   `{ mirror, report, repositoryFindings, summary }`. Pure, no `fs`, therefore usable in the
   browser. `scripts/validate.ts` is rewired onto it, which also fills the payload's so-far-empty
   `repositoryFindings`.
2. **View model** — `studio/src/validate/panel-model.ts`: snapshot plus selected id →
   `{ entry: { declared, delivered, visibility, draft, findings[] }, repositoryFindings[],
   allClear }`. Each finding view carries severity, rule (`kind`), message, file (fallback
   `news/index.json`), the field to fix and the entry id it jumps to.
3. **Panel component** — `studio/src/organisms/ValidationPanel.tsx` plus `SeverityBadge`: entry
   verdict, its findings, repository findings in their own labelled region, the all-clear state and
   the draft/visibility line; status tokens added to `studio/src/styles/index.css`.
4. **Provenance route** — a computed `provenance` route on story 015's dev-server bridge returning
   `readMirrorProvenance(repoRoot)`, plus the browser client that fetches it and the provenance line
   in the panel.
5. **Wiring plus e2e** — `StudioPage` holds the current entry from 016 and renders the panel next to
   the library; a finding click calls `onSelectEntry`; a re-check control re-reads through the
   bridge. `studio/e2e/validation-panel.spec.ts` proves the panel on the real repository and
   compares it against `scripts/validate.ts --json` (AC7).
6. **Order**: D1 → D2 → D3 → D5, with D4 in parallel to D2/D3.

## Deliverables

- **D1 — Shared validation snapshot, and the CLI on top of it.**
  Files: `studio/src/validate/build-validation-snapshot.ts`,
  `studio/src/validate/build-validation-snapshot.test.ts`, `studio/scripts/validate.ts`,
  `studio/src/validate/summary.test.ts` (extend), `studio/src/validate/format-json.test.ts`
  (extend).
  Pattern to mirror: `studio/src/validate/summary.ts` (pure, data in / data out) and the current
  composition inside `scripts/validate.ts` `main()`.
  Acceptance: the function returns report, repository findings and summary from one
  `ContentRepoRead` and never touches `fs`; `npm run validate -- --json` reports real
  `repositoryFindings` for a fixture that has some (today always `0`); text output, `--strict` exit
  codes and story 012's existing CLI tests stay green.

- **D2 — Panel view model.**
  Files: `studio/src/validate/panel-model.ts`, `studio/src/validate/panel-model.test.ts`.
  Pattern to mirror: `studio/src/validate/format-text.ts` (snapshot → renderable output, pure).
  Acceptance: selected entry yields declared form, delivered form, visibility plus draft status and
  its own findings; repository findings stay in a separate list; `allClear` is true only when both
  lists are empty; every finding view has a non-empty file and, where the kind implies one, the
  field to fix (missing image → `image`, rejected button URL → that button's `url`) together with
  the rule that caused it. Tests in the named test file.

- **D3 — The panel component.**
  Files: `studio/src/organisms/ValidationPanel.tsx`,
  `studio/src/organisms/ValidationPanel.test.tsx`, `studio/src/organisms/SeverityBadge.tsx`,
  `studio/src/organisms/SeverityBadge.test.tsx`, `studio/src/styles/index.css`.
  Pattern to mirror: `studio/src/organisms/ContentTypeStateNotice.tsx` from story 014 D4; tokens per
  `/design-tokens`, no raw palette classes.
  Acceptance: the selected entry's verdict, its findings, the repository-findings region and the
  all-clear state all render from the D2 view model; each severity shows a text label and a glyph so
  the distinction reads without colour (tests assert by text/role, never by class); a draft entry
  with no findings reads as "fine, but invisible to the launcher".

- **D4 — Mirror provenance in the panel.**
  Files: story 015's bridge dev-server module (add the computed provenance route),
  `studio/src/mirror-runtime/provenance-client.ts` plus its test,
  `studio/src/organisms/ValidationPanel.tsx` and its test (provenance line).
  Pattern to mirror: the provenance block of `studio/src/validate/format-text.ts` for the wording;
  `studio/src/mirror/read-provenance.ts` for the data.
  Acceptance: the route returns the same `MirrorProvenance` as `readMirrorProvenance`; the panel
  shows verdict, launcher commit, sync age and the out-of-sync file count; the route takes no path
  input, proven by a test, so it widens nothing about 015's confinement.

- **D5 — Wiring, selection jump, and the agreement test.**
  Files: `studio/src/pages/studio/StudioPage.tsx`, `studio/src/pages/studio/StudioPage.test.tsx`,
  `studio/e2e/validation-panel.spec.ts`.
  Pattern to mirror: `studio/e2e/studio-shell.spec.ts` (spec shape) and story 016's library wiring
  in `StudioPage`.
  Acceptance: the panel sits next to the library and follows the current entry; clicking a finding
  selects its entry; a re-check control re-reads through the bridge; the e2e spec runs
  `scripts/validate.ts --json` against the same repository and asserts the panel's per-entry
  declared/delivered forms, findings and counts match it.

## Model Hints

- D1 → `deliverable-hard` — it rewires a shipped command (`npm run validate`) and starts feeding it
  repository findings, so story 012's `--strict` exit code and JSON payload can regress silently.
- D2 → default.
- D3 → default.
- D4 → default.
- D5 → default.
- Review: → default — apart from D1 the story only adds new modules plus one shell wiring, and D1's
  regression surface is already covered by story 012's CLI tests.

## Acceptance Tests

- AC1 → e2e `studio/e2e/validation-panel.spec.ts` › "AC1: the panel shows the selected entry
  declared and delivered form with its findings" (D5)
- AC2 → e2e `studio/e2e/validation-panel.spec.ts` › "AC2: a missing image names the rule and the
  field to fix" (D5) **and** unit `studio/src/validate/panel-model.test.ts` › the rejected-button
  cases asserting `field: 'url'` for `button-host-not-allowed`/`button-invalid`/`button-cap` (D2) —
  the repository the dev server serves carries no fallback entry, so the button case is proven over
  a fixture.
- AC3 → e2e `studio/e2e/validation-panel.spec.ts` › "AC3: repository-level findings are listed in
  their own region, separate from the entry findings" (D5) **and** component
  `studio/src/organisms/ValidationPanel.test.tsx` › "entry findings and repository findings never
  mix" (D3)
- AC4 → unit `studio/src/validate/panel-model.test.ts` › "every finding view names a file, falling
  back to news/index.json" (D2)
- AC5 → component `studio/src/organisms/ValidationPanel.test.tsx` › "a snapshot without findings
  shows the all-clear state" (D3) — a rendered state, not a user action; the served repository has
  findings, so e2e cannot reach this state.
- AC6 → component `studio/src/organisms/SeverityBadge.test.tsx` › "every severity is readable as
  text and glyph without colour" (D3)
- AC7 → e2e `studio/e2e/validation-panel.spec.ts` › "AC7: the panel and npm run validate --json
  agree for the same repository" (D5, over D1's shared composition) — spawns the real CLI via
  `execFileSync`, parses its JSON, and compares against the rendered panel for every real entry.
- Sprint decisions: the clickable jump → e2e `studio/e2e/validation-panel.spec.ts` › "clicking a
  finding selects its entry" (D5); the re-check control → e2e same file › "a re-check control
  re-reads through the bridge" (D5); draft versus live → component test in
  `ValidationPanel.test.tsx` (D3); mirror provenance → unit `provenance-client.test.ts` plus
  component tests in `ValidationPanel.test.tsx` (D4).

Coverage gate: AC1 → D5, AC2 → D2 + D5, AC3 → D3 + D5, AC4 → D2, AC5 → D3, AC6 → D3, AC7 → D1 + D5.
Every criterion has a deliverable and a named test; no manual residue.

## Done

**Summary.** Built the validation panel end to end: a shared `buildValidationSnapshot()` composition
now backs both `npm run validate` and the browser (D1), a pure view model reshapes the report plus
story 013's repository findings for one selection (D2), a presentational `ValidationPanel` +
`SeverityBadge` render entry/repository findings, the all-clear state and a draft notice with
text+glyph severities (D3), mirror provenance reaches the browser through a new confined bridge route
(D4), and `StudioPage` wires the panel beside the library with a working finding→entry jump and a
re-check control that genuinely re-reads through the bridge, proven end to end by an e2e spec that
shells out to the real CLI and compares its JSON against the rendered panel (D5).

**Commit message.**
```
017: validation panel in the studio
```

**Verification.**
- `npm run build` (studio) — pass.
- `npm run typecheck` (studio) — pass.
- `npx eslint .` (studio) — pass (clean, no findings).
- `npm run test` (studio, `vitest run`) — 316 passed, 4 failed; the 4 failures
  (`tests/mirror-set.test.ts`, `tests/drift-provenance.test.ts`, `tests/mirrorDrift.test.ts`,
  `tests/launcher-core-unmodified.test.ts`) are a pre-existing CRLF line-ending mismatch in the
  `launcher-core/` mirror on this Windows checkout, confirmed identical (same 4 failures, same
  tests) on a `git stash` of every change this story made — not caused by this story.
- `npm run e2e` (studio, Playwright) — 29 passed, 0 failed, including all 6 new
  `validation-panel.spec.ts` specs and every pre-existing spec (015/016) untouched by the rewiring
  of `use-news-library.ts`/`StudioPage.tsx`.
- `npm run lint` (studio, `eslint . && prettier --check .`) — ESLint clean; Prettier reports the
  same pre-existing CRLF formatting mismatch across ~170 files repo-wide (confirmed pre-existing via
  `git stash`), none of them touched by this story beyond normal LF edits.
- Clean-agent review: **PASS**, no blocking findings. Two non-blocking observations noted and
  accepted as-is: `ValidationPayload.repositoryFindings` stays typed `unknown[]` rather than
  `RepositoryFinding[]` (pass-through is verified by test, just loosely typed); `useNewsLibrary()`'s
  `refresh()` does not flip `loading` back to `true` while re-fetching (harmless for this story's
  criteria, worth revisiting if a future story adds a loading indicator to the re-check flow).
- AC → test mapping, as verified in the review and by direct test runs: AC1 e2e pass, AC2 e2e +
  unit pass, AC3 e2e + component pass, AC4 unit pass, AC5 component pass, AC6 component pass, AC7
  e2e pass (genuinely executes `scripts/validate.ts --json` and compares). No manual residue.

**Decisions.**
- D1 needed an unplanned Node-side module-resolution hook (`studio/scripts/mirror-boundary-hooks.ts`
  + a `rootDirs` addition in `studio/tsconfig.node.json`) to make `collectRepositoryFindings()`
  reachable from the CLI at all: wiring it in pulled `contract/launcher-safe-names.ts` into a Node
  graph for the first time, and its mirrored `resolve-feed-images.ts` imports two launcher files
  that previously only resolved through the Vite dev-server's own `launcherBoundary.ts` plugin arm.
  The new hook redirects exactly the same two relative imports to the same studio-owned stubs,
  registered by `validate.ts` itself so every invocation works with no caller change, and never
  touches `studio/src/launcher-core/` itself (confirmed empty diff there) — reviewed and accepted as
  the minimal fix for a real gap, not scope creep.
- The panel's "fine, but a draft nobody will see" requirement (Decisions (Sprint)) cannot be met by
  `panel-model.ts` alone: a draft is never in `ContentReport.entries`, so `buildPanelModel()`
  correctly returns `entry: undefined` for a draft selection. `ValidationPanel` closes this gap by
  also accepting an optional `selectedRow?: LibraryRow` (story 016) and rendering a distinct draft
  notice when `panelModel.entry` is undefined but the selected row's `status === 'draft'` — reviewed
  and confirmed sound (draft ids and index-declared entry ids live in different id spaces).
- `panel-model.ts`'s `field` derivation (AC2) is a flat `kind → field` lookup
  (`declared-image-missing` → `image`; the three per-button pipeline kinds → `url`) rather than a
  per-button cross-reference into `EntryVerdict.buttons`, since all three button kinds mean the same
  field regardless of which button they concern.
- `status` on a panel entry reuses story 016's `LibraryStatus` vocabulary and `dropped > visibility`
  precedence, reproduced locally in `panel-model.ts` rather than imported (those helpers are not
  exported from `library-model.ts`, and this deliverable was scoped to not touch story 016's files).
- The browser side continues to derive `ContentReport`/`RepositoryFinding[]` via
  `descriptor.validators` (`content-types/descriptors.ts`, story 014) rather than calling
  `buildValidationSnapshot()` a second time in the browser; both paths call the same underlying
  `buildNewsReport`/`toRepositoryScan`/`collectRepositoryFindings` functions on the same adaptation,
  so AC7's agreement holds without a second snapshot round-trip or a duplicate bridge read.
