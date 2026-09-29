---
id: 025
title: New entry from the templates kit
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

`news/_templates/` already contains a copy-and-fill starter kit: one folder per template, each with
a `template.md` and a README covering its fields, image requirements and a worked example. It is a
good kit. It is also a kit you have to know exists, find, copy by hand, rename to the right date and
slug, and then remember to add to `index.json`.

Starting a post should be picking a template and typing a title. The kit stays the source of what a
new entry contains, so the studio and the documentation cannot drift apart.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-23.

## Acceptance Criteria

- [ ] **AC1** — A new entry is created by picking one of the four templates, with the same
      one-screen guidance the kit's README gives about which to choose.
- [ ] **AC2** — The new file's contents come from `news/_templates/<template>/template.md`; the
      studio holds no second copy of the starter content.
- [ ] **AC3** — The file name follows the repository's convention, `YYYY-MM-DD-slug.md`, with the
      slug derived from the title and editable before creation.
- [ ] **AC4** — The new entry starts as a draft — the file is written, `index.json` is untouched —
      until it is published by story 027.
- [ ] **AC5** — A file name that already exists is refused, with the existing entry named.
- [ ] **AC6** — A slug that collides with an existing entry's `id` is refused, since the launcher
      would keep only one of them.
- [ ] **AC7** — The created file opens in the editor with its template's required fields visible and
      empty rather than pre-filled with placeholder text that could be published by accident.

## Open Questions

- ~~Is the date in the file name the creation date or the intended publication date? The existing
  entries do not settle it, and an entry written in September for an October release makes the two
  differ.~~ answered → Decisions (Sprint)
- ~~Does creating an entry also create its `id`, and is the `id` always the slug? Every current entry
  follows that pattern, but nothing enforces it.~~ answered → Decisions (Sprint)
- ~~Should the studio offer to start from an existing entry ("duplicate this one") as well as from a
  template?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **File-name date:** it defaults to today's local date (the creation date) and the author can edit
  it before creating. Reason: the launcher never reads the file-name date, since release timing is
  `visibleFrom`, and the existing entries carry their writing date, not their `visibleFrom`.
- **`id`:** creating an entry writes no `id`. Ids exist only in `index.json`, and story 027 adds the
  row on publish. The slug is the id-to-be, so AC6 checks it. Reason: all four current entries have
  `id` equal to the slug, and AC6 already assumes that.
- **Id collision includes drafts:** a slug that equals the slug part of an existing draft's file name
  is refused just like one that equals a published `id`. Reason: that draft would publish with the
  same id, so allowing it only moves the collision into story 027.
- **Slug rule:** a slug must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the full file name must pass the
  mirrored `isSafeNewsDocumentName`. `slugify` lowercases the title, strips diacritics (NFKD) and
  collapses every other run of characters to `-`. Reason: every existing entry already follows this
  pattern, and the pattern is a strict subset of the launcher's safe-name rule.
- **No "duplicate this entry":** out of scope for this story. Reason: no criterion asks for it, and
  AC2 makes the kit the only source of starter content. It is a candidate follow-up story.
- **Which placeholders are cleared:** any frontmatter value containing an angle-bracket placeholder
  (`<...>`) is emptied. For example, `image: img/<your-image-file>.png` becomes `image:`. `title` gets
  the typed title. The body's `<...>` placeholder paragraph is removed, so the body starts empty.
  `#` comment lines (`visibleFrom`, `visibleUntil`, `buttons`) are kept verbatim, and so are
  `template:` and `order:`. Reason: commented lines are never published and serve as guidance.
  `order: 10` is a real value that story 027 reassigns on publish. A left-over `<...>` body is
  exactly the accidental publish AC7 guards against.
- **Title write:** the typed title's whitespace is collapsed to single spaces. The title is
  double-quoted only when the mirrored `parseFrontmatter` would otherwise read it back differently
  (for example, a title that starts and ends with quote characters). Reason: the round trip through
  the launcher's own parser is the only correctness measure that matters.
- **Guidance source:** the chooser reads its guidance from the `## Which template?` table in
  `news/_templates/README.md` through the bridge, not from studio text. Reason: this story exists so
  that the studio and the kit documentation cannot drift apart (Requirement, AC1).
- **Create is create-only:** the file is written through story 024's bridge write route in a
  create-only mode (exclusive open, `wx`). An existing file is refused server-side even if the
  client-side check was bypassed or raced. Reason: AC5 must hold at the point of writing, and a
  refused create must leave the existing file byte-identical.
- **E2E write isolation:** the spec uses whatever write-test isolation story 024 put in place. If 024
  shipped none, the spec creates entries in the real `news/` under an `e2e-025-` slug, deletes them in
  `afterEach`, and runs its tests serially. Reason: e2e runs against the real repository (there is no
  temp copy), and 024 is the story that owns the first-write test infrastructure.

## Plan

Builds on 022 (editor), 024 (bridge write route) and the S04 library. There is no new content
contract. The only new server behaviour is a create-only flag on 024's write route.

1. **Pure core** (`studio/src/new-entry/`, browser-safe, no `node:` imports):
   - `slugify`, `isValidSlug`, `newEntryFileName(date, slug)`.
   - `findNewEntryConflict(fileName, slug, libraryRows)` returns a refusal that names the existing
     entry (title + file). The file-name check runs before the id check.
   - `buildNewEntryText(templateText, title)` clears the placeholders as described in Decisions.
   - `parseTemplateGuidance(readmeText)` turns the README's "Which template?" table into
     `{template, useCase, image}` rows.
2. **Bridge:** add a create-only mode to 024's write route.
   - Exclusive create (`wx`); an existing path gets `409` with the path named.
   - It goes through the same `resolveBridgePath` guard as 024.
   - The client gets a `createFile(path, text)` method.
3. **UI:** a "New entry" action in the library view opens `NewEntryDialog`, which contains:
   - the four template choices, with guidance loaded from the README;
   - a title field;
   - a slug field, derived from the title and editable (typing into it stops auto-derivation);
   - a date field, defaulting to today;
   - a live file-name preview.

   Refusals show inline and disable Create. On Create:
   - fetch `news/_templates/<t>/template.md` through the bridge `file` route;
   - run `buildNewEntryText`;
   - `createFile`, then `refresh()` the library;
   - `selectEntry('news/<file>')`, which is the draft id convention. Selection goes through the same
     path as a library click, so 022's unsaved-changes warning still applies.

Order: D1 → D2 → D3. UI files follow `/frontend-guidelines` and `/design-tokens`. Nothing under
`news/` gets presentation. `launcher-core/` is untouched.

## Deliverables

- **D1 — New-entry core (pure) plus its unit tests.**
  - **Files:** `studio/src/new-entry/new-entry.ts`, `studio/src/new-entry/new-entry.test.ts`,
    `studio/src/new-entry/template-guidance.ts`, `studio/src/new-entry/template-guidance.test.ts`.
  - **Pattern to mirror:** `studio/src/library/library-model.ts` (pure, typed, colocated vitest).
  - **Imports:** `parseFrontmatter` from `studio/src/contract/launcher-contract.ts` and
    `isSafeNewsDocumentName` from `studio/src/contract/launcher-safe-names.ts`. Never import from
    `launcher-core/` directly, and never edit it.
  - **Exports:**
    - `slugify(title)`: lowercase, NFKD with combining marks removed, runs of `[^a-z0-9]` become `-`,
      trimmed of `-`.
    - `isValidSlug(slug)`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, and the full file name satisfies
      `isSafeNewsDocumentName`.
    - `newEntryFileName(date: 'YYYY-MM-DD', slug)` returns `` `${date}-${slug}.md` ``.
    - `findNewEntryConflict({ fileName, slug, rows })`. `rows` are library rows
      (`{ id, file, title?, status }`, see `studio/src/library/library-types.ts`). A draft's `id` is
      its repo path (`news/<file>`); a published row's `id` is its index id. Behaviour:
      - `fileName` equals an existing row's file basename: returns
        `{ kind: 'file-exists', existing }`.
      - Otherwise, `slug` equals a published row's `id`, or the slug part of a draft's file name
        (the name minus a leading `YYYY-MM-DD-` and `.md`): returns `{ kind: 'id-collision', existing }`.
      - Otherwise returns `undefined`.
    - `buildNewEntryText(templateText, title)`:
      - Inside the frontmatter block, every non-comment `key: value` whose value contains
        `<`…`>` is emptied to `key:`. `title:` gets the typed title (whitespace collapsed,
        double-quoted only when needed for `parseFrontmatter` to return it unchanged).
      - `#` comment lines, `template:`, `order:` and line order stay verbatim.
      - A body paragraph that is a `<...>` placeholder (it may span lines) is removed.
      - Line endings of the input are kept.
    - `parseTemplateGuidance(readmeText)`: reads the table under `## Which template?` and returns
      `[{ template, useCase, image }]`. `template` comes from the backticked link text. It returns
      `[]` when the section or table is missing, and never throws.
  - **Tests** (read the **real** `news/_templates/*/template.md` and `README.md` from disk via
    `node:fs` in the test only):
    - `"every kit template yields a new entry with no placeholder left"`: for all four templates, no
      `<`/`>` appears in the frontmatter's non-comment lines or in the body.
      `parseFrontmatter(out).data.template` equals the folder name; `data.title` equals the typed
      title; for `cover`/`split`, `data.image === ''`.
    - `"the typed title survives the launcher's parser"`: titles with `:`, `#`, surrounding quotes
      and multiple spaces.
    - `"slugify derives a safe slug from a title"`: includes umlauts/accents and a symbols-only title,
      which gives `''` and fails `isValidSlug`.
    - `"an existing file name is refused naming the entry"`.
    - `"a slug equal to an existing id is refused"`: covers both a published id and a draft's slug.
    - `"the kit README's guidance lists the four templates"`.
    - `"the studio source holds no copy of the starter content"`: reads each template.md and takes
      every placeholder text (`<...>`, at least 12 characters, e.g. `Your headline goes here`), then
      asserts that no file under `studio/src` contains it. Test files and `launcher-core/` are
      excluded.
- **D2 — Create-only write through the bridge plus its tests.**
  - **Files:** the write route story 024 added in `studio/src/bridge/create-file-bridge.ts`,
    `studio/src/bridge/bridge-protocol.ts` (the request/response shape for the create-only flag),
    `studio/src/bridge/client.ts` (`createFile(path, text)`), and
    `studio/tests/file-bridge-server.test.ts`.
  - **Pattern to mirror:** 024's save/write route and its tests in the same files.
  - **Behaviour:**
    - Same `resolveBridgePath` guard, Host/Origin checks and localhost-only rules as 024's write.
    - The file is written with `writeFileSync(abs, text, { flag: 'wx' })`. `EEXIST` gives `409` and
      a message naming the path. No parent directory is created: the target must sit directly under
      an existing declared directory.
    - No other file is touched, and there is no git and no network.
    - `createFile` resolves to `{ ok: true } | { ok: false, status, message }`.
  - **Tests**, each against a temp repo (`studio/tests/git-fixture.ts` or the fixture the existing
    bridge server tests use):
    - `"create-only writes a new file under news/"`.
    - `"create-only refuses an existing file and leaves it byte-identical"`.
    - `"create-only refuses a path outside the declared directories"`.
    - `"create-only leaves index.json byte-identical"`.
- **D3 — New-entry dialog in the library plus its e2e spec.**
  - **Files:** `studio/src/organisms/library/LibraryView.tsx` (a "New entry" button),
    `studio/src/organisms/new-entry/NewEntryDialog.tsx`,
    `studio/src/molecules/TemplateChoice.tsx` (one radio card: template name, use case, image need),
    `studio/src/new-entry/use-new-entry.ts`, and `studio/e2e/new-entry.spec.ts`.
  - **Patterns to mirror:** `studio/src/library/use-news-library.ts` (hook shape, injected bridge
    client), `studio/src/organisms/library/LibraryView.tsx`, and `studio/e2e/library-view.spec.ts`
    (real-repo reads, `e2e/fixtures/localhost-only.ts` `test`).
  - **`useNewEntry`:**
    - Loads `news/_templates/README.md` through the bridge `file` route and parses it with
      `parseTemplateGuidance` from `studio/src/new-entry/template-guidance.ts`.
    - Exposes `create({ template, title, slug, date })`, which runs in this order: fetch
      `news/_templates/<template>/template.md` through the `file` route, `buildNewEntryText` from
      `studio/src/new-entry/new-entry.ts`, then `createFile('news/<fileName>', text)`.
    - On success it calls the library's `refresh()`, then `selectEntry('news/<fileName>')` from
      `studio/src/context/current-entry-context.tsx`. That is the draft id convention; use the same
      selection path as a library row click.
    - A `409` from the server is shown as the file-exists refusal.
  - **Dialog:**
    - Four template choices, in README order, with the README's use case and image need. When the
      guidance fails to load, it shows the four names from the mirrored `NewsTemplate` list and says
      the guidance is unavailable.
    - A title field and a slug field. The slug is derived with `slugify` until the author edits it.
    - A date field (`YYYY-MM-DD`, default today local) and a live file-name preview.
    - Inline refusal text from `findNewEntryConflict`/`isValidSlug`, naming the existing entry's
      title and file. Create is disabled while a refusal stands or no template or title is set.
  - **Styling:** only through the studio's semantic tokens (`/design-tokens`), in atomic layers
    (`/frontend-guidelines`). Touch targets and focus states per the skill. Colour is never the only
    signal of a refusal.
  - **E2E isolation:** follow 024's e2e write isolation if it has one. Otherwise run the file
    serially, use `e2e-025-` slugs, and delete every created file in `afterEach` via `node:fs`.
  - **Tests** in `studio/e2e/new-entry.spec.ts`: see Acceptance Tests AC1, AC3–AC7.

## Model Hints

- All deliverables default tier. D2 is small and mirrors 024's route. D1's subtle part, the
  placeholder clearing, is pinned by tests against the real kit files.
- Review: → default. The one plausible-looking wrong implementation, starter text hardcoded in
  `studio/src`, is caught by D1's structural test, so no test-blind claim is left for a second pass.

## Acceptance Tests

- AC1 → e2e `studio/e2e/new-entry.spec.ts` › "the new-entry dialog offers the four templates with
  the kit's guidance". It asserts the four names and each README table row's use-case text, parsed in
  Node from the real `news/_templates/README.md`. Plus unit
  `studio/src/new-entry/template-guidance.test.ts` › "the kit README's guidance lists the four
  templates".
- AC2 → unit `studio/src/new-entry/new-entry.test.ts` › "the studio source holds no copy of the
  starter content". Plus e2e `studio/e2e/new-entry.spec.ts` › "a new entry is written from its kit
  template", which asserts that the created file's text equals
  `buildNewEntryText(<real template.md>, title)` and keeps the template's comment lines.
- AC3 → e2e `studio/e2e/new-entry.spec.ts` › "the file name is dated and slugged from the title,
  and the slug is editable". Plus unit `studio/src/new-entry/new-entry.test.ts` › "slugify derives a
  safe slug from a title".
- AC4 → e2e `studio/e2e/new-entry.spec.ts` › "a new entry is a draft and index.json is untouched".
  It checks `news/index.json` bytes before and after, and that the library row shows status `draft`.
  Plus unit `studio/tests/file-bridge-server.test.ts` › "create-only leaves index.json
  byte-identical".
- AC5 → e2e `studio/e2e/new-entry.spec.ts` › "an existing file name is refused naming the existing
  entry", using date `2026-09-10` and slug `how-news-reaches-the-launcher`. Plus unit
  `studio/src/new-entry/new-entry.test.ts` › "an existing file name is refused naming the entry",
  and unit `studio/tests/file-bridge-server.test.ts` › "create-only refuses an existing file and
  leaves it byte-identical".
- AC6 → e2e `studio/e2e/new-entry.spec.ts` › "a slug that matches an existing id is refused", using
  a different date with slug `welcome-to-the-community`. Plus unit
  `studio/src/new-entry/new-entry.test.ts` › "a slug equal to an existing id is refused".
- AC7 → e2e `studio/e2e/new-entry.spec.ts` › "the created entry opens in the editor with required
  fields empty". For `cover`, the editor shows the typed title, an empty `image` field marked
  required, and no `<` placeholder text in any field or in the body. Plus unit
  `studio/src/new-entry/new-entry.test.ts` › "every kit template yields a new entry with no
  placeholder left".

## Done

<Filled by `/build 025`.>
