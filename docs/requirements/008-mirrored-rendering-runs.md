---
id: 008
title: The mirrored slide rendering runs unmodified in the studio
status: ready # draft -> ready -> in-progress -> done
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

- [ ] **AC1** — Each of the four mirrored slide components renders in a component test from a slide
      object, with no edits to the component sources.
- [ ] **AC2** — The rendered DOM structure and class names match what the launcher produces for the
      same slide — asserted against the mirrored components' own markup, not against a hand-written
      expectation.
- [ ] **AC3** — `home-hero.css` is applied, and every custom property it reads resolves to a value
      rather than falling back to the browser default.
- [ ] **AC4** — The fonts the hero stylesheet names are available locally, so the rendering does not
      depend on a network request or on a font that happens to be installed.
- [ ] **AC5** — No studio stylesheet declares a rule that targets a mirrored class name, and a test
      asserts it.
- [ ] **AC6** — A slide with an image renders that image from the repository's `news/img/`.
- [ ] **AC7** — `npm run check:drift` still passes — no mirrored file was edited to make this work.

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

- **D1 — The rendering files are mirrored and compile.** Extends 005's sync manifest by the 12
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
- **D2 — The IPC boundary, without touching the mirror.** A resolver plugin
  (`studio/src/mirror-runtime/launcherBoundary.ts`) that rewrites `../client` to
  `studio/src/mirror-runtime/homeClientStub.ts` only for importers under `src/launcher-core/`, wired
  into `studio/vite.config.ts` and `studio/vitest.config.ts`. Plus its test
  `studio/src/mirror-runtime/launcherBoundary.test.ts`, which parses the mirrored `SlideButtons.tsx`
  and asserts the stub exports exactly what it imports from `../client`, and that no other mirrored
  file imports outside the mirrored set.
  *Accepted when:* importing the mirrored `SlideButtons` in a jsdom test does not throw on
  `window.q2`, and widening the stub or the mirrored import fails that test.
- **D3 — The four templates render (AC1, AC2).** A slide fixture module
  (`studio/src/mirror-runtime/slideFixtures.ts`, one slide per template, one with an image) and
  `studio/src/mirror-runtime/mirroredSlides.test.tsx`: renders each template picked by the mirrored
  `resolveSlideTemplate`, snapshots the DOM, asserts every `className` literal in the mirrored
  component source appears in the rendered DOM and nothing else does, and asserts the body `<p>` has
  no element children.
  *Accepted when:* all four render from a slide object with zero changes under `launcher-core/`.
- **D4 — Styles, tokens and fonts (AC3 static, AC4 packaging).**
  `studio/src/mirror-runtime/mirrorStyles.ts` imports the mirrored `launcher-core/renderer/styles/
  index.css` and the three Fontsource packages; `studio/README.md` gains the `## Third-party`
  section (OFL 1.1 + three copyright lines). Test `studio/tests/mirrorStyles.test.ts`: every
  `var(--x)` read by the mirrored `home-hero.css` is defined in the mirrored token sheet; both font
  families named there are covered by a bundled package; the licence note names OFL 1.1 and all
  three copyright holders.
  *Accepted when:* the test passes and no studio file redefines a launcher token.
- **D5 — The mirror renders in a real browser (AC3 live, AC4, AC6).** `studio/mirror-check.html` +
  `studio/src/mirror-runtime/mirrorCheck.tsx` (mounts the fixtures with `mirrorStyles`), a
  read-only, path-confined `/news/img/` middleware in `studio/vite.config.ts`, and
  `studio/src/mirror-runtime/newsImageUrl.ts`. Test: `studio/e2e/mirrored-rendering.spec.ts`.
  *Accepted when:* in Chromium every custom property resolves non-empty, no external request
  fires, the named font families are loaded from the bundle, and the `news/img/` image has
  `naturalWidth > 0`.
- **D6 — The guards (AC5, AC7).** `studio/tests/studioStylesheets.test.ts` scans every stylesheet
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
- AC2 → unit `studio/src/mirror-runtime/mirroredSlides.test.tsx` › "the rendered class names are
  exactly the ones the mirrored sources declare" + DOM snapshot (D3)
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

<Filled by `/build 008`.>
