---
id: 017
title: Validation panel in the studio
status: ready # draft -> ready -> in-progress -> done
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

- [ ] **AC1** — The panel shows the selected entry's verdict: declared form, delivered form, and
      every finding attached to it.
- [ ] **AC2** — A fallback is shown with the rule that caused it and the field to fix — the missing
      image path, the rejected button URL.
- [ ] **AC3** — Repository-level findings from story 013 are shown in one place, separate from the
      selected entry's own findings.
- [ ] **AC4** — Every finding names the file it concerns.
- [ ] **AC5** — A repository with no findings shows an explicit all-clear state, not an empty area
      that could equally mean "not checked yet".
- [ ] **AC6** — The panel distinguishes severities visually, and the distinction survives being read
      without colour.
- [ ] **AC7** — The panel's verdicts and the `validate` command's verdicts agree for the same
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

- AC1 → e2e `studio/e2e/validation-panel.spec.ts` › "the panel shows the selected entry's declared
  and delivered form with its findings" (D5)
- AC2 → e2e `studio/e2e/validation-panel.spec.ts` › "a missing image names the rule and the field to
  fix" (D5) **and** unit `studio/src/validate/panel-model.test.ts` › "a rejected button URL names the
  button's url field and the reason" (D2) — the repository the dev server serves carries no fallback
  entry, so the button case is proven over a fixture.
- AC3 → e2e `studio/e2e/validation-panel.spec.ts` › "repository-level findings are listed in their
  own region, separate from the entry's findings" (D5) **and** component
  `studio/src/organisms/ValidationPanel.test.tsx` › "entry findings and repository findings never
  mix" (D3)
- AC4 → unit `studio/src/validate/panel-model.test.ts` › "every finding view names a file, falling
  back to news/index.json" (D2)
- AC5 → component `studio/src/organisms/ValidationPanel.test.tsx` › "a snapshot without findings
  shows the all-clear state" (D3) — a rendered state, not a user action; the served repository has
  findings, so e2e cannot reach this state.
- AC6 → component `studio/src/organisms/SeverityBadge.test.tsx` › "every severity is readable as
  text and glyph without colour" (D3)
- AC7 → e2e `studio/e2e/validation-panel.spec.ts` › "the panel and npm run validate --json agree for
  the same repository" (D5, over D1's shared composition)
- Sprint decisions: the clickable jump → e2e `studio/e2e/validation-panel.spec.ts` › "clicking a
  finding selects its entry" (D5); draft versus live → component test in D3; mirror provenance →
  unit plus component tests in D4.

Coverage gate: AC1 → D5, AC2 → D2 + D5, AC3 → D3 + D5, AC4 → D2, AC5 → D3, AC6 → D3, AC7 → D1 + D5.
Every criterion has a deliverable and a named test; no manual residue.

## Done

<Filled by `/build 017`.>
