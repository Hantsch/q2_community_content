# Sprint S04 Review — Open it and see what is there

## Overview

**Goal:** the studio becomes something you look at rather than something you run. It opens on a
library of the news feed — published, scheduled, expired and draft entries in delivered order —
with the S03 validation report next to it, and its navigation is built from a content-type
registry that names the repository's other five content areas honestly instead of hiding them.

| Story | Status | Commit |
| --- | --- | --- |
| 014 — Content-type registry drives the studio | done | `014: content-type registry drives the studio` |
| 015 — Local file bridge between the browser and the working tree | done | `015: local file bridge between the browser and the working tree` |
| 016 — Library view of the news directory | done | `016: library view of the news directory` |
| 017 — Validation panel in the studio | done | `017: validation panel in the studio` |

All four stories are done. Nothing is blocked.

## Implemented stories

**014 — Content-type registry.** The studio's navigation now iterates a
`createContentTypeRegistry({ source })` factory instead of naming `news` in shell code. `news` is
fully wired (directory, index file, reader, validators); `engines`/`gamedata` show as
"read by the launcher, not editable here yet"; `packs`/`mods`/`config_templates` show as
"reserved", each linking a new stub concept doc under `docs/concepts/`. Selecting an unimplemented
type explains its state instead of showing an empty screen. A throwaway descriptor appears in the
nav with zero shell changes, proving the registry seam actually holds.

**015 — Local file bridge.** A dev-server-only, read-only bridge lets the browser read the
repository through a narrow, guarded surface: a realpath-based path guard refuses traversal
(including encoded and symlink/junction escapes), only directories a registered content-type
declares are reachable, the bridge binds to `127.0.0.1` only, and no write route exists. The old
`newsImgMiddleware.ts` was folded into the bridge's image route so there is exactly one guarded
file-access path in the dev server, not two.

**016 — Library view.** The studio's home screen: every entry in delivered order with title,
template, order and status; drafts in their own section; scheduled/expired dates; dropped reasons
readable inline; declared-vs-delivered template mismatches shown side by side; thumbnails;
selecting an entry sets it as the shared "current entry" that 017 consumes. Empty and unreadable
`news/` each get their own explicit explanation.

**017 — Validation panel.** The S03 report now sits next to the entry it is about: the selected
entry's declared/delivered form and findings, a fallback's rule and field to fix, repository-level
findings in their own region, an explicit all-clear state, severities that read without colour,
mirror provenance, and a finding click that jumps to select its entry in the library. The panel and
`npm run validate` now share one composition function (`buildValidationSnapshot`), so their
verdicts are structurally guaranteed to agree — this also closes the S03 follow-up that
`repositoryFindings` always reported `0` in the CLI.

## Findings & decisions

Aggregated from `## Decisions (Sprint)`, build-phase decisions, and review findings across all four
stories.

**User-facing scope decisions (bundled in the sprint's clarification round, binding):**
- Content-type descriptors carry only the minimal v1 set (directory, index file, reader,
  validators); editor fields and a preview component are added per type only once that type is
  actually edited.
- Reserved content types link to a placeholder concept doc each (three stub docs created this
  sprint) rather than showing plain, unlinked state text.
- The registry does not need to support a content type with no index file in v1 — none of the six
  known types need it.
- The 015 fixture-repository-root override is wired as a constructor/factory argument only, never
  an env var or CLI flag, so it cannot be reached from a normal run.
- v1 is dev-server only; no production build of the studio exists this sprint, which simplified
  015's AC5 to a module-graph proof instead of a bundle-stripping proof.
- File modification times are deferred until an editor exists to need them.
- The library's primary sort is delivered order (matches AC1's literal wording and the launcher's
  own behaviour), not recency.
- The library shows thumbnails; the current feed is small enough that this is not a performance
  concern.
- Validation-panel findings are clickable and jump to select their entry in the library (not the
  field — no editor exists yet to jump a field into).
- The panel distinguishes "fine" from "fine, but a draft nobody will see."
- Mirror provenance is shown in the validation panel, next to the verdicts it qualifies.

**Notable build-time findings, all fixed before the story was marked done:**
- **014 —** binding the registry's `news` validators to the real report functions was the first
  thing to pull Node-builtin imports (`node:crypto`, `node:fs`, `node:fs/promises`, `node:path`)
  into the browser bundle from the mirrored tree, crashing the app on load. Fixed by extending the
  existing `launcherBoundary.ts` stub-redirect plugin to also redirect those four specifiers for
  importers inside the mirror, without touching `studio/src/launcher-core/` itself. This also
  protected stories 015–017 from the same crash.
- **015 —** a `story-review-hard` review found and fixed six real issues: the `read` route ignored
  its `?type=` parameter and always returned `news` data regardless of the requested type; the
  image route's confinement had widened from `news/img/` to all of `news/` (a regression against
  the deleted middleware it replaced); a request with no `Host` header at all was default-allowed
  instead of refused; the AC5 module-graph test stopped one hop short of where mirrored Node
  imports are actually reachable; a stale doc comment pointed at the deleted middleware file; and a
  traversal test used a filename whose extension masked the guard it claimed to prove. Two findings
  were judged out of scope (Vite's own built-in `/@fs/` route is stock behaviour, not a regression
  this story introduced) or already sufficiently covered elsewhere.
- **016 —** review found a thumbnail URL derivation that could throw during render for an image
  name the URL builder rejects (e.g. a dot-prefixed file); fixed to fall back to the placeholder,
  per the story's own "must not become a second, silent failure" decision.
- **017 —** wiring `collectRepositoryFindings()` into the CLI (closing the S03 follow-up) required
  an unplanned Node-side module-resolution hook so the mirrored `launcher-safe-names.ts` path
  resolves under Node, mirroring what the Vite dev-server plugin already does for the browser —
  reviewed and accepted as the minimal fix, with `studio/src/launcher-core/` confirmed untouched.

**Environment issue recurring across all four stories, not caused by any of them:** this Windows
checkout's `core.autocrlf=true` rewrites `studio/src/launcher-core/`'s mirrored file line endings,
so four mirror-hash-drift tests (`tests/mirrorDrift.test.ts`, `tests/mirror-set.test.ts`,
`tests/launcher-core-unmodified.test.ts`, `tests/drift-provenance.test.ts`) and most of
`prettier --check` fail independently of any change — confirmed via `git stash` against the
pre-story commit before every one of this sprint's four stories. This was already flagged as a
follow-up after S03; it is still open.

## Blocked / open

None. All four stories reached `done`.

## Acceptance

Acceptance is the test suite. Every criterion below was proven by a named, passing test; where a
story mapped a criterion to more than one test, both are listed.

**014 — Content-type registry drives the studio**
- AC1 (navigation built by iterating the registry, no type named in shell code) — e2e
  `content-type-registry.spec.ts` "the navigation lists every registered content type" + unit
  `shell-independence.test.ts` "no content-type identifier appears in the shell's own source".
- AC2 (news fully registered and usable) — unit `descriptors.test.ts` "news declares its directory,
  index file, reader and validators and reads the fixture repository through the registry".
- AC3 (packs/mods/config_templates shown reserved) — e2e "packs, mods and config_templates are
  shown as reserved with their concept document" + unit "every reserved descriptor links a concept
  document that exists".
- AC4 (engines/gamedata shown launcher-reads) — e2e "engines and gamedata are shown as read by the
  launcher, not editable here".
- AC5 (unimplemented type explains itself, never empty/dead) — e2e "selecting a type that is not
  implemented explains its state and offers no dead control".
- AC6 (adding a descriptor needs no shell change) — unit `ContentTypeNav.test.tsx` "a throwaway
  descriptor appears in the navigation without a shell change".
- No manual residue.

**015 — Local file bridge between the browser and the working tree**
- AC1 (studio reads news through the bridge) — e2e `file-bridge.spec.ts` "the studio reads the news
  directory through the bridge".
- AC2 (paths outside the repo root refused, incl. traversal/absolute/symlink) — unit
  `resolve-bridge-path.test.ts` "every path that resolves outside the repository root is refused,
  including symlink escapes" + integration `file-bridge-server.test.ts` "the bridge refuses
  traversal, absolute paths and a symlink escape over HTTP".
- AC3 (only descriptor-declared directories reachable) — integration `file-bridge-server.test.ts`
  "only directories a registered descriptor declares are reachable".
- AC4 (news/img served) — e2e "an image under news/img/ is served to the mirrored renderer" +
  integration "the image route serves a raster image with an explicit content type and refuses svg
  and traversal".
- AC5 (dev-server only, no file-access path in production) — unit
  `file-bridge-not-in-production.test.ts` "the bridge plugin is declared dev-server only" and
  "the browser entry point never statically imports the bridge server or a server/socket node:
  module".
- AC6 (localhost only) — integration "the dev server listens on the loopback address only".
- AC7 (read-only) — integration "every write method is refused and the working tree is unchanged
  after a full read".
- No manual residue.

**016 — Library view of the news directory**
- AC1 (published entries in delivered order with title/template/order/status) — e2e (unstubbed,
  real `news/`) "the library lists the published feed in delivered order with title, template,
  order and status" + unit "published rows come back in delivered order".
- AC2 (drafts listed separately, marked invisible) — e2e "drafts are listed in their own section
  and marked invisible to the launcher".
- AC3 (scheduled/expired dates) — e2e "a scheduled entry shows its visible-from date and an expired
  entry its visible-until date".
- AC4 (dropped entries marked with readable reason) — e2e "a dropped entry is marked dropped and
  its reason is readable in the list".
- AC5 (declared vs. delivered template mismatch shown) — e2e "an entry whose delivered template
  differs from the declared one shows both".
- AC6 (selecting sets the current entry) — e2e (unstubbed, real `news/`) "selecting an entry marks
  it as the current entry".
- AC7 (empty/unreadable news/ explained clearly) — e2e "an empty news directory explains itself" +
  "an unreadable news directory explains itself, not as an empty list".
- No manual residue.

**017 — Validation panel in the studio**
- AC1 (selected entry's verdict shown) — e2e pass.
- AC2 (fallback shows rule and field to fix) — e2e + unit pass.
- AC3 (repository findings shown separately) — e2e + component pass.
- AC4 (every finding names its file) — unit pass.
- AC5 (explicit all-clear state) — component pass.
- AC6 (severities distinguish without colour) — component pass.
- AC7 (panel and `npm run validate` agree) — e2e pass, genuinely executing `scripts/validate.ts
  --json` and comparing its output against the rendered panel.
- No manual residue.

No `testplan.md` was written for this sprint: every acceptance criterion across all four stories
was proven by an automated test, and no story declared any manual residue.
