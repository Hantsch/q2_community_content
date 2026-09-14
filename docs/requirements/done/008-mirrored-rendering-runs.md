---
id: 008
title: The mirrored slide rendering runs unmodified in the studio
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The preview is the reason the studio exists, and a preview is only evidence if it is the launcher's
own rendering. This story brings the launcher's slide components, the hero stylesheet and the design
tokens that stylesheet reads into the studio, and proves they render here.

It stops short of the preview surface itself — no iframe, no width switching, no entry selection.
What it has to establish is narrower and more important: these components render, with their real
styles, without anything on this side adjusting them to fit.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-8, section 6.

## Acceptance Criteria

- [x] **AC1** — Each of the four mirrored slide components renders in a component test from a slide
      object, with no edits to the component sources.
- [x] **AC2** — The rendered DOM structure and class names match what the launcher produces for the
      same slide — asserted against the mirrored components' own markup, not against a hand-written
      expectation.
- [x] **AC3** — `home-hero.css` is applied, and every custom property it reads resolves to a value
      rather than falling back to the browser default.
- [x] **AC4** — The fonts the hero stylesheet names are available locally, so the rendering does not
      depend on a network request or on a font that happens to be installed.
- [x] **AC5** — No studio stylesheet declares a rule that targets a mirrored class name, and a test
      asserts it.
- [x] **AC6** — A slide with an image renders that image from the repository's `news/img/`.
- [x] **AC7** — `npm run check:drift` still passes — no mirrored file was edited to make this work.

## Open Questions

- ~~Which design tokens are mirrored and which belong to the studio's own chrome?~~ answered →
  Decisions (Sprint).
- ~~Are the three Fontsource packages redistributable, and does bundling need a licence note?~~
  answered → Decisions (Sprint).
- ~~The launcher renders slide body text from markdown — is that renderer part of the mirrored
  set?~~ answered → Decisions (Sprint).

## Decisions (Sprint)

- **(User)** Fonts: bundle the three Fontsource packages the launcher uses, with a licence note
  added next to the existing third-party attributions.
- Font licence note lands as a `## Third-party` section in `studio/README.md` (OFL 1.1 plus the
  three copyright lines), because this repository has no attribution file yet and the fonts are
  studio-only tooling dependencies that must not be documented on the published surface.
- Tokens: the launcher's whole `src/renderer/src/styles/` entry graph is mirrored verbatim
  (`index.css` + the four sheets it `@import`s + `home-hero.css`, ~2160 CSS lines), because
  `index.css` is the single point where the tokens `home-hero.css` reads are defined and it imports
  its siblings — any narrower cut means hand-authoring launcher presentation in this repository,
  which is the drift the mirror exists to prevent.
- The mirrored stylesheet is never imported by the studio shell — only by the mirror render root —
  so the launcher's `@layer base` resets and tokens cannot reach the studio's own chrome.
- The studio's own chrome keeps its separate `studio/src/styles/index.css` (Tailwind only, no
  launcher token and no `home-hero-*` rule), which is what makes AC5 checkable rather than a
  promise.
- Markdown: there is no markdown renderer to mirror. Every mirrored template renders the body as a
  React string child (`<p className="home-hero-body">{slide.body}</p>`), and `home-hero.css` states
  "Plain text only (no markdown)" — so the studio must not add one either, and D3 asserts the body
  renders without element children.
- The mirrored rendering set is extended beyond the concept's list by the import closure that makes
  it compile: `components/ui/Button.tsx` and `lib/cn.ts` (pulled in by `SlideButtons.tsx`), because
  a mirror that does not resolve its own imports is not a mirror. New runtime dependency: `clsx`.
- `SlideButtons.tsx`'s other import, `../client` (Electron IPC via `lib/bridge.ts`, which reads
  `window.q2` at module top level), is **not** mirrored: it is resolved to a studio-owned stub by a
  resolver plugin, because mirroring it would drag `shared/ipc.ts` and `shared/types/` — the
  launcher's whole IPC contract — into a content repository for one "open this URL" side effect
  that no acceptance criterion observes.
- The stub is a boundary, not an edit: no studio-authored file is placed inside
  `studio/src/launcher-core/`, and D2's test derives the stub's required surface from the mirrored
  source, so a re-sync that widens that import fails a test instead of failing silently.
- Images: the launcher resolves `slide.imageUrl` in its main process to a `q2launcher://` URL,
  which cannot exist here, so the studio supplies the URL — a read-only, path-confined dev-server
  mount of `news/img/` only. This is studio glue, not rendering; the `<img>` tag stays the
  launcher's.
- The mirror render root for this story is a standalone dev page (`studio/mirror-check.html`), not
  a route in the studio app, so the mirrored global stylesheet gets its own document without
  pre-empting the preview surface that S05 owns.

## Plan

Depends on 005 (sync + lock) and 006 (`check:drift`); 007 mirrors `@shared/modules/home`, whose
types the components import. Build order: after 007.

The mirrored rendering files, keeping the launcher's own directory layout under
`studio/src/launcher-core/` so their relative imports resolve untouched:

| From `q2-launcher/src/` | To `studio/src/launcher-core/` |
| --- | --- |
| `renderer/src/modules/home/components/Slide{Text,Banner,Cover,Split}.tsx` | `renderer/modules/home/components/` |
| `renderer/src/modules/home/components/SlideButtons.tsx`, `resolveSlideTemplate.ts` | same |
| `renderer/src/components/ui/Button.tsx`, `renderer/src/lib/cn.ts` | `renderer/components/ui/`, `renderer/lib/` |
| `renderer/src/styles/{index,home-hero,surfaces,controls-grid,config-syntax,dashboard}.css` | `renderer/styles/` |

Steps:

1. Extend 005's sync manifest by those 12 files, re-sync, regenerate the lock; add `clsx` and the
   three `@fontsource-variable` packages; keep `launcher-core/` out of ESLint/Prettier and give
   `tsconfig`/Vite the `@shared/*` path so the mirror compiles as-is.
2. Wire the boundary: a Vite/Vitest resolver plugin maps `../client` — resolved from inside
   `launcher-core/` only — to a studio-owned `openSlideUrl` stub.
3. Render the four templates through `resolveSlideTemplate` in component tests; assert structure
   and class names against the mirrored sources, not against hand-written markup.
4. Mirror styles and fonts into a render root that the studio shell never imports; prove every
   custom property `home-hero.css` reads is defined by the mirrored token sheet.
5. Add the standalone `mirror-check.html` dev page plus the read-only `news/img/` mount, and prove
   in a real browser that properties resolve, fonts are local and the image loads.
6. Add the two guard tests: no studio stylesheet touches a mirrored class name, and `check:drift`
   still passes.

Not in this story: the preview surface, the iframe, width switching, entry selection (S05).

## Deliverables

- [x] **D1 — The rendering files are mirrored and compile.** Extends 005's sync manifest by the 12
  files above, re-syncs, regenerates `studio/launcher-core.lock.json`; adds `clsx` +
  `@fontsource-variable/{inter,oswald,jetbrains-mono}` to `studio/package.json`; adds the
  `@shared/*` path to `studio/tsconfig.json` and `studio/vite.config.ts`; excludes
  `src/launcher-core/` in `studio/.prettierignore` and `studio/eslint.config.js` (the mirror is not
  ours to format). Touches: the sync manifest/script from 005, `studio/launcher-core.lock.json`,
  `studio/package.json`, `studio/tsconfig.json`, `studio/vite.config.ts`, `studio/.prettierignore`,
  `studio/eslint.config.js`, plus its test `studio/tests/mirror-set.test.ts`.
  *Accepted when:* `npm run typecheck`, `npm run lint`, `npm run build` and `npm run check:drift`
  pass with the rendering files present, and the test asserts every one of the 12 files has a lock
  entry with a hash.
- [x] **D2 — The IPC boundary, without touching the mirror.** A resolver plugin
  (`studio/src/mirror-runtime/launcherBoundary.ts`) that rewrites `../client` to
  `studio/src/mirror-runtime/homeClientStub.ts` only for importers under `src/launcher-core/`, wired
  into `studio/vite.config.ts` and `studio/vitest.config.ts`. Plus its test
  `studio/src/mirror-runtime/launcherBoundary.test.ts`, which parses the mirrored `SlideButtons.tsx`
  and asserts the stub exports exactly what it imports from `../client`, and that no other mirrored
  file imports outside the mirrored set.
  *Accepted when:* importing the mirrored `SlideButtons` in a jsdom test does not throw on
  `window.q2`, and widening the stub or the mirrored import fails that test.
- [x] **D3 — The four templates render (AC1, AC2).** A slide fixture module
  (`studio/src/mirror-runtime/slideFixtures.ts`, one slide per template, one with an image) and
  `studio/src/mirror-runtime/mirroredSlides.test.tsx`: renders each template picked by the mirrored
  `resolveSlideTemplate`, asserts every `home-hero-*` `className` literal in the mirrored component
  source appears in the rendered DOM and nothing else does (read from source at test time, not a
  DOM snapshot), and asserts the body `<p>` has no element children.
  *Accepted when:* all four render from a slide object with zero changes under `launcher-core/`.
- [x] **D4 — Styles, tokens and fonts (AC3 static, AC4 packaging).**
  `studio/src/mirror-runtime/mirrorStyles.ts` imports the mirrored `launcher-core/renderer/styles/
  index.css` and the three Fontsource packages; `studio/README.md` gains the `## Third-party`
  section (OFL 1.1 + three copyright lines). Test `studio/tests/mirrorStyles.test.ts`: every
  `var(--x)` read by the mirrored `home-hero.css` is defined in the mirrored token sheet; both font
  families named there are covered by a bundled package; the licence note names OFL 1.1 and all
  three copyright holders.
  *Accepted when:* the test passes and no studio file redefines a launcher token.
- [x] **D5 — The mirror renders in a real browser (AC3 live, AC4, AC6).** `studio/mirror-check.html` +
  `studio/src/mirror-runtime/mirrorCheck.tsx` (mounts the fixtures with `mirrorStyles`), a
  read-only, path-confined `/news/img/` middleware in `studio/vite.config.ts`, and
  `studio/src/mirror-runtime/newsImageUrl.ts`. Test: `studio/e2e/mirrored-rendering.spec.ts`.
  *Accepted when:* in Chromium every custom property resolves non-empty, no external request
  fires, the named font families are loaded from the bundle, and the `news/img/` image has
  `naturalWidth > 0`.
- [x] **D6 — The guards (AC5, AC7).** `studio/tests/studioStylesheets.test.ts` scans every stylesheet
  and inline style outside `launcher-core/` for a mirrored class name or launcher token
  redefinition; `studio/tests/mirrorDrift.test.ts` runs `check:drift` and asserts exit 0.
  *Accepted when:* adding a `.home-hero-title { }` rule to `studio/src/styles/index.css` fails the
  first test.

## Model Hints

- D2 → `deliverable-hard` — the resolver plugin has to fire for mirrored importers and only those,
  identically under Vite dev, Vitest and the Playwright-served page; a too-broad match silently
  substitutes mirrored code and the mirror stops being one.
- D1, D3, D4, D5, D6 → default.
- Review: → `story-review-hard` — the failure this story must not ship is a quiet one (a mirrored
  file edited to fit, a hand-authored token sheet, a stub that grows into rendering), and it is
  visible only by reading the diff against the mirror rule in `CLAUDE.md`.

## Acceptance Tests

- AC1 → unit `studio/src/mirror-runtime/mirroredSlides.test.tsx` › "each mirrored template renders
  from a slide object" (D3)
- AC2 → unit `studio/src/mirror-runtime/mirroredSlides.test.tsx` (`expectRenderedClassesMatchSource`,
  used inside each of the four `it(...)` blocks) — extracts every `className` literal from the
  mirrored component's own source text at test time and asserts the rendered DOM's `home-hero-*`
  classes are exactly that set (no more, no fewer); not a DOM snapshot (D3)
- AC3 → unit `studio/tests/mirrorStyles.test.ts` › "every custom property home-hero.css reads is
  defined in the mirrored token sheet" (D4) **and** e2e `npm run e2e`
  `studio/e2e/mirrored-rendering.spec.ts` › "every custom property resolves in the browser" (D5)
- AC4 → e2e `studio/e2e/mirrored-rendering.spec.ts` › "the hero fonts load locally, with no external
  request" (D5), plus unit `studio/tests/mirrorStyles.test.ts` › "both hero font families are
  bundled and attributed" (D4)
- AC5 → unit `studio/tests/studioStylesheets.test.ts` › "no studio stylesheet targets a mirrored
  class name" (D6)
- AC6 → e2e `studio/e2e/mirrored-rendering.spec.ts` › "a cover slide shows an image from news/img"
  (D5)
- AC7 → unit `studio/tests/mirrorDrift.test.ts` › "check:drift passes with the rendering mirror in
  place" (D6), with `npm run check:drift` also run as part of D1's acceptance

No manual residue. AC1–AC7 describe properties of the mirror rather than user actions, so the unit
level is the right one; AC3, AC4 and AC6 additionally need real browser semantics (custom-property
resolution, font loading, image decoding) and are therefore proven through `npm run e2e` on the
standalone mirror page.

## Done

**Summary.** The launcher's four slide templates, `SlideButtons`, their `Button`/`cn` import
closure, and the whole `renderer/src/styles/` entry graph (`index.css` + its four `@import`s +
`home-hero.css`) are now mirrored into `studio/src/launcher-core/` and proven to render — with real
classes, real tokens, real fonts and a real repository image — from `studio/mirror-check.html`, a
standalone page the studio shell never imports. A Vite/Vitest resolver plugin
(`launcherBoundary.ts`) substitutes a thin studio stub for the mirror's one non-mirrored import
(`../client`, the Electron IPC bridge) without ever touching mirrored file content. Nothing under
`studio/src/launcher-core/` was hand-edited; `npm run check:drift` passes with all 17 mirrored files
clean.

**Commit message:** `008: mirror the slide rendering set and prove it renders in the studio`

**Verification (all from `studio/`, run once each, all green after the review-fix cycle below):**
- `npm run build` — pass
- `npm run typecheck` — pass
- `npm run test` — pass (23 files, 88 tests)
- `npm run lint` — ESLint clean; `prettier --check` clean on every file this story touched or
  created. It still fails on ~32 pre-existing files unrelated to this story (confirmed via
  `git stash` against a clean `sprint/S02` checkout before any of this story's work: the same
  files fail there too) — a repository-wide `core.autocrlf`/missing-`.gitattributes` issue, not a
  story 008 defect. Not fixed here to keep this story's diff to its own scope.
- `npm run e2e` — pass (9/9, including the 3 new `mirrored-rendering.spec.ts` tests)
- `npm run check:drift` — pass (17 mirrored files, no drift)

**AC → test mapping, as verified:**
- AC1 → `studio/src/mirror-runtime/mirroredSlides.test.tsx` (all four `it(...)` blocks) — pass
- AC2 → same file, `expectRenderedClassesMatchSource` — pass
- AC3 → `studio/tests/mirrorStyles.test.ts` (static) + `studio/e2e/mirrored-rendering.spec.ts` ›
  "every custom property resolves in the browser" (live, now derives its property list from
  `home-hero.css` itself rather than a hand-picked subset) — pass
- AC4 → `studio/e2e/mirrored-rendering.spec.ts` › "the hero fonts load locally, with no external
  request" (now asserts `FontFace.status === 'loaded'`, backed by a small always-rendered
  `home-hero-counter` probe on `mirror-check.html` so JetBrains Mono, which none of the four
  mirrored slide templates alone would trigger, actually loads) + `studio/tests/mirrorStyles.test.ts`
  (font/package mapping now derived from `index.css`'s own `--font-*` declarations) — pass
- AC5 → `studio/tests/studioStylesheets.test.ts` — pass
- AC6 → `studio/e2e/mirrored-rendering.spec.ts` › "a cover slide shows an image from news/img" — pass
- AC7 → `studio/tests/mirrorDrift.test.ts` + the story-level `check:drift` run above — pass

No manual residue.

**Review:** `story-review-hard` ran once against the working tree and returned **FAIL**, one
confirmed-real blocker (AC7) plus eleven other findings. Handled in one fix cycle:

- **F1 (AC7 red, `check:drift` failing on 4 files)** — root-caused to this session's own `git stash
  -u` (run to compare `prettier --check` against a clean HEAD): restoring untracked mirrored files
  via `git stash pop` let `core.autocrlf` rewrite four of them to CRLF, so their hash no longer
  matched the lock. Not a mirror edit — re-ran `npm run sync:launcher` to restore the exact synced
  bytes; `check:drift` and the full test suite went green again. Documented here because it is a
  real trap for anyone re-running this story's verification on a CRLF-checkout Windows machine.
- **F4** (e2e custom-property list missed `--color-hover`/`--color-ink-muted`) — fixed: the list is
  now read from `home-hero.css` at test time.
- **F5** (font/package test only grepped `mirrorStyles.ts`, not the actual token source) — fixed:
  now derives required Fontsource packages from `index.css`'s own `--font-*` declarations.
- **F6** (font-loaded assertion only checked declaration, not `status === 'loaded'`) — fixed, and
  surfaced a real gap: JetBrains Mono is named by `home-hero.css` only for `.home-hero-counter`,
  which none of the four mirrored slide templates render on their own, so the browser never loaded
  it. Added a small `home-hero-counter` probe element to `mirrorCheck.tsx` (diagnostic-only, not
  part of the mirror) so the assertion is both correct and actually meaningful.
- **F7** (two slide fixtures pointed at `news/img/` filenames that do not exist) — fixed: fixtures
  now use the three real files (`cover-community-welcome.png`, `split-bootstrap.png`,
  `banner-repository.png`) via the `newsImageUrl()` helper instead of hand-typed strings.
- **F8** (`newsImageUrl()` unused; doc claimed it rejects a leading `.`, code didn't) — fixed: code
  now matches the doc, and the fixtures use the function (see F7), so it is no longer dead.
- **F9** (stale comment in `launcherBoundary.test.ts` citing reasons D3 later removed) — fixed.
- **F2** (Acceptance Tests section claimed a "DOM snapshot" that was never written) — fixed: the
  section and D3's own deliverable text now describe what the test actually does.
- **F12** (`mirror-set.test.ts` only checked hash format, not that it matches disk) — strengthened
  to re-hash each file and compare; this is exactly the check that would have caught F1 immediately
  instead of via a later `check:drift` run.
- **F3** (class-name completeness check is `home-hero-*`-scoped only, not every class) — accepted
  as designed: `home-hero-*` is the launcher's own hand-authored class vocabulary (`home-hero.css`);
  `Button.tsx`'s Tailwind utility classes are generic and stable, and asserting full completeness
  against them would make the test brittle for no gain in what AC2 is actually checking.
- **F10** (`tsconfig.json`'s `rootDirs` merge is bidirectional; only the mirror→outside direction is
  guarded by a test) — accepted as a low-probability, `tsc`-only gap: nothing under
  `src/mirror-runtime/` currently writes a relative import that would resolve into the mirror by
  accident, and `contract-single-source.test.ts`'s scan would still catch a stray runtime import.
- **F11** (widening `eslint.config.js`'s mirror-import exemption to `src/mirror-runtime/**` weakens
  "one import site" to roughly five) — accepted: this is the story's own point (D3/D4/D5 all render
  or style the mirror directly), and the exemption is still a named, narrow zone rather than a
  blanket one; the eslint comment was reworded to say "two doors" rather than implying one remains.

Re-ran the full verification suite after the fixes (see above) — all green. One review-fix cycle,
well inside the 3-cycle budget.

**Decisions (implementation-time, beyond the ones already in `## Decisions (Sprint)`):**
- The story's own D1 text said "12 files"; the actual count of *newly added* manifest entries was 7
  (`SlideButtons.tsx` was already present from story 007's mirror, not newly added by this story).
  The manifest now totals 18 declared entries / 17 mirrored files (the shared contract module is
  counted once).
- `studio/.prettierignore` already existed before D1 (the story's plan assumed it needed creating);
  D1 only confirmed it already excludes `src/launcher-core/`.
- Two resolution mechanisms exist for the mirror's `../client` import by necessity, not duplication:
  `launcherBoundary.ts` (Vite/Vitest, runtime) and `tsconfig.json`'s `rootDirs` + `src/mirror-runtime/
  client.ts` (`tsc`, compile-time) — `tsc` does not run Vite plugins, so it needs its own resolution
  target; both point at the same `homeClientStub.ts` surface.
- The orchestrator (not a deliverable agent) widened `studio/eslint.config.js`'s
  `no-restricted-imports` exemption to include `src/mirror-runtime/**` between D2 and D3, once D2's
  own report showed D3–D5 would otherwise be unable to import the mirror at all from that directory.
  This was a foreseeable plan gap (the story's whole point is rendering the mirror from a new
  location) rather than scope creep, and is covered by finding F11 above.
- e2e was run and treated as a real acceptance gate for this story (AC3 live, AC4, AC6), per the
  story's own Plan/Deliverables/Acceptance Tests sections (D5, `studio/e2e/mirrored-rendering.spec.ts`),
  even though the orchestrator's dispatch instructions asserted "this story explicitly has no
  preview/iframe surface, only component tests, so e2e does not apply." That claim does not match
  this story's text: it explicitly excludes only the *preview iframe surface* (S05's concern), not
  browser-level proof of AC3/AC4/AC6, and D5 names an e2e spec and test titles verbatim. Following
  the story file as the authoritative spec.
