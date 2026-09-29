---
id: 022
title: Frontmatter editor with live validation
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Frontmatter is where every silent failure starts. A field name that is not in the contract is simply
ignored, a button URL pointing at the wrong host disappears, a fourth button is dropped, and a
`template` value nobody recognises quietly becomes `text`. None of it produces an error anywhere.

Editing it as a form rather than as raw YAML turns most of those into impossibilities and the rest
into something the author is told about while typing, not after publishing.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-20.

## Acceptance Criteria

- [x] **AC1** — `template`, `title`, `order`, `image`, `visibleFrom`, `visibleUntil` and `buttons`
      are editable as fields.
- [x] **AC2** — The fields offered follow the selected template: no `image` field for `text`, and
      the `image` field is marked as required for `split` and `cover`.
- [x] **AC3** — A button URL the launcher would reject is flagged while typing, naming the rule it
      breaks.
- [x] **AC4** — Adding a fourth button is flagged as one the launcher will drop, and which one.
- [x] **AC5** — A date that is not a valid ISO 8601 instant is flagged before it can be saved.
- [x] **AC6** — No field allows a value that would carry presentation into the published surface —
      no HTML, no CSS, no colour or layout value.
- [x] **AC7** — Editing changes nothing on disk until the entry is saved; leaving an entry with
      unsaved changes warns rather than discarding silently.

## Open Questions

- ~~Is a raw-frontmatter escape hatch needed for a field the form does not know? It would let an
  author work ahead of a contract change — and let them write the unsupported fields the contract
  explicitly warns against.~~ answered → Decisions (Sprint)
- ~~Should `order` be editable here at all, given story 027 owns reordering? Two ways to change the
  same number invite them disagreeing.~~ answered → Decisions (Sprint)
- ~~What does the date field offer — a picker, or a text field with validation? A picker has to make a
  decision about time zones that the contract leaves to ISO 8601.~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Is `order` editable in the form: read-only in the form; story 027 owns reordering
- `order` is shown as a read-only field with the frontmatter's value, and AC1 is read with that
  (User) decision applied — the binding decision narrows "editable" for this one field.
- No raw-frontmatter escape hatch; lines the form does not know (unknown fields, comments) stay
  untouched in the document text for 024's writer to preserve — the contract says an unsupported
  field is not read, and a hatch would reopen exactly the silent failure this story removes.
- The date fields are text inputs validated as a strict ISO 8601 instant (date, time and `Z` or
  `±hh:mm`), no picker — a picker must choose a time zone, and an explicit zone removes the
  ambiguity the launcher's lenient `Date.parse` would silently resolve to local time.
- The studio's date rule is deliberately stricter than the launcher's `Date.parse` — AC5 names an
  ISO 8601 instant, and anything looser is what the launcher accepts or ignores without a word.
- An invalid date and a presentation value are **errors that block saving** (`canSave` false, which
  024's save consumes); button flags are **warnings** — AC5/AC6 say "before it can be saved" / "no
  field allows", AC3/AC4 say "flagged", and a dropped button never drops the entry.
- The button verdict comes from the mirrored exports (`newsButtonSchema`, `isAllowedButtonHost`,
  `MAX_BUTTONS_PER_SLIDE`) and the cap is counted over surviving buttons only, exactly as
  `sanitizeButtons()` does — the concept makes the mirror the validation engine, and a studio rule
  set of its own would drift.
- The form is initialised with the mirrored `parseFrontmatter()` — "declared" means what the
  launcher reads (the convention in `studio/src/report/report-types.ts`), never a second parser.
- An unknown `template` value is shown as declared, flagged as falling back to `text`, and gets
  `text`'s field set — that mirrors the launcher's own fallback.
- Switching to `text` hides the `image` field; the value stays in the draft (switching back
  restores it) but is outside `fieldsFor('text')`, so 024 must not write it — `text` has no image
  field in the contract.
- Presentation is detected by five rules: HTML tags/comments, CSS declarations or `style=`, CSS
  functions (`rgb(`, `hsl(`, `var(`, `calc(`, `url(` …), hex colours containing at least one letter
  a–f, and CSS lengths (`px`, `rem`, `em`, `vh`, `vw`) — this covers AC6 while "Patch #123" and
  "50% off" stay ordinary titles.
- Leaving an entry with unsaved changes asks via `window.confirm` (entry switch, Re-check,
  content-type switch) and `beforeunload` (tab close/reload) — the smallest mechanism, testable
  through Playwright's dialog events, no new dialog component.
- A document whose frontmatter `parseFrontmatter()` cannot read gets no form, only a notice — with
  no escape hatch, a form over text it cannot see would overwrite that text on save.
- The editor shows a status line (unsaved changes; number of issues that block saving) — it makes
  AC5's "before it can be saved" observable before 024 exists and is where 024's save button goes.
- The validation panel and the preview keep showing the on-disk report; feeding the draft into the
  report/preview is not in these criteria and belongs to 023/024.

## Plan

A form over the selected entry's frontmatter, held as an in-memory draft; nothing is written (024
saves). Two pure modules first, then the UI, then the leave guard.

1. **Draft model** (`studio/src/editor/frontmatter-draft.ts`) — reads the document with the mirrored
   `parseFrontmatter()`, holds the seven fields, knows the field set per template and whether the
   draft differs from what was read.
2. **Field rules** (`studio/src/editor/field-rules.ts`) — per-field issues: button URL/label rules
   and the three-button cap (verdict from the mirrored exports, cap over survivors), strict ISO 8601
   instant, presentation detector. Each issue names its rule and says whether it blocks saving;
   `canSave(draft)` is the seam 024 consumes.
3. **Editor UI** — `FrontmatterEditor` organism next to the library for the selected entry or
   draft, draft held in a new `EntryDraftProvider`; issues inline under their field, as text (not
   colour only); status line with unsaved state and blocking-issue count; `order` read-only.
4. **Leave guard** — every way of leaving a dirty draft (entry switch from library or panel,
   Re-check, content-type switch, tab close/reload) asks first; declining keeps the edits.

Not in scope: writing (024), body editing (023), feeding the draft into the report/preview, an
escape hatch for unknown fields. `studio/src/launcher-core/` is only imported, never edited.

## Deliverables

- [x] **D1 — Frontmatter draft model.** New `studio/src/editor/frontmatter-draft.ts` plus
  `studio/src/editor/frontmatter-draft.test.ts` (vitest, node env; mirror the style of
  `studio/src/report/build-news-report.ts` for importing the mirror).
  - `draftFromDocument(file, text)` → `EntryDraft | { unreadable: true }`: reads with the mirrored
    `parseFrontmatter()` from `studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts`
    (never a second parser); `undefined` from it → `unreadable`. Fields, all strings as authored:
    `template`, `title`, `order`, `image`, `visibleFrom`, `visibleUntil`, `buttons: {label, url}[]`.
    Keep the original text on the draft (024 patches it; unknown lines and comments are untouched).
  - `updateDraft(draft, patch)` returns a new draft; `isDirty(draft)` compares fields with those read
    initially (order-sensitive for buttons).
  - `fieldsFor(template)`: `split`/`cover` → image offered **and required**; `banner` → image
    optional; `text` and any unknown value → no image. `isKnownTemplate(value)` for the four
    contract values. Switching to `text` keeps the `image` value on the draft (switching back
    restores it) — it is simply outside `fieldsFor('text')`, which 024 must honour when writing.
  - Tests: "a document is read into fields with the mirrored parser", "unparseable frontmatter
    yields an unreadable draft", "fieldsFor offers image only for split, banner and cover and
    requires it for split and cover", "an unknown template gets the text field set", "a draft is
    dirty after an edit and clean after reverting it".

- [x] **D2 — Field rules.** New `studio/src/editor/field-rules.ts` plus
  `studio/src/editor/field-rules.test.ts`. `validateDraft(draft)` → `FieldIssue[]` with
  `{ field, index?, rule, message, blocksSave }`; `canSave(draft)` = no issue with `blocksSave`.
  - **Buttons (warnings, `blocksSave: false`).** Verdict per button from the mirrored exports only:
    `newsButtonSchema` (`studio/src/launcher-core/src/shared/modules/home.ts`), then
    `isAllowedButtonHost`, then `MAX_BUTTONS_PER_SLIDE` (`.../main/modules/home/news/feed-pipeline.ts`).
    The message names the rule: missing label, not a URL, not `https`, or host `<host>` is not
    exactly `github.com` / `raw.githubusercontent.com` (subdomains included — list from
    `NEWS_BUTTON_HOST_ALLOWLIST`). Derive the wording with `new URL`, but the kept/dropped verdict is
    the launcher's. **Cap:** like `sanitizeButtons()`, the cap counts **surviving** buttons only — a
    button is flagged "dropped: beyond the cap of 3" (naming its position and label) only if three
    valid buttons precede it; with button 2 invalid, button 4 survives.
  - **Dates (errors, `blocksSave: true`)** for `visibleFrom`/`visibleUntil`: empty = omitted, valid.
    Otherwise must match `YYYY-MM-DDTHH:MM[:SS[.sss]](Z|±HH:MM)`, be a real calendar date/time (check
    components explicitly — do not rely on `Date.parse` to reject `2026-02-30`), and `Date.parse` must
    be finite. A date alone gets the message "a date alone is not an instant — add a time and a zone,
    e.g. 2026-08-01T00:00:00Z".
  - **Presentation (errors, `blocksSave: true`)** on `title`, `image` and every button `label`, each
    rule named in the message: HTML tag or comment (`<b>`, `</p>`, `<!--`), CSS declaration or
    `style=` (`color: red;`), CSS function (`rgb(`, `rgba(`, `hsl(`, `hsla(`, `var(`, `calc(`,
    `url(`), hex colour (`#` + 3/4/6/8 hex digits containing at least one letter a–f), CSS length
    (a number followed by `px`, `rem`, `em`, `vh`, `vw`). Must pass: "Patch #123", "50% off",
    "Quake II: the return".
  - **Template:** an unknown value → warning "unknown template, delivered as text".
  - Tests: "a rejected button url names the rule it breaks", "the url verdict agrees with the
    launcher's allowlist" (table of URLs; studio kept/dropped equals schema+`isAllowedButtonHost`),
    "the button beyond the cap of three survivors is named as dropped", "only a full ISO 8601
    instant with a zone passes", "presentation values are refused in every free-text field",
    "ordinary titles are not mistaken for presentation", "canSave is false while an error stands".

- [x] **D3 — Frontmatter editor UI.** Touches: new `studio/src/context/entry-draft-context.tsx`
  (`EntryDraftProvider`, `useEntryDraft()` → `{ draft, update, isDirty, issues, canSave, reset }`;
  mirror `studio/src/context/current-entry-context.tsx`), new
  `studio/src/organisms/editor/FrontmatterEditor.tsx`, new field molecules under
  `studio/src/molecules/editor/` (text field with inline issue, button list), 
  `studio/src/library/use-news-library.ts` (expose the read's raw document text per file — reuse it
  if story 018 already exposed it), `studio/src/pages/studio/StudioPage.tsx` (render the editor for
  the selected row, entries and drafts alike), `studio/src/styles/index.css` (semantic tokens for
  field error/warning/focus if missing — no raw palette classes or hex in components), new
  `studio/e2e/frontmatter-editor.spec.ts` and `studio/e2e/fixtures/editor-feed.ts` (stub
  `GET /__studio/fs/read?type=news` with `page.route` before `goto('/')`, as
  `studio/e2e/library-view.spec.ts` does with `studio/e2e/fixtures/library-feed.ts`).
  - Uses D1/D2 (`studio/src/editor/frontmatter-draft.ts`, `field-rules.ts`). Fields: template
    (select of the four; an unknown declared value shown as-is with its warning), title, order
    (read-only, note "reordering happens in the library"), image (per `fieldsFor`, "required" marker
    for split/cover), visibleFrom/visibleUntil (text inputs, placeholder `2026-08-01T00:00:00Z`),
    buttons (add/remove/edit label and url). Issues re-evaluate on every input and render under their
    field as text with the rule name, linked via `aria-describedby`. Status line: "Unsaved changes"
    when dirty, "N issue(s) block saving" when `!canSave`. An unreadable draft shows a notice
    ("the frontmatter cannot be read — the launcher drops this entry") and no form.
  - Tests (e2e): "every contract field is shown as a field, order read-only", "the field set
    follows the selected template", "a button url on a wrong host is flagged while typing", "a
    fourth button is flagged as dropped", "an invalid date is flagged and blocks saving", "an HTML
    tag in the title is refused".

- [x] **D4 — Unsaved-changes guard.** Touches `studio/src/context/entry-draft-context.tsx` (add
  `confirmDiscard(): boolean` — true when clean, else `window.confirm("Discard unsaved changes to
  <file>?")`; register a `beforeunload` handler only while dirty),
  `studio/src/pages/studio/StudioPage.tsx` (route `selectEntry` for `LibraryView` and
  `ValidationPanel`, the Re-check handler and `ContentTypeNav`'s `onSelect` through
  `confirmDiscard()`; the provider must therefore sit above `ContentTypeNav`; re-selecting the
  current entry is not leaving), and `studio/e2e/frontmatter-editor.spec.ts`. Declining keeps entry and
  edits; accepting switches and drops the draft. A clean draft never asks (existing e2e specs must
  stay green).
  - Tests (e2e): "editing issues no write request" (record every request; none to `/__studio/` other
    than `GET`/`HEAD`), "leaving a dirty entry asks first and keeps the edits when declined",
    "closing the tab with unsaved changes asks first" (`page.close({ runBeforeUnload: true })`,
    dialog type `beforeunload`).

## Model Hints

- D1 → default
- D2 → default (the survivors-only cap and the calendar check are spelled out above and each has
  its own test)
- D3 → default
- D4 → default
- Review: → default — every rule with a way to be subtly wrong (cap over survivors, launcher-agreeing
  URL verdict, calendar check, presentation false positives) carries a named test, so a wrong
  implementation fails a test rather than passing a default review.

## Acceptance Tests

- AC1 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "every contract field is shown as a field,
  order read-only"; unit `studio/src/editor/frontmatter-draft.test.ts` › "a document is read into
  fields with the mirrored parser"
- AC2 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "the field set follows the selected template";
  unit `studio/src/editor/frontmatter-draft.test.ts` › "fieldsFor offers image only for split,
  banner and cover and requires it for split and cover"
- AC3 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "a button url on a wrong host is flagged while
  typing"; unit `studio/src/editor/field-rules.test.ts` › "a rejected button url names the rule it
  breaks", "the url verdict agrees with the launcher's allowlist"
- AC4 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "a fourth button is flagged as dropped"; unit
  `studio/src/editor/field-rules.test.ts` › "the button beyond the cap of three survivors is named
  as dropped"
- AC5 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "an invalid date is flagged and blocks
  saving"; unit `studio/src/editor/field-rules.test.ts` › "only a full ISO 8601 instant with a zone
  passes", "canSave is false while an error stands"
- AC6 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "an HTML tag in the title is refused"; unit
  `studio/src/editor/field-rules.test.ts` › "presentation values are refused in every free-text
  field", "ordinary titles are not mistaken for presentation"
- AC7 → e2e `studio/e2e/frontmatter-editor.spec.ts` › "editing issues no write request", "leaving a
  dirty entry asks first and keeps the edits when declined", "closing the tab with unsaved changes
  asks first"; unit `studio/src/editor/frontmatter-draft.test.ts` › "a draft is dirty after an edit
  and clean after reverting it"

Coverage: AC1 D1+D3 · AC2 D1+D3 · AC3 D2+D3 · AC4 D2+D3 · AC5 D2+D3 · AC6 D2+D3 · AC7 D1+D4.

## Done

Frontmatter editor: a pure draft model (mirrored `parseFrontmatter`, dirty tracking, per-template field set) and pure field rules (launcher-agreeing button verdict with survivors-only cap, strict ISO 8601 dates, presentation detector, `canSave`). The `FrontmatterEditor` organism shows inline, rule-named issues and a status line, `order` read-only, unreadable frontmatter as a notice. An unsaved-changes guard covers entry switch, Re-check, content-type switch and `beforeunload`. Nothing is written to disk.

Commit message: `022: frontmatter editor (draft model, live field rules, unsaved-changes guard)`

Verification (narrow gate): `npm run build`, `typecheck`, eslint green; `test --workspace studio -- --changed HEAD` green; `e2e --workspace studio -- e2e/frontmatter-editor.spec.ts` 11/11 green. Review 1 (default tier): PASS, no blocking findings.
- AC1-AC7 -> named unit and e2e tests all ran and passed (as mapped in `## Acceptance Tests`); no manual residue.
- Pre-existing red, not caused here: `npm run lint` prettier on 163 untouched files; 5 vitest failures (drift-provenance, launcher-core-unmodified, mirror-set, mirrorDrift, repo-contract).

Decisions:
- `EntryDraftProvider` sits above everything in a `StudioPage` wrapper; `NewsLibrary` reports `{file, text}` up via a layout effect so the library read was not lifted. An accepted Re-check resets the draft.
- `use-news-library.ts` and `index.css` unchanged (`read` already exposed by 018; existing severity/selected/muted tokens suffice). New helper `studio/src/library/document-text.ts`.
- Two extra e2e tests (unknown template, unreadable draft) follow the Decisions above.
- Unfixed minor review notes: e2e covers only entry switch and `beforeunload` for the guard; CSS-declaration rule would refuse a title like "Update: v1.2; fixes" (conservative by design, AC6).

tiers: D 4 / hard 0 · review default · cycles 0 · agents 6
