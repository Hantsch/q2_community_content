---
id: 026
title: Adding an image to an entry
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Three of the four templates are built around an image, and two of them — `split` and `cover` —
silently become a plain `text` slide without one. The image is also the part of a post with real
requirements: a path relative to the document, a name the launcher's safe-name rule accepts, an
extension it will serve, and per-template expectations about dimensions and where the subject can
sit before the text covers it.

Today all of that lives in the kit READMEs and is applied by hand. Getting any of it slightly wrong
produces a post that looks finished and renders as something else.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-24.

## Acceptance Criteria

- [ ] **AC1** — An image can be added to `news/img/` from the studio, by picking a file or dropping
      one onto the entry.
- [ ] **AC2** — A file name or extension the launcher would reject is refused before anything is
      written, naming the rule it breaks.
- [ ] **AC3** — The entry's `image` field is set to the correct path relative to the document.
- [ ] **AC4** — The template's own image guidance, taken from `news/_templates/<template>/README.md`,
      is shown while choosing.
- [ ] **AC5** — An image whose dimensions do not match the template's expectation is warned about,
      with the expected and actual values, and is not silently accepted.
- [ ] **AC6** — For `cover`, the preview makes the text safe zone visible, so an author can see
      whether the subject of the image is about to sit under the scrim.
- [ ] **AC7** — Adding an image writes only into `news/img/` and the entry being edited.
- [ ] **AC8** — Replacing an entry's image does not delete the previous file; an image that becomes
      unreferenced is reported by story 013 rather than removed automatically.

## Open Questions

- ~~Does the studio ever modify an image — resize, re-encode, strip metadata — or only ever warn? Not
  touching it is the safer rule and leaves the author with a manual step when the size is wrong.~~ answered → Decisions (Sprint)
- ~~What are the real per-template dimension expectations? They need to come from the kit READMEs and
  the launcher's rendering, not from a guess.~~ answered → Decisions (Sprint)
- ~~Should the studio be able to delete an unreferenced image, or does everything that removes a file
  stay a deliberate manual act?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Image modification: the studio never modifies an image, it only warns
- **Hard limits refuse, recommendations warn.** Over 5 MiB or over 4000 px on either side is refused,
  because the launcher's `fetch-image.ts` (`MAX_IMAGE_BYTES`, `MAX_IMAGE_DIMENSION_PX`, q2-launcher
  `src/main/modules/home/images/fetch-image.ts:95-98`) rejects it and the slide silently falls back.
  Missing a template's recommended size is only a warning, because the READMEs call those sizes
  recommendations.
- **Per-template expectations, from the kit READMEs:** `cover` 2560×640 (4:1, ±10 %), `banner`
  1600×480 (10:3, ±10 %), `split` 900×900 with width/height ≤ 1.1 (square or portrait); any image
  smaller than the recommended size in either dimension also warns. These are the READMEs' own
  numbers and reasoning ("crops most predictably", "without needing to upscale").
- **The limit constants are owned by the studio**, with a test that checks them against the kit
  READMEs, because `fetch-image.ts` cannot be mirrored (it imports Electron, see
  `scripts/launcher-core.manifest.ts` "Safe names").
- **The studio never deletes, renames or overwrites an image.** Removing a file stays a manual act,
  because AC8 already sends unreferenced images to story 013's report, and the writing stories keep
  their writes small.
- **Name rule:** the target is a single file name directly in `news/img/`. `img/<name>` must pass the
  mirrored `isSafeDeclaredImagePath`, and the extension must be one of the mirrored
  `SAFE_NEWS_IMAGE_EXTENSIONS` in lowercase. Uppercase (`.PNG`) is refused because the launcher's
  cache names are lowercase-only and nobody has checked how an uppercase extension is served.
  Refusing too much is safe; accepting too much is the silent fallback.
- **A name that already exists in `news/img/` is refused**, because overwriting would modify an
  image, which the (User) decision rules out.
- **The target name is an editable field, filled in with the picked file's name.** Without it, a
  refused name would force the author to rename the file outside the studio. Renaming changes no
  image bytes.
- **The image file is written when the author clicks Add. The `image` field changes only in the
  editor** and reaches disk with the entry's normal save (story 024), because story 022 AC7 says
  editing writes nothing until the entry is saved. If the author abandons the edit, the image is
  left unreferenced, and story 013 reports it (AC8).
- **The guidance is the README's `## Image requirements` section**, read at runtime through the
  bridge's existing `file` route and shown as plain text. AC4 says "taken from" the README, so the
  studio keeps no second copy.
- **The drop target is a labelled drop zone in the editor's image section**, not the whole entry
  panel. A drop onto story 023's body textarea would insert text there, and a named zone is
  accessible and testable.
- **Where each check runs:** name, extension, size and "already exists" are checked in the bridge
  before anything is written. The launcher's name predicates sit in the Node-only
  `launcher-safe-names.ts` door, so that check has to be on the server. Dimensions are decoded in
  the browser (`createImageBitmap`), because the server does not decode images and the browser
  needs no dependency to do it.
- **The image route requires `Content-Type: application/octet-stream`**, so a cross-origin page
  cannot send it as a CORS "simple request". This adds to the existing loopback Host/Origin
  guards.
- **The safe-zone overlay is a studio layer drawn over the preview iframe.** Its box is measured
  from the mirrored `.home-hero-slide-cover .home-hero-content` element inside the frame, and
  nothing is injected into the frame. This keeps story 018 AC3's isolation. Measuring stays correct
  at every width, where the column's `max-width: 560px` and `margin-left: clamp(...)` would defeat a
  hard-coded 45 %.
- **Test images are generated in the browser with a canvas**, and no binary fixtures are
  committed, so every case gets exactly the dimensions it needs.

## Plan

Depends on 022 (entry editor with an `image` field), 024 (save and writable-fixture e2e setup), 018
and 019 (preview iframe and width switch). Story 013's `orphan-image` finding already exists
(`studio/src/report/repository-findings.ts`).

1. **Bridge write route (D1).** Add `POST /__studio/fs/image?name=<file>` with a raw body to
   `studio/src/bridge/create-file-bridge.ts`. It is the only write route for images. Checks run in
   this order: single segment, then `isSafeDeclaredImagePath('img/'+name)`, then lowercase
   extension, then ≤ 5 MiB counted while streaming, then not already present, then
   `resolveBridgePath` confinement to `news/img`. The file is created exclusively (`wx`). A refusal
   returns `{ error, rule }`. The mirror predicates are injected from `file-bridge-plugin.ts` via
   `ssrLoadModule`, because a static import would break Vite's config loader. A browser client
   function goes into `studio/src/bridge/client.ts`. The read-only guard tests are narrowed so
   that no delete, rename or overwrite API is reachable.
2. **Expectations and guidance (D2).** A pure, browser-safe module at
   `studio/src/images/image-expectations.ts` holds the limits, the per-template expectations,
   `checkImage()`, `imageFieldValue()` and `extractImageGuidance(readme)`. A drift test checks it
   against `news/_templates/*/README.md`.
3. **Image adder UI (D3).** The organism `studio/src/organisms/image/ImageAdder.tsx` sits in the
   entry editor's image section and is not shown for `text`. It has a file picker, a drop zone, a
   name field, the README guidance, the actual and expected dimensions, an "add anyway"
   acknowledgement when a warning shows, and the bridge's refusal text. When the write succeeds,
   the editor's `image` field is set to `img/<name>`. The e2e tests for AC1–AC5, AC7 and AC8 are
   in `studio/e2e/add-image.spec.ts` and run against the writable fixture root.
4. **Cover safe zone (D4).** `studio/src/organisms/preview/CoverSafeZoneOverlay.tsx` sits over
   story 018's iframe whenever the delivered template is `cover`. Its box is the text column's box
   measured inside the frame, and it re-measures on resize and width switch. The e2e test is in
   `studio/e2e/cover-safe-zone.spec.ts`.

Order: D1 → D2 → D3, then D4. D4 depends only on stories 018 and 019, so it can also run in
parallel with D1–D3.

## Deliverables

- [ ] **D1 — Image write route in the file bridge, plus its client function.** Files:
  `studio/src/bridge/create-file-bridge.ts`, `studio/src/bridge/file-bridge-plugin.ts`,
  `studio/src/bridge/bridge-protocol.ts`, `studio/src/bridge/client.ts`,
  `studio/src/bridge/resolve-bridge-path.ts` (only if story 024 did not already add a way to resolve
  a not-yet-existing target), `studio/tests/file-bridge-server.test.ts`. Mirror: the existing
  `GET /news-img/` branch in `create-file-bridge.ts`, and story 024's write route if it exists.
  - Route: `POST /__studio/fs/image?name=<file name>`. The body is the raw bytes, and
    `Content-Type` must be `application/octet-stream` (refused with 415 otherwise). It runs behind
    the same loopback Host and Origin guards as every route. Only this route accepts POST. Every
    other route keeps refusing write methods with 405, and the existing test "every write method
    is refused on both routes" must stay green.
  - Checks, in this order, before anything touches the disk. A refusal returns
    `{ error: string, rule: ImageRefusalRule }` with a readable `error` that names the rule:
    1. `unsafe-name` (400): the name has a `/` or `\`, or `isSafeDeclaredImagePath('img/' + name)`
       is false.
    2. `extension` (400): the text after the last `.` is not in `SAFE_NEWS_IMAGE_EXTENSIONS`
       exactly (lowercase: `png`, `jpg`, `jpeg`, `webp`). `.PNG`, `.gif`, `.svg` and a missing
       extension are all refused.
    3. `too-large` (413): the body is over `5 * 1024 * 1024` bytes. Count bytes while streaming
       and stop reading as soon as the cap is exceeded, so nothing is buffered to disk.
    4. `exists` (409): `news/img/<name>` already exists. Write with `flag: 'wx'` as well, so a race
       cannot overwrite either.
    5. Confinement: resolve through `resolveBridgePath` with `directories: ['news/img']`, allowing
       a missing target. Refuse with 403 if that fails.
  - Success: 201 `{ path: 'news/img/<name>', image: 'img/<name>' }`.
  - Wiring subtlety: `isSafeDeclaredImagePath` and `SAFE_NEWS_IMAGE_EXTENSIONS` come from
    `studio/src/contract/launcher-safe-names.ts`, whose mirrored module graph resolves only through
    the dev server's plugins. **Do not import it statically into `create-file-bridge.ts`.**
    `file-bridge-plugin.ts` is bundled by Vite's plugin-less config loader and would fail at
    startup. Load it with `server.ssrLoadModule('/src/contract/launcher-safe-names.ts')` in
    `file-bridge-plugin.ts`, the same way the registry is loaded there. Pass both into
    `createFileBridge` as a new required `imageRules` option. Tests pass the real module, imported
    directly (vitest has the boundary plugin).
  - Put the byte limit into `studio/src/images/image-limits.ts` as
    `export const MAX_IMAGE_BYTES = 5 * 1024 * 1024` and `export const MAX_IMAGE_DIMENSION_PX =
    4000`. The file must be browser-safe with no imports. Its doc comment cites q2-launcher
    `src/main/modules/home/images/fetch-image.ts:95-98` and says why the constants are not
    mirrored: that file imports Electron.
  - Client: add `addNewsImage(name: string, bytes: Blob, fetchImpl = fetch)` to `client.ts`. It
    returns `{ ok: true, image } | { ok: false, rule, error }` and never throws; a network error
    becomes `rule: 'network'`. If no client function for `GET /__studio/fs/file?path=` exists yet,
    also add `readBridgeText(path, fetchImpl = fetch)`, which returns
    `{ ok: true, text } | { ok: false, error }`.
  - The source-scan test "no write API is imported under studio/src/bridge/" is narrowed, not
    deleted. `writeFile`/`writeFileSync`/`createWriteStream`/`open` may appear only in the bridge
    module(s) that implement write routes. `rm`, `rmSync`, `unlink`, `unlinkSync`, `rename`,
    `renameSync`, `copyFile` and `copyFileSync` stay banned in **every** file under
    `studio/src/bridge/`. If story 024 already narrowed the scan, extend its allowlist rather than
    loosening it.
  - Tests in `studio/tests/file-bridge-server.test.ts` (new `describe('image write route')` over a
    temp fixture repo):
    - "an unsafe image name is refused naming the rule and nothing is written". Cases: `a b.png`,
      `.hidden.png`, `sub/a.png`, `..%2Fa.png`, a 201-character name, `a.gif`, `a.svg`, `a.PNG`,
      `noext`. Each asserts the status, the `rule`, that `error` contains the rule's wording, and
      that the fixture tree is unchanged.
    - "an image over 5 MiB is refused as too-large and nothing is written"
    - "an existing image is never overwritten": asserts 409 and the old bytes unchanged.
    - "a valid image is written to news/img/ only and answers its image field value": asserts the
      file tree diff is exactly that file.
    - "writing a second image leaves the first in place"
    - "no delete or rename API is imported under studio/src/bridge/"
    - "the image route refuses a non-octet-stream content type and a cross-origin Origin"

- [ ] **D2 — Image expectations and README guidance, as pure functions.** Files:
  `studio/src/images/image-expectations.ts`, `studio/src/images/image-expectations.test.ts`. It
  imports `MAX_IMAGE_BYTES` and `MAX_IMAGE_DIMENSION_PX` from `studio/src/images/image-limits.ts`
  (D1). If D1 has not created that file yet, create it with exactly those two constants: 5 MiB and
  4000. The module must stay browser-safe, with no `node:` imports and nothing from
  `src/contract/launcher-safe-names.ts`.
  - `TEMPLATE_IMAGE_EXPECTATIONS: Record<'cover' | 'banner' | 'split', { recommended: { width,
    height }, ratio: { min, max } }>`. `cover` is 2560×640 with ratio 4 ± 10 % (3.6–4.4).
    `banner` is 1600×480 with ratio 10/3 ± 10 % (3.0–3.667). `split` is 900×900 with ratio min 0
    and max 1.1 (square or portrait). `text` has no entry.
  - `checkImage({ template, width, height, bytes })` returns `{ refusals: Finding[], warnings:
    Finding[] }`, where `Finding = { rule, message, expected, actual }` and `expected`/`actual`
    are human strings like `"≤ 4000 px"` / `"4001×300 px"`. Refusals: `too-large` when
    `bytes > MAX_IMAGE_BYTES`, and `too-many-pixels` when either side is over
    `MAX_IMAGE_DIMENSION_PX`. Warnings: `aspect-ratio` when width/height falls outside the ratio
    range (expected e.g. `"4:1 (2560×640), ±10 %"`), and `below-recommended` when width or height
    is under the recommended size. For a template without expectations it returns no findings.
  - `imageFieldValue(name) === 'img/' + name`. This is the value the entry's `image` field gets,
    relative to the document, because every news document lives directly in `news/` and the
    launcher resolves `news/<image>`.
  - `extractImageGuidance(readmeText)` returns the text from the `## Image requirements` heading
    up to the next `## ` heading, excluding that heading. The `### Safe zone` subsection is
    included. If there is no such section it returns `undefined`.
  - Tests:
    - "a matching image yields no findings" (all three templates at their recommended size).
    - "a mismatched image yields a warning with expected and actual values"
    - "an image over the launcher's limits is refused, not warned"
    - "the image field value is relative to the document": also asserts that
      `'news/' + imageFieldValue('a.png')` is `news/img/a.png`.
    - "the image guidance is the README's Image requirements section": run against the real
      `news/_templates/{cover,split,banner}/README.md` (read with `node:fs` in the test only); for
      `text/README.md` it returns `undefined`.
    - "the expectations match the kit READMEs": each README contains its recommended `W×H`,
      `5 MB` and `4000 px`.

- [ ] **D3 — The image adder in the entry editor.** Files: new
  `studio/src/organisms/image/ImageAdder.tsx` and `ImageAdder.test.tsx` (jsdom). Also the entry
  editor organism from story 022: find it by where it renders the `image` field, and add
  `<ImageAdder>` beside that field. New `studio/e2e/add-image.spec.ts`. Uses `addNewsImage` and
  `readBridgeText` from `studio/src/bridge/client.ts` and `checkImage`, `imageFieldValue` and
  `extractImageGuidance` from `studio/src/images/image-expectations.ts`. Styling uses design tokens
  only (read the `frontend-guidelines` and `design-tokens` skills first). Mirror the component
  shape of `studio/src/organisms/ValidationPanel.tsx`.
  - Shown only when the entry's declared template is `cover`, `split` or `banner`. For `text` it is
    not rendered at all, matching story 022's "no image field for `text`".
  - Input: a file `<input type="file" accept="image/png,image/jpeg,image/webp">` labelled "Choose
    image", and a drop zone labelled "Drop an image here" that accepts one file. Both lead to the
    same "chosen" state.
  - Chosen state:
    - An editable "File name" field, filled in with the file's name.
    - A "Guidance" region containing `extractImageGuidance(...)` of
      `news/_templates/<template>/README.md`, loaded with `readBridgeText` and rendered as plain
      pre-wrapped text. This region is visible from the moment the adder opens, before a file is
      chosen.
    - The actual `W×H` and size, decoded with `createImageBitmap(file)`.
    - Every `checkImage` refusal and warning, each showing its expected and actual value.
    - A refusal disables "Add image".
    - A warning requires ticking "Add anyway — the size does not match this template" before "Add
      image" is enabled.
  - "Add image" calls `addNewsImage(name, file)`:
    - On `ok`, set the editor's `image` field to `imageFieldValue(name)` through the editor's own
      change path, so story 022's unsaved-changes state and story 024's save both apply. Do not
      write the `.md`.
    - On refusal, show `error` in an alert region, and the chosen state stays so the name can be
      edited.
    - The adder never deletes or replaces the previously referenced image.
  - E2E: run against the writable fixture repository that story 024 set up for its save tests.
    That is a dev server whose bridge is constructed on a temp copy of the repository, per story
    015's (User) decision. **Never point a writing e2e test at the real repository.** If no such
    setup exists, add a Playwright project whose web server constructs `fileBridgePlugin` with a
    temp fixture root. Create test images inside the page with an `OffscreenCanvas` of the needed
    size, via `convertToBlob('image/png')`, and pass them with `setInputFiles` (buffer) or a
    `DataTransfer` drop. Tests:
    - "an image picked in the studio lands in news/img/"
    - "an image dropped onto the entry lands in news/img/"
    - "a name the launcher would reject is refused before anything is written, naming the rule"
      (for example `my image.png` and `hero.gif`; asserts the alert text and an unchanged
      `news/img/`)
    - "adding an image sets the entry's image field to img/<name> and saving writes it": asserts
      the field value, then Save, then the `.md` on disk has `image: img/<name>`.
    - "the template's image guidance from its kit README is shown while choosing": for `cover`
      it contains "2560×640"; after switching the template to `split` it contains "900×900".
    - "a mismatched image is warned about with expected and actual size and needs a deliberate
      confirmation": uses 800×600 on `cover`; "Add image" stays disabled until the tick.
    - "adding an image writes only into news/img/ and the entry being edited": hashes every file
      under the fixture root before and after add+save; the difference is exactly
      `news/img/<name>` added plus `news/<entry>.md` changed.
    - "replacing an image keeps the old file and the validation panel reports it as unreferenced":
      add A, save, add B, save; A is still on disk, and the repository findings list A as
      `orphan-image`. Reload the page if the library does not refresh after a save.
  - Unit test in `ImageAdder.test.tsx`: "the image adder is absent for the text template"

- [ ] **D4 — Cover text safe zone in the preview.** Files: new
  `studio/src/organisms/preview/CoverSafeZoneOverlay.tsx`, plus the preview organism from story
  018 that hosts the iframe (find it by the `<iframe>` it renders, and wrap the frame in a
  relatively positioned box). New `studio/e2e/cover-safe-zone.spec.ts`. Design tokens only.
  - When the previewed entry's **delivered** template is `cover`, draw an absolutely positioned
    overlay in the studio document over the iframe. It needs `data-testid="cover-safe-zone"`,
    an accessible name "Text safe zone", a token-coloured outline, a light hatch or tint, and
    `pointer-events: none`.
  - The overlay's box is the bounding rect of `.home-hero-slide-cover .home-hero-content` inside
    the iframe's document (same-origin; read `iframe.contentDocument`), offset by the iframe's own
    rect and any scale the preview applies. **Measure it; never compute it from 45 %.** The
    column has `max-width: 560px` and a `margin-left: clamp(...)`, so a fixed fraction is wrong
    at wide widths.
  - Re-measure on iframe `load`, on entry or image change, and when the frame resizes: a
    `ResizeObserver` on the iframe and on the measured element, which covers story 019's width
    switch.
  - Nothing is injected into the iframe: no node, no style.
  - A "Show text safe zone" toggle in the preview's toolbar, on by default, is rendered only for
    a delivered `cover`.
  - Tests in `studio/e2e/cover-safe-zone.spec.ts`, run against the repository's own published
    `cover` entry (read-only, so no writable fixture is needed):
    - "the cover preview outlines the text safe zone at the measured text column": at 940 and at
      1920, the overlay's box equals the frame's `.home-hero-content` box within 1 px, mapped to
      page coordinates.
    - "no safe-zone overlay for a non-cover preview"
    - "the safe-zone overlay adds nothing inside the preview frame": the iframe document contains
      no `[data-testid="cover-safe-zone"]`, and its stylesheet count is unchanged by the toggle.

## Model Hints

- D1 → deliverable-hard: this is the bridge's first binary write route. Four things can go wrong
  and the happy-path tests would still pass: the global GET/HEAD gate is loosened for every route;
  the size cap is enforced after the body has been buffered or written; a check-then-write race
  overwrites an existing file (needs `wx`); or the mirror predicates are statically imported into
  `create-file-bridge.ts`, which breaks the dev server's config-loader startup instead of any unit
  test.
- D2, D3, D4 → default.
- Review: → default. The easy wrong versions are all pinned by named tests: a hard-coded 45 %
  overlay fails at 1920, an overwrite fails the 409 byte check, and a delete API fails the source
  scan. What is left is visible in the diff.

## Acceptance Tests

- AC1 → e2e `studio/e2e/add-image.spec.ts` › "an image picked in the studio lands in news/img/"
  **and** › "an image dropped onto the entry lands in news/img/" (D3, route from D1)
- AC2 → e2e `studio/e2e/add-image.spec.ts` › "a name the launcher would reject is refused before
  anything is written, naming the rule" (D3) **and** unit `studio/tests/file-bridge-server.test.ts`
  › "an unsafe image name is refused naming the rule and nothing is written" (D1)
- AC3 → e2e `studio/e2e/add-image.spec.ts` › "adding an image sets the entry's image field to
  img/<name> and saving writes it" (D3) **and** unit `studio/src/images/image-expectations.test.ts`
  › "the image field value is relative to the document" (D2)
- AC4 → e2e `studio/e2e/add-image.spec.ts` › "the template's image guidance from its kit README is
  shown while choosing" (D3) **and** unit `studio/src/images/image-expectations.test.ts` › "the
  image guidance is the README's Image requirements section" (D2)
- AC5 → e2e `studio/e2e/add-image.spec.ts` › "a mismatched image is warned about with expected and
  actual size and needs a deliberate confirmation" (D3) **and** unit
  `studio/src/images/image-expectations.test.ts` › "a mismatched image yields a warning with
  expected and actual values" (D2)
- AC6 → e2e `studio/e2e/cover-safe-zone.spec.ts` › "the cover preview outlines the text safe zone at
  the measured text column" **and** › "the safe-zone overlay adds nothing inside the preview frame"
  (D4)
- AC7 → e2e `studio/e2e/add-image.spec.ts` › "adding an image writes only into news/img/ and the
  entry being edited" (D3) **and** unit `studio/tests/file-bridge-server.test.ts` › "a valid image
  is written to news/img/ only and answers its image field value" (D1)
- AC8 → e2e `studio/e2e/add-image.spec.ts` › "replacing an image keeps the old file and the
  validation panel reports it as unreferenced" (D3) **and** unit
  `studio/tests/file-bridge-server.test.ts` › "no delete or rename API is imported under
  studio/src/bridge/" (D1)

No manual residue. The OS file-picker dialog is not a residue: Playwright's `setInputFiles` drives
the real `<input type="file">`.

Coverage gate: AC1 → D1+D3, AC2 → D1+D3, AC3 → D2+D3, AC4 → D2+D3, AC5 → D2+D3, AC6 → D4,
AC7 → D1+D3, AC8 → D1+D3. Every criterion has a deliverable and a named test.

## Done

<Filled by `/build 026`.>
