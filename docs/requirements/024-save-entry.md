---
id: 024
title: Saving an entry writes the document and its index row
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

This is the first story in which the studio writes to the repository, and the first in which it can
do damage. Two files are involved and they have very different risk profiles: an entry's own `.md`
file affects one slide, while `news/index.json` is the file the launcher reads first and the one
that decides whether the whole feed loads.

The requirement is therefore as much about restraint as about writing: touch what the save concerns
and nothing else, and leave a diff a human can actually review before committing.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-22, open point 2 and 3.

## Acceptance Criteria

- [ ] **AC1** — Saving writes the entry's `.md` file with its frontmatter and body.
- [ ] **AC2** — For a published entry, the matching row in `news/index.json` is updated to agree
      with the document.
- [ ] **AC3** — Every file the save does not concern is byte-identical afterwards, including the
      other rows in `index.json`.
- [ ] **AC4** — A round trip is lossless: saving an entry and reading it back yields the same entry,
      with no field silently dropped, reordered or reformatted.
- [ ] **AC5** — A save that would produce an entry the launcher drops is not written silently — the
      author is told what will happen and confirms it deliberately.
- [ ] **AC6** — A file that changed on disk since it was opened is not overwritten without the
      author being told.
- [ ] **AC7** — The save writes only inside the content type's declared directory, and the file
      bridge refuses anything else.
- [ ] **AC8** — No save ever performs a git operation or reaches the network.

## Open Questions

- ~~What is the formatting policy for `index.json` — preserve the existing file byte-for-byte apart
  from the row being changed, or reformat the whole file to a canonical shape? Reformatting is far
  simpler and produces a diff nobody can read. This is open point 3 in the concept and it has to be
  decided before this story is refined.~~ answered → Decisions (Sprint)
- ~~Does the frontmatter writer preserve field order and comments, or normalise them? The same
  trade-off, one level down.~~ answered → Decisions (Sprint)
- ~~Should a save be a save, or should the studio hold changes until an explicit "write to disk"?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** index.json formatting policy: canonical reformat of the whole file (chosen over byte-preserving; the diff noise is accepted)
- **(User)** Frontmatter writer and save behaviour: the writer preserves field order and comments; a save writes to disk immediately (no explicit 'write to disk' step); no git operations
- AC3 vs. canonical reformat: the canonical form is `JSON.stringify(value, null, 2)` plus one
  trailing newline, which is exactly the shape `news/index.json` has today. On the current file the
  other rows therefore stay byte-identical. An index that is not canonical gets reformatted once,
  which the (User) decision accepts.
- `index.json` is written only when the matching row actually changes. A draft save, or a save
  whose row already agrees, leaves the file untouched. Reason: AC3 says a file the save does not
  concern stays byte-identical.
- "The row agrees with the document" means `order` only. `id` and `file` identify the row. The
  launcher sorts by the frontmatter `order` and reads nothing else of the document into the row
  (`feed-pipeline.ts:337`). Unknown row keys are preserved. If the document has no usable `order`,
  the row is left as it is.
- Line endings and BOM: the writers work on LF text, and the server restores the on-disk file's
  CRLF and BOM when it writes. New files are written as LF. Reason: this checkout runs
  `core.autocrlf=true`, and flipping line endings would make every save a whole-file diff.
- The frontmatter writer is a text patch over the original, not a re-serialisation. A key absent
  from the patch is untouched, `null` removes it, and a new key is appended before the closing
  fence. Comments, unknown lines and quote style survive. Reason: the mirrored parser silently
  ignores comments, so re-serialising parsed data would lose them, which violates the (User)
  decision.
- A value the mirrored `parseFrontmatter` would not read back unchanged, even in quotes (for
  example one containing a newline), is refused with a reason rather than written. Reason: the
  launcher's parser is the only reader that counts (AC4).
- A buttons edit rewrites only the `buttons:` block. Comment lines inside that block are carried
  over directly after the `buttons:` line. Reason: this is lossless without a positional merge.
- The conflict token is the normalised text the editor opened. The server compares it with
  `normaliseText(disk)`, answers `409` with the current text when they differ, and the UI then
  offers "Overwrite" or "Cancel". Reason: this is exact and needs no hashing on either side (AC6).
- The drop confirmation (AC5) applies to published entries only and is computed with the mirrored
  `resolveFeed`. A fallback (for example `cover`→`text`) does not trigger it. Draft saves get no
  dialog. Reason: the launcher drops only what it reads, and publishing a draft is gated by 027
  AC6.
- There is one generic `POST /__studio/fs/write` route taking a write set. Every guard and conflict
  check runs before the first write, and each file is written to a temp file and then renamed.
  Reason: 025 and 027 need the same route (create = `expected: null`, reorder = several files),
  and a half-written `index.json` breaks the whole feed.
- Writable means the directories of descriptors in state `implemented` (only `news`). Inside them,
  only `index.json` and `*.md` outside `_templates/` and `img/` are accepted. Reason: AC7, plus
  the concept keeps `engines/`/`gamedata/` out of v1 writes. Images belong to 026's own route.
- POST requires a loopback `Origin` (a missing one is refused), `Content-Type: application/json`
  and a body under 1 MB. Reason: this is the first state-changing route, so default-deny against
  cross-site form posts.
- e2e writes never touch the real `news/`. A second Playwright project runs its own dev server with
  `STUDIO_E2E_REPO_ROOT` pointing at a scratch root. That variable is honoured only for a directory
  inside `os.tmpdir()` that carries a marker file. Reason: the concept's "no repo-path argument"
  rationale is about writing into the wrong tree, and the marker plus tmpdir confinement keeps
  that impossible.
- The scratch repository is a dedicated fixture, not a copy of the live `news/`. Reason: the save
  specs must not break when real posts change.
- AC8 is proven three ways: a static import scan (no `child_process`, no git libraries, no
  `node:http(s)`/`net` client use in the write path), a git-fixture save (HEAD, index and stash
  unchanged), and the e2e `externalRequests` fixture.

## Plan

Triage: clear and ready. The format and behaviour questions are answered by the (User) decisions
above. This story is the first writer, and 025/027 reuse its pieces.

1. **Pure authoring core** (`studio/src/authoring/`, browser-safe, no `node:*`):
   - D1 `writeEntryDocument(original, patch)` is the lossless frontmatter/body text patch, with
     the mirrored `parseFrontmatter` as its oracle.
   - D2 `writeNewsIndex(indexText, change)` is the canonical index writer that updates one row.
   - D3 `planEntrySave(...)` composes both into a write set, decides whether `index.json` is
     concerned, and runs the mirrored `resolveFeed` on the would-be result to report a drop.
2. **Bridge write route** (D4):
   - `POST /__studio/fs/write` in the story-015 bridge, with the method-aware guard and
     writable-directory confinement.
   - The conflict check against disk, EOL/BOM restoration, and temp+rename.
   - A `write()` method on the bridge client.
   - The AC8 static and git-fixture proofs.
3. **Write-safe e2e harness** (D5): a scratch repo root under `os.tmpdir()`, a second Playwright
   project/dev server on port 5174, a per-test reset fixture and a dedicated fixture repo.
4. **Save in the editor** (D6):
   - A Save control on the 022/023 editor.
   - The drop-confirmation dialog, the conflict notice (Overwrite/Cancel) and a library refresh
     after a save.
   - The user-facing e2e specs.

Order: D1 → D2 → D3 → D4 → D5 → D6. D1–D3 are pure and independently testable, D4 depends on
nothing in D1–D3, and D6 needs all of them.

Guardrails: no presentation reaches `news/`, because the writers only emit the contract's own
keys and values. Nothing under `studio/src/launcher-core/` is edited; it is imported. The studio
UI follows `/frontend-guidelines` and `/design-tokens`.

## Deliverables

- **D1 — Lossless entry-document writer.**
  - **Files:**
    - new `studio/src/authoring/write-entry-document.ts`
    - new test `studio/src/authoring/write-entry-document.test.ts`
  - **Oracle:** the mirrored parser `parseFrontmatter` in
    `studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts`. Import it and never edit
    it. It reads:
    - a leading `---` fenced block;
    - scalar lines matching `^[A-Za-z0-9_]+:\s*(.*)$`, with matching quotes stripped;
    - one `buttons:` list of `  - label:` / `    url:` pairs.

    It silently ignores every other line (comments, blank lines) and trims the body.
  - **Signature:**
    `writeEntryDocument(original: string, patch: EntryPatch): { ok: true; text: string } | { ok: false; reason: string }`,
    where `EntryPatch = { fields?: Record<string, string | null>; buttons?: ButtonLink[] | null; body?: string }`.
    Input and output are LF text.
  - **Patch semantics:**
    - A key absent from `fields` keeps its line byte-identical.
    - A string value replaces the value on the existing line in place. The original key spelling,
      separator and quote style are kept wherever the new value reads back through that style.
    - `null` removes the line.
    - A key that is new is appended as `key: value` directly before the closing fence.
    - `buttons: null` removes the block, and an array replaces only the `buttons:` block in house
      style (`  - label: …` / `    url: …`). Comment lines inside a replaced block are kept,
      directly after `buttons:`. If `buttons` is absent or equal to the parsed list, the block is
      untouched.
    - `body` replaces everything after the closing fence line with the body plus one trailing
      newline. It is skipped if `body` equals the parsed (trimmed) body.
    - An empty patch returns `original` unchanged, byte for byte.
  - **Quoting:** emit the value raw if `parseFrontmatter` reads it back identically. Otherwise try
    `"…"`, then `'…'`. If none reads back (a newline, say), return `ok: false` naming the key.
  - **Missing frontmatter:** a document without a locatable frontmatter block returns `ok: false`.
  - **Tests (Vitest), including the AC4 round trip:**
    - for every `news/*.md` and `news/_templates/*/template.md` in the repo, the empty patch is
      the identity;
    - a title change leaves every other line byte-identical;
    - a comment line and an unknown key (`author: x`) survive any patch;
    - field order is unchanged;
    - `parseFrontmatter(result)` equals the parsed original with the patch applied (no field
      dropped, reordered or reformatted);
    - a quoting table (`: `, `#`, leading and trailing spaces, values starting with a quote) reads
      back unchanged;
    - a newline value is refused.
  - **Test names:**
    - "an empty patch returns every repository document byte for byte"
    - "a patched document reads back as the same entry with the patch applied"
    - "comments and unknown keys survive a patch"

- **D2 — Canonical `index.json` row writer.**
  - **Files:**
    - new `studio/src/authoring/write-news-index.ts`
    - new test `studio/src/authoring/write-news-index.test.ts`
  - **Signature:**
    `writeNewsIndex(indexText: string, change: { file: string; order: number }): { changed: boolean; text: string }`.
    Input and output are LF text.
  - **Behaviour:**
    - `JSON.parse` the text and find the row whose `file` equals `change.file`. `file` is relative
      to `news/`, e.g. `2026-09-10-x.md`.
    - Set that row's `order`, keeping every other key of that row and of the file (unknown keys
      included) in their existing order.
    - Serialise canonically as `JSON.stringify(value, null, 2) + '\n'`.
    - If the row is missing or already has that `order`, return `{ changed: false, text: indexText }`
      with the input unchanged.
    - Throw on unparseable JSON. The caller has already refused that case, see D3.
  - **Tests (Vitest, AC2/AC3):**
    - canonicalising the real `news/index.json` (LF-normalised) with an unchanged row returns it
      byte for byte;
    - changing one row's `order` yields a diff of exactly that one line;
    - an unknown row key survives;
    - an unknown top-level key survives;
    - a missing row gives `changed: false`.
  - **Test names:**
    - "changing one row leaves every other row byte-identical"
    - "a row that already agrees is not rewritten"

- **D3 — Save planner with the launcher's drop verdict.**
  - **Files:**
    - new `studio/src/authoring/plan-entry-save.ts`
    - new test `studio/src/authoring/plan-entry-save.test.ts`
  - **Inputs:**
    - `documentPath`: repo-relative, e.g. `news/2026-09-10-x.md`
    - `openedDocumentText`: normalised LF, as the editor opened it
    - `patch`: D1's `EntryPatch`
    - `openedIndexText`: normalised LF, or `undefined` if unreadable
    - the other documents' texts, keyed by the index's `file`
  - **Output:** either `{ ok: false, reason }` (writer refusal, or an unparseable index while the
    entry is published) or `{ ok: true, writes, drop }`.
    - `writes` is an array of `{ path, text, expected }`, where `expected` is the opened text for
      the conflict check.
    - `drop` is `{ reason: string } | undefined`.
  - **Rules:**
    - The document write comes from D1 `writeEntryDocument`.
    - The entry is published if and only if an index row's `file` equals `documentPath` with the
      leading `news/` removed.
    - If it is published and the new frontmatter `order` parses as a finite number, D2 runs, and
      `index.json` joins `writes` only when `changed`. A draft never produces an index write.
    - All paths are under `news/`.
    - `drop` is computed with the mirrored `resolveFeed` (from
      `studio/src/launcher-core/src/main/modules/home/news/feed-pipeline.ts:276`, input
      `{ index, documents }`) on the would-be index plus documents. If the entry is published and
      no slide with its `id` comes out, `drop.reason` is that entry's warning `reason`.
    - A fallback, such as `cover` delivered as `text`, is not a drop.
    - Drafts never carry `drop`.
  - **Tests (Vitest):**
    - AC1: the document write carries the patched frontmatter and body.
    - AC2: a published entry whose frontmatter `order` differs from its row gets an index write
      with exactly that row changed.
    - AC3: a draft save, and a save whose row already agrees, yield exactly one write (the `.md`).
    - AC5: an empty body on a published entry yields `drop` with the pipeline's reason, and a
      missing image yields no `drop`.
  - **Test names:**
    - "a draft save writes only its document"
    - "a published entry's row is brought into line with its frontmatter order"
    - "a save that makes the launcher drop the entry reports the pipeline's reason"

- **D4 — Guarded write route on the file bridge.**
  - **Files:**
    - `studio/src/bridge/create-file-bridge.ts` (the 405 guard at ~:116 becomes method-aware:
      POST is allowed only on the `write` route, and every other method/route pair keeps its
      current answer)
    - `studio/src/bridge/bridge-protocol.ts` (request/response types)
    - new `studio/src/bridge/write-files.ts`
    - `studio/src/bridge/file-bridge-plugin.ts` (pass `writableDirectories` = directories of
      registry descriptors whose `state` is `implemented`)
    - `studio/src/bridge/client.ts` (add `write(writes)`, mirroring `read()`'s error handling)
    - new tests `studio/tests/file-bridge-write.test.ts` and
      `studio/tests/save-no-git-no-network.test.ts`
    - adjust `studio/tests/file-bridge-server.test.ts` only if it asserts that POST is refused
      everywhere
    - Mirror the style of `tests/file-bridge-server.test.ts`.
  - **Route:** `POST /__studio/fs/write`.
    - Body: `{ writes: Array<{ path: string; text: string; expected: string | null }> }`, where
      `expected: null` means the file must not exist yet.
    - It inherits the existing Host check.
    - Additionally it requires an `Origin` header that is loopback (missing → 403) and
      `Content-Type: application/json` (else 415), with a body of at most 1 MB (else 413).
  - **Per write, all before any file is touched:**
    - `resolveBridgePath` (`studio/src/bridge/resolve-bridge-path.ts`) with
      `directories = writableDirectories`.
    - Accept only `<dir>/index.json` or a `.md` path not under `<dir>/_templates/` or
      `<dir>/img/`, else 403.
    - Read the current disk text. If `normaliseText(disk) !== expected` (from
      `studio/src/content-repo/text.ts`), or the file exists while `expected` is null, answer
      `409` with `{ error, path, current }`.
  - **Then, in request order:**
    - Restore EOL/BOM: if the disk file had CRLF, convert `\n` → `\r\n`, and re-add the BOM if
      it had one.
    - Write to a hidden sibling temp file, then `renameSync` over the target.
  - **Response:** `200 { written: string[] }`. A mid-way I/O failure answers `500` with `written`
    and `failed`.
  - **No subprocess, git or network use.**
  - **Tests (AC6):** a mismatched `expected` gives 409 and leaves the file untouched.
  - **Tests (AC7):** each of the following gives 403 with no file created or changed.
    - `README.md`
    - `studio/x.md`
    - `engines/manifest.json`
    - `news/../README.md`
    - `news/img/a.png`
    - `news/_templates/text/template.md`
    - an absolute path
    - a drive-letter path
    - a UNC path
    - an escaping symlink/junction, where the OS permits creating one
  - **Other tests:**
    - GET and other methods on `write` answer 405;
    - a missing Origin gives 403;
    - a CRLF+BOM file keeps both;
    - a two-file write with one conflict writes neither.
  - **AC8:**
    - A static scan of `src/authoring/**` and `src/bridge/**` imports none of `child_process`,
      `node:child_process`, `node:http`, `node:https`, `node:net`, or any `*git*` package.
    - Driving `createFileBridge` against `createGitFixture()` (`studio/tests/git-fixture.ts`)
      leaves `git rev-parse HEAD`, `git diff --cached` and `git stash list` unchanged, with only
      the written path in `git status --porcelain`.
  - **Test names:**
    - "a stale expected text is refused with 409 and nothing is written"
    - "paths outside the writable directory are refused"
    - "a save runs no git operation and opens no network client"

- **D5 — Write-safe e2e harness (scratch repository).**
  - **Files:**
    - new `studio/src/bridge/scratch-repo-root.ts` plus test
      `studio/src/bridge/scratch-repo-root.test.ts`
    - `studio/src/bridge/file-bridge-plugin.ts`
    - `studio/playwright.config.ts`
    - new `studio/e2e/authoring/prepare-scratch.ts`
    - new `studio/e2e/fixtures/scratch-repo.ts`
    - new fixture tree `studio/e2e/fixtures/scratch-repo/news/…`
    - new `studio/e2e/authoring/scratch-harness.spec.ts`
  - **`resolveBridgeRepoRoot(configRoot, env)`:**
    - Without `STUDIO_E2E_REPO_ROOT` it returns `resolveRepoRoot(configRoot)`, as today.
    - With it set, it returns that path only if it resolves inside `os.tmpdir()` and contains the
      marker file `.q2-studio-e2e-scratch`. Otherwise it throws at server start.
    - The plugin uses it instead of calling `resolveRepoRoot` directly.
  - **`prepare-scratch.ts`:**
    - Creates `<os.tmpdir()>/q2-studio-e2e` with the marker, an empty `studio/` dir (which
      `resolveRepoRoot`'s check needs) and a copy of `studio/launcher-core.lock.json` (the
      `provenance` route reads it).
    - Copies the fixture `news/` into it.
    - Exports `SCRATCH_ROOT` and `resetScratch()`.
  - **Playwright config:**
    - Add a second `webServer` entry: `tsx e2e/authoring/prepare-scratch.ts && vite --port 5174 --strictPort --host 127.0.0.1`,
      with `env: { STUDIO_E2E_REPO_ROOT: SCRATCH_ROOT }`.
    - Add a project `authoring` with `testDir: 'e2e/authoring'`, `use.baseURL: 'http://127.0.0.1:5174'`
      and `workers: 1`. If Playwright 1.62 has no per-project `workers`, use serial mode per file
      and say so.
    - The `chromium` project ignores `e2e/authoring/`.
  - **`e2e/fixtures/scratch-repo.ts`:** extends `test` from `e2e/fixtures/localhost-only.ts`
    (keeping `externalRequests`) with a `scratch` fixture. The fixture calls `resetScratch()`
    before each test and offers `readFile(repoRelPath)` and `writeFile(repoRelPath, text)`.
  - **Fixture repo** (dedicated, not the live `news/`):
    - `index.json`, canonical 2-space, with rows `alpha` → `2026-01-01-alpha.md` (order 10) and
      `beta` → `2026-01-02-beta.md` (order 20).
    - `2026-01-01-alpha.md`: `template: text`, title `Alpha`, order 10, a line
      `# kept by the writer` inside the frontmatter, and a body.
    - `2026-01-02-beta.md`: `template: text`, title `Beta`, frontmatter `order: 25`, which
      disagrees with the row on purpose.
    - `2026-01-03-draft.md`: a draft, not indexed.
  - **Spec:** "the authoring server reads the scratch repository, not the checkout" (the library
    lists Alpha, Beta and the draft).
  - **Unit tests:** an env root outside tmpdir or without the marker throws, and no env gives
    today's root.

- **D6 — Save in the editor, with drop confirmation and conflict notice.**
  - **Files:**
    - new `studio/src/authoring/use-save-entry.ts` plus `use-save-entry.test.ts`
    - a new save-controls organism and a confirm-dialog molecule, placed per `/frontend-guidelines`
      (e.g. `studio/src/organisms/editor/SaveEntryControls.tsx`,
      `studio/src/molecules/ConfirmDialog.tsx`), with tokens per `/design-tokens`
    - the editor organism from stories 022/023 (under `studio/src/organisms/`; its edit state may
      live in `studio/src/context/current-entry-context.tsx`)
    - new `studio/e2e/authoring/save-entry.spec.ts` (imports `test` from
      `e2e/fixtures/scratch-repo.ts`)
  - **Hook:**
    - Builds D1's `EntryPatch` from the editor state versus the opened parse, for form-known keys
      only. Keys the form does not know are never part of the patch.
    - Takes the opened texts from the library read (`useNewsLibrary`,
      `studio/src/library/use-news-library.ts`; types at
      `studio/src/content-repo/read-content-repo.ts:38-72`).
    - Calls D3 `planEntrySave`, then the bridge client's `write()`
      (`studio/src/bridge/client.ts`).
  - **Flow:**
    - If `drop` is set, show a dialog naming the reason ("The launcher will drop this entry:
      <reason>") with "Save anyway" and "Cancel". Cancel writes nothing.
    - On `409`, show a notice naming the changed file with "Overwrite", which retries with
      `expected` = the returned `current`, and "Cancel".
    - On success, call the library `refresh()` and clear the editor's unsaved-changes state
      (022 AC7).
    - Honour any "cannot be saved" state 022 exposes, such as an invalid date.
    - The save goes only through the bridge.
  - **e2e (fixture names from D5):**
    - edit Alpha's title and body, save, and the scratch file carries both and still contains
      `# kept by the writer`;
    - retitle Beta and save, and `index.json`'s beta row has `order: 25` while alpha's row is
      byte-identical;
    - empty Alpha's body and save, and the dialog names the drop reason: Cancel leaves the file
      unchanged, and a second save with "Save anyway" writes it;
    - open Alpha, then `scratch.writeFile` changes it on disk, and save shows the notice naming
      `news/2026-01-01-alpha.md` while the disk keeps the external text; "Overwrite" writes;
    - `externalRequests` is empty after a save.

## Model Hints

- D1 → deliverable-hard. The writer must keep every untouched line byte-identical while the
  mirrored parser it is tested against silently ignores comments and unknown lines. A
  re-serialise-from-parsed-data implementation looks correct, passes naive round-trip checks and
  destroys comments. The quoting rules must also survive the parser's `stripQuotes` exactly.
- D2, D3, D4, D5, D6 → default.
- Review: → default. I can name no plausible wrong implementation that would pass these tests
  and a default review. The tempting ones are already test targets: re-serialising is caught by
  D1's comment and identity tests, rewriting `index.json` on every save by D2/D3's "not
  rewritten" tests, and a conflict check against client state by the e2e disk edit.

## Acceptance Tests

- AC1 → unit `studio/src/authoring/plan-entry-save.test.ts` › "a draft save writes only its
  document"; e2e `studio/e2e/authoring/save-entry.spec.ts` › "AC1: saving writes the edited title
  and body to the entry's .md file"
- AC2 → unit `studio/src/authoring/plan-entry-save.test.ts` › "a published entry's row is brought
  into line with its frontmatter order"; e2e `studio/e2e/authoring/save-entry.spec.ts` › "AC2:
  saving a published entry brings its index row's order into line with the document"
- AC3 → unit `studio/src/authoring/write-news-index.test.ts` › "changing one row leaves every other
  row byte-identical" and › "a row that already agrees is not rewritten"; unit
  `studio/src/authoring/plan-entry-save.test.ts` › "a draft save writes only its document"
- AC4 → unit `studio/src/authoring/write-entry-document.test.ts` › "a patched document reads back
  as the same entry with the patch applied", › "an empty patch returns every repository document
  byte for byte" and › "comments and unknown keys survive a patch"
- AC5 → unit `studio/src/authoring/plan-entry-save.test.ts` › "a save that makes the launcher drop
  the entry reports the pipeline's reason"; e2e `studio/e2e/authoring/save-entry.spec.ts` › "AC5:
  a save that would drop the entry asks first and writes only after confirming"
- AC6 → unit `studio/tests/file-bridge-write.test.ts` › "a stale expected text is refused with 409
  and nothing is written"; e2e `studio/e2e/authoring/save-entry.spec.ts` › "AC6: a file changed on
  disk since opening is not overwritten silently"
- AC7 → unit `studio/tests/file-bridge-write.test.ts` › "paths outside the writable directory are
  refused"
- AC8 → unit `studio/tests/save-no-git-no-network.test.ts` › "a save runs no git operation and
  opens no network client"; e2e `studio/e2e/authoring/save-entry.spec.ts` › "AC8: saving reaches
  no external host"
- Harness (D5) → e2e `studio/e2e/authoring/scratch-harness.spec.ts` › "the authoring server reads
  the scratch repository, not the checkout"; unit `studio/src/bridge/scratch-repo-root.test.ts`

Coverage: AC1 D1+D3+D6 · AC2 D2+D3+D6 · AC3 D2+D3 · AC4 D1 · AC5 D3+D6 · AC6 D4+D6 · AC7 D4 ·
AC8 D4+D6. No manual residue.

## Done

<Filled by `/build 024`.>
