# Sprint S05 Review — From preview to v1

## Overview

**Goal:** a contributor can go from a fresh clone to a published news post inside the studio: see
the post as the launcher will render it at every width, write and illustrate it with the contract
enforced while typing, order and publish it — and one end-to-end run proves the whole flow,
including the failure this project exists to prevent (an entry that would silently fall back,
caught before publishing).

| Story | Status | Commit |
| --- | --- | --- |
| 018 — Slide preview of the selected entry | done | `60495a5` |
| 019 — Preview width switcher | done | `d63bf72` |
| 020 — Preview a draft without publishing it | done | `1347eb8` |
| 021 — Preview an entry outside its visibility window | done | `119a4fd` |
| 022 — Frontmatter editor with live validation | done | `a2e35c5` |
| 023 — Body editor with live preview | done | `5879c1c` |
| 024 — Saving an entry writes the document and its index row | done | `93cd315` |
| 025 — New entry from the templates kit | done | `a510387` |
| 026 — Adding an image to an entry | done | `44125b6` |
| 027 — Reordering entries and publishing a draft | done | `f60ff13` |
| 028 — Contributor quickstart for the studio | done | `a3b6ac3` |
| 029 — Guide for adding a content type | done | `626cec5` |
| 030 — v1 acceptance — the full authoring flow | done | `38cf6ea` |

Gate fixes: 027 `ffbcedd`, 028 `752c5b2`. Refine round: `8ee214a`.

All 13 stories are done. Story 030 was blocked during refine (mirror hash vs. line endings) and
went ahead after the user dropped its mirror-integrity criterion (see Findings).

## Implemented stories

**018 — Slide preview.** The selected entry renders in an iframe with the mirrored launcher slide
components, driven by a `postMessage` handshake. It previews the delivered form (a fallback shows
as `text`), and a dropped entry shows the reason instead of a slide.

**019 — Width switcher.** 940 / 1280 / 1920 px switch the iframe's real viewport (no scaling) inside
a scrolling container; the width survives switching entries, and the readout names the launcher's
minimum and default.

**020 — Draft preview.** A draft is folded into an in-memory read as a published row and previewed
through the same pipeline, with a draft notice giving the would-be verdict and delivered position.
Nothing is written.

**021 — Visibility override.** A "Preview as if visible" switch for scheduled and expired entries,
with a marker outside the frame naming the real state; the library and validation panel keep the
real visibility.

**022 — Frontmatter editor.** Draft model plus field rules (launcher-agreeing button URL verdict,
three-button cap, strict ISO dates, presentation detector) with inline rule-named issues, `order`
read-only, and an unsaved-changes guard.

**023 — Body editor.** A raw `<textarea>` with live preview on every keystroke, an empty-body error,
warnings for markdown the launcher shows literally, and a body-overflow indicator measured at 940,
1280 and 1920.

**024 — Save entry.** Lossless frontmatter patching, a canonical `index.json` row writer, a save
planner with the launcher's drop verdict and a guarded `POST /__studio/fs/write` bridge route
(loopback Origin, writable-dir confinement, conflict check, temp+rename). A scratch-repo e2e harness
keeps tests off the real `news/`.

**025 — New entry.** A dialog offers the four kit templates with the kit README's guidance, derives a
dated slug, and writes the file create-only as a draft; `index.json` stays untouched.

**026 — Add image.** File picker and drop zone, name and dimension checks with README guidance,
warn-only mismatches with a deliberate confirm, a guarded new-files-only `POST /__studio/fs/image`
route, and a measured text safe-zone overlay on the cover preview.

**027 — Reorder and publish.** Drag-and-drop ordering (gap-first, renumber with confirmation),
publish (with the mirrored drop pre-check) and unpublish, through an all-guards-before-any-write
batch route (`.md` first, `index.json` last) with a re-read after every write.

**028 — Contributor quickstart.** A studio README quickstart (install to publish), linked from the
root README, guarded by a unit test.

**029 — Content-type guide.** `docs/systems/content-types.md` with an anti-drift test against the
descriptor, states and touch points.

**030 — v1 acceptance flow.** One running studio on a temp fixture tree walks create, write,
frontmatter, image, preview, validate and publish through the real UI, then runs `validate --json`;
guards prove `news/` is byte-identical, nothing beyond localhost is reached and no git runs. It
surfaced two real product defects, fixed with tests.

## Findings & decisions

Aggregated from the `## Decisions (Sprint)` sections, the Done sections and the review findings.
Input for the next planning.

**User decisions this sprint (binding):**
- 024: `index.json` gets a canonical reformat on write (not byte-preserving); the frontmatter writer
  preserves order and comments and saves immediately.
- 018: one-slide preview. 021: a simple visibility toggle, not a "preview as of a date" clock.
- 022: `order` is read-only in the form. 027: ordering by drag and drop.
- 026: image problems warn only, the studio never modifies an image. 030: a purpose-built fixture
  tree; the mirror-integrity criterion (former AC5) dropped.

**Follow-up candidates:**
- **Mirror lock hashes vs. CRLF checkouts (story proposal).** `launcher-core.lock.json` hashes the
  launcher's LF bytes; on a Windows checkout with `core.autocrlf=true` the mirrored files are CRLF,
  so `check:drift` is red and 4 unit tests fail (drift-provenance, launcher-core-unmodified,
  mirror-set, mirrorDrift). It fails at the merge-base too and blocked 030's mirror-integrity
  criterion. Options from refine: hash line-ending-normalised content, and/or a `.gitattributes`
  pinning line endings. This also covers the older follow-ups on `.gitattributes` and the four
  hash-drift tests.
- **`repo-contract` "profile records the e2e command and requires UI acceptance" (fails at the
  merge-base).** The profile does carry `ui-acceptance-required: true`, so its line format is not
  the cause. The test finds the Acceptance block with `profile.split('## Acceptance')[1]`, and the
  first hit is the text `## Acceptance Tests` inside a comment in the Verify block, so the sliced
  block never reaches the real line. Fix the test to anchor on a line-start heading, or reword that
  comment.
- **`npm run lint` prettier fails on ~165 untouched files** (CRLF). Prettier passes over files also
  rewrote line endings; the orchestrator restored EOL-only files before each commit.
- **The launcher renders no markdown** (023): body text is plain, so the editor is a bare textarea
  and the lint flags markdown as literal. Whether the launcher should ever render markdown is a
  launcher decision.
- **Empty-body message overstates for titled entries** (023): the launcher drops only entries with
  neither title nor body.
- **Cover crop at 940 px shows slightly more than the launcher** (019): the shell geometry is not
  mirrored, only the slide components.
- **Older e2e specs are locator-fragile** (027): new row buttons broke entry-select queries in 11
  specs; a shared select-entry helper would prevent repeats.

**Minor unfixed review notes worth a follow-up (most worthwhile):**
- 025: `create()` selects right after `refresh()`; a cancelled unsaved-changes prompt leaves the
  file written but unselected. Draft-slug collision and 409 have unit coverage only.
- 026: the delete/rename source scan misses aliased or namespace imports; the `wx` race and a
  symlinked `img/` confinement are implemented but untested.
- 024: the Origin check accepts any loopback port; Windows alternate data stream paths are not
  specially refused.
- 027: duplicate `file` values in an index would edit the first row; the AC8 `.git` check is
  trivially true (the network check and the unit git test carry it).
- 023: no test forces a late font load alone; the hero-clip branch of the overflow measure is
  covered by stubbed geometry only.
- Concept open points 1, 5 and 6 (zero-install variant, `engines`/`gamedata` manifest validation,
  fully offline) remain the obvious candidates after v1.

**Process notes:**
- Agents moved story files with `git mv` (fine).
- 020 and 030 both found that the mirrored pipeline keeps `cover` for a declared-but-missing image,
  so fixtures and the 030 AC2 assertion changed accordingly (see Acceptance).
- Progress trail: timestamps for 018-030 are monotonic; 024 deviates by logging two events per
  command (parallel deliverables started and finished together).
- 030's hard review is the clearest case for the hard tier (see Tier record).

## Blocked / open

Nothing is blocked. Open: the mirror hash / CRLF problem (story proposal above), the two
pre-existing red gate items, and the merge of `sprint/S05` into `feature/studio` (the user's).

## Regression gate

Detail is in [sprint.md](sprint.md). On `38cf6ea`: build green; unit 546 passed / 6 failed, all
pre-existing (4 mirror/CRLF, the profile test above, one flaky timeout); e2e 55 of 109 failed from
story 027's new row buttons (fixed in `ffbcedd`) and story 028's edit of the templates README
(fixed in `752c5b2`); e2e 109/109 green afterwards.

## Acceptance

Acceptance is the test suite. Every criterion was proven by a named, passing test.

**018** — AC1 e2e `slide-preview.spec.ts` "renders with the mirrored slide components inside an
iframe" + unit PreviewFrameApp; AC2 e2e "falls back to text" + unit `preview-model`; AC3 e2e "no
studio chrome style reaches the preview…"; AC4 e2e "image loads from news/img through the bridge" +
unit; AC5 e2e "only the buttons the launcher would keep" + unit; AC6 e2e "shows why nothing would be
shown" + units; AC7 e2e "changing the selected entry updates the preview without a reload" + unit.

**019** — AC1–AC6 all e2e `preview-width.spec.ts`: switches 940/1280/1920; real viewport not scale;
names launcher minimum and default; cover loses image area between 1920 and 940; scroll reach; width
persists across entries.

**020** — AC1–AC6 e2e `draft-preview.spec.ts` (draft previewed; only reads and `news/` byte-identical;
draft marker outside the frame; missing-image cover previews as text; unreadable frontmatter shows
the drop reason; would-be position), with AC2/AC4/AC5/AC6 also proven by unit
`draft-as-published.test.ts`.

**021** — AC1–AC6 e2e `visibility-override.spec.ts` (scheduled and expired preview as visible;
marker names the real state and sits outside the frame; nothing written; panel and library keep real
visibility; override off shows nothing with the reason), with unit `visibility-override.test.ts` and
component `VisibilityOverrideControl.test.tsx`.

**022** — AC1–AC7 e2e `frontmatter-editor.spec.ts` plus units `frontmatter-draft.test.ts` and
`field-rules.test.ts` (fields, template-dependent set, button URL, fourth button dropped, invalid
date blocks save, HTML in title refused, no write while editing and unsaved guard).

**023** — AC1–AC5 e2e `body-editor.spec.ts` with component `BodyEditor.test.tsx` and units
`body-document`, `body-lint`, `launcher-body-is-plain-text`; AC6 e2e `body-overflow.spec.ts` (940,
1280, 1920; fits; cut only where cut; typing raises the indicator) plus unit
`measure-body-overflow.test.ts`.

**024** — AC1, AC2, AC5, AC6, AC8 e2e `authoring/save-entry.spec.ts` plus units (`plan-entry-save`,
`file-bridge-write` 409, `save-no-git-no-network`); AC3, AC4 units (`write-news-index`,
`write-entry-document`); AC7 unit `file-bridge-write.test.ts` (paths outside the writable directory
refused). The harness is proven by `scratch-harness.spec.ts`.

**025** — AC1–AC7 e2e `authoring/new-entry.spec.ts` (four templates with kit guidance; file created
from the real kit template; dated slugged name; draft with `index.json` untouched; existing file
refused; existing id refused; opens with required fields empty) plus units `template-guidance`,
`new-entry`, `file-bridge-write`.

**026** — AC1–AC5, AC7, AC8 e2e `authoring/add-image.spec.ts`; AC6 e2e `cover-safe-zone.spec.ts`;
with units `image-expectations.test.ts` and `file-bridge-server.test.ts` (no delete/rename API,
unsafe name refused).

**027** — AC1–AC8 e2e `authoring/reorder-and-publish.spec.ts` (drag writes index and frontmatter; gap
leaves others byte-identical; renumber asks first; publish; unpublish; drop refusal; order equals the
pipeline's over disk; nothing beyond localhost) plus units `order-plan`, `apply-plan`,
`publish-plan`, `publishing-disk`, `publishing-no-git`.

**028** — AC1–AC6 unit `contributor-quickstart.test.ts` (order of steps, Node-only prerequisite,
never commits or pushes, README links, mirror paragraph, npm scripts exist). AC4 was reworded in
`752c5b2` (the root README links the quickstart, the quickstart links the templates README).

**029** — AC1–AC6 unit `content-type-guide.test.ts` (descriptor fields and states, touch points,
worked example by pointers, three rules, reserved-to-implemented path, field-drift self-check).

**030** — AC1, AC2, AC4 e2e `v1-acceptance-flow.spec.ts`; AC3 same plus units `v1-flow-harness` and
`file-bridge-dev-server`; AC5 unit `v1-flow-quickstart.test.ts` plus the e2e; AC6 e2e plus harness
units (network guard, git shim). The former AC5 (mirror integrity) was dropped by the user.

**Manual residue:** none in any story.

**Criteria covered a level below the real surface (named gaps):**
- **030 AC2.** The story asks for a declared vs. delivered mismatch. The mirrored pipeline keeps
  `cover` for a declared-but-missing image (it never gets the image list), so the flow asserts a
  delivered `cover`, a missing-image finding naming `img/v1-flow-cover.png` and no loaded image
  before the fix, and all gone afterwards. It never shows declared differing from delivered; that is
  the mirror's behaviour and `launcher-core` was not touched.
- **020 AC2 (byte-identical `news/`).** The e2e feed is stubbed, so its hash half is weak; the
  method check and the frozen-input unit test carry the proof.
- **028 and 029 (all criteria).** Documentation properties, proven at unit level; 030 AC5 ties the
  quickstart to the real flow.
- **027 AC8 and 023 AC6 (partial).** The `.git` check in the AC8 e2e is trivially true (the unit git
  test carries it); the hero-clip branch of the overflow measure is covered by stubbed geometry only.

No `testplan.md` was written: no story declared a `manual residue`.

## Tier record

| Story | Ds | Hard Ds | Review stages | Review cycles | Agents | Build min |
| --- | --- | --- | --- | --- | --- | --- |
| 018 | 4 | 1 | default | 0 | 6 | 15 |
| 019 | 2 | 0 | default | 1 | 5 | 6 |
| 020 | 3 | 0 | default | 1 | 7 | 12 |
| 021 | 2 | 0 | default | 0 | 5 | 7 |
| 022 | 4 | 0 | default | 0 | 6 | 12 |
| 023 | 4 | 1 | default | 0 | 9 | 21 |
| 024 | 6 | 1 | default | 0 | 12 | 24 |
| 025 | 3 | 0 | default | 1 | 5 | 14 |
| 026 | 4 | 1 | default | 1 | 7 | 23 |
| 027 | 6 | 1 | default | 1 | 11 | 27 |
| 028 | 1 | 0 | default | 1 | 3 | 5 |
| 029 | 1 | 0 | default | 1 | 5 | 7 |
| 030 | 4 | 1 | default + hard | 2 | 13 | 32 |
| **Total** | **44** | **6** | 12 default, 1 default + hard | **9** | **94** | **205** |

Refine: 9 min, plus 2 min for the 030 re-refine (11 min).

Only 030 had a hard review. It returned FAIL and found what the default review missed: a weaker
second seam (an own `STUDIO_REPO_ROOT` next to the existing `STUDIO_E2E_REPO_ROOT`), a Windows
`spawn('git')` blind spot (it skips `git.cmd`, so the shim alone never saw a call), vacuous
assertions, and the README/AC5 tie.
