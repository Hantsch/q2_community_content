---
id: 028
title: Contributor quickstart for the studio
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio was built so that someone without a launcher checkout can write a news post. That promise
is only kept if they can find out how, from the repository, without asking anyone.

The existing documentation is good and aimed elsewhere: `README.md` is the contract the launcher
reads, and `news/_templates/README.md` is the map of the four templates. Neither tells a newcomer
what to install, what to run, or what the loop of writing a post actually looks like.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-26.

## Acceptance Criteria

- [x] **AC1** — `studio/README.md` documents the path from a fresh clone to a previewed post:
      install, start, create, write, preview, validate, publish.
- [x] **AC2** — It names the prerequisites — the Node version and nothing else — and states
      explicitly that no `q2-launcher` checkout is needed.
- [x] **AC3** — It explains what the studio will and will not do: it writes files in the working
      tree, and it never commits, pushes or publishes anything.
- [x] **AC4** — The repository `README.md` and `news/_templates/README.md` link to it, so a
      contributor arriving at either finds it.
- [x] **AC5** — It states where the preview's fidelity comes from and what a stale mirror warning
      means, in one short paragraph.
- [x] **AC6** — A test proves the documented commands exist as named, so the quickstart cannot drift
      out of date silently.

## Open Questions

- ~~Does `news/_templates/README.md` stay the entry point for "which template do I want", with the
  quickstart linking to it, or does the studio's template picker make that page redundant?~~ answered → Decisions (Sprint)
- ~~Should the quickstart be written for someone who has never used git, or may it assume a clone
  already exists?~~ answered → Decisions (Sprint)
- ~~Is a short screen recording or a screenshot sequence worth having, and where would it live given
  the repository is otherwise content for the launcher?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- `news/_templates/README.md` stays the entry point for "which template do I want" and the
  quickstart links to it — it also serves contributors who edit by hand without the studio, and
  AC4 presupposes the page keeps existing.
- The quickstart assumes a clone already exists and teaches no git — AC1 starts "from a fresh
  clone", and AC2 allows Node as the only prerequisite.
- No screen recording and no screenshots — an image cannot be checked against the UI by a test, so
  it would drift silently, which is exactly what AC6 exists to prevent.
- The seven steps are `### N. <Verb>` headings (Install, Start, Create, Write, Preview, Validate,
  Publish) under one `## Quickstart` heading — a fixed, parseable shape lets story 030's AC6 read
  the same step sequence instead of re-describing it.
- The existing "Getting started" section (Playwright install + e2e) becomes "Running the tests",
  aimed at studio developers — installing a browser for Playwright is not a contributor
  prerequisite and would break AC2's "Node and nothing else".
- UI steps (create, preview, publish) name the studio's controls by the labels they carry in
  `studio/src` at build time, not by the wording of stories 025–027 — the source is what the
  contributor sees.
- "Commands" in AC6 means every `npm run <script>` (and `npm install`) written anywhere in
  `studio/README.md`, checked against the root `package.json` scripts, because the README tells
  the reader to run everything from the repository root.
- AC5's "out of sync" wording is checked against `VERDICT_LABELS` from
  `studio/src/mirror/provenance.ts`, so the paragraph cannot drift from what the studio shows.
- AC5's "one short paragraph" is made observable as one paragraph of at most 600 characters.
- The Publish step ends with "publishing here means a row in `news/index.json`; committing and
  pushing stays yours" and gives no git commands — the studio never commits (concept §2 non-goals),
  and the doc should not teach a workflow it does not own.

## Plan

Documentation story. One file is rewritten, two get a link, and one guard test keeps the
quickstart honest. The test belongs to the deliverable.

1. `studio/README.md`: add a `## Quickstart` section at the top (after the intro). It has
   Prerequisites (Node, version from `studio/package.json` `engines.node`), a "no `q2-launcher`
   checkout" sentence, a "what the studio does and does not do" paragraph, the seven steps as
   `### 1. Install` … `### 7. Publish`, and the fidelity/out-of-sync paragraph. Rename the existing
   "Getting started" to "Running the tests". Leave the other sections unchanged.
2. `README.md` and `news/_templates/README.md`: add one sentence each that links to
   `studio/README.md` (relative link).
3. `studio/tests/contributor-quickstart.test.ts`: text-shape assertions for AC1–AC5, plus the
   command-existence check for AC6. It follows the `readRepoFile` pattern in
   `studio/tests/repo-contract.test.ts`.

Order: D1 only. Build it after 027, so the create/publish controls it names already exist.

## Deliverables

- **D1 — Quickstart in `studio/README.md`, linked from both READMEs, plus its guard test.**
  Files: `studio/README.md`, `README.md`, `news/_templates/README.md`, new
  `studio/tests/contributor-quickstart.test.ts` (mirror the file-reading helper of
  `studio/tests/repo-contract.test.ts`).
  - In `studio/README.md`, directly after the intro paragraph, add `## Quickstart`. It contains, in
    this order:
    - `### Prerequisites`: a bullet list with exactly **one** item, Node at the version in
      `studio/package.json` `engines.node` (currently `>=22`, written as "Node 22 or newer").
      Then a sentence stating that no `q2-launcher` checkout (and no Electron build) is needed.
      The quickstart assumes the repository is already cloned and teaches no git.
    - A short "What the studio does" paragraph: it reads and writes files in your working tree
      only, and it **never commits, pushes or publishes** anything. What leaves your machine is
      your own deliberate act.
    - Seven headings, in exactly this order and form: `### 1. Install` (`npm install` from the
      repo root), `### 2. Start` (`npm run studio`, then the URL Vite prints, default
      `http://localhost:5173`), `### 3. Create` (new entry from a template, using the studio's
      control, plus a link to `../news/_templates/README.md` for choosing a template),
      `### 4. Write` (frontmatter fields and body editor), `### 5. Preview` (the preview and its
      width switch; drafts preview without being published), `### 6. Validate` (the validation
      panel, and `npm run validate` for the same verdict on the command line), `### 7. Publish`
      (publishing in the studio writes the entry's row into `news/index.json`; committing and
      pushing stays yours, with no git commands given). Name each UI control by the label it
      carries in `studio/src` (grep the components added by stories 025–027). Do not invent
      labels.
    - One paragraph of at most 600 characters. It says the preview renders the launcher's own
      slide components, mirrored verbatim into `studio/src/launcher-core/` and hash-locked in
      `studio/launcher-core.lock.json`. It also says that a Mirror provenance status of
      "out of sync" means the mirror no longer matches its lock, so the preview is not evidence
      until it is re-synced (see "Syncing the launcher mirror" below).
    - Rename the existing `## Getting started` section to `## Running the tests` and reword its
      intro for studio developers. Leave every other section unchanged. No screenshots, no
      recordings.
  - `README.md`: in the Top-level layout paragraph that describes `studio/`, add one sentence
    linking to `studio/README.md` ("To write a post with the studio, start with the
    [quickstart](studio/README.md#quickstart)."). Do not change anything else in the contract
    text.
  - `news/_templates/README.md`: in the intro, add one sentence linking to
    `../../studio/README.md#quickstart` for writing and previewing with the studio instead of by
    hand.
  - Test file `studio/tests/contributor-quickstart.test.ts`, with the test names in the
    Acceptance Tests lines below:
    - AC1: extract the `### N. …` headings under `## Quickstart`. Assert they equal
      `['1. Install','2. Start','3. Create','4. Write','5. Preview','6. Validate','7. Publish']`.
    - AC2: the Prerequisites list has exactly one bullet. That bullet contains the major version
      parsed from `studio/package.json` `engines.node`. The section also contains
      "no `q2-launcher` checkout" (case-insensitive, backticks optional).
    - AC3: the Quickstart section mentions "working tree", and matches
      /never commits, pushes or publishes/i.
    - AC4: both READMEs contain a markdown link whose target, resolved relative to that file and
      with the `#…` part removed, is `studio/README.md`. The `#quickstart` anchor must match the
      heading.
    - AC5: exactly one paragraph in the Quickstart section contains both "mirror" and
      `VERDICT_LABELS['out-of-sync']` (imported from `../src/mirror/provenance`), and it is at most
      600 characters long.
    - AC6: collect every `npm run <name>` in the whole `studio/README.md`. Assert the set is
      non-empty and contains `studio` and `validate`, so an empty regex cannot pass vacuously.
      Assert every name is a key of the root `package.json` `scripts`. Also assert `npm install`
      appears in the Install step.
  - Accept: `npm run test` green (the known Windows `launcher-core` hash-drift failures from the
    ROADMAP excepted), `npm run lint` clean for the touched files, and the new test fails if a
    step heading or a script name is renamed.

## Model Hints

- D1 → default. Prose plus a text-shape test, with no cross-module behaviour.
- Review: → default

## Acceptance Tests

No criterion describes a user action on the studio surface. All six are properties of the
documentation, so they are proven at unit level. Story 030's AC6 walks the documented sequence
through the real surface.

- AC1 → unit `studio/tests/contributor-quickstart.test.ts` › "the quickstart walks install, start, create, write, preview, validate, publish in that order"
- AC2 → unit `studio/tests/contributor-quickstart.test.ts` › "the only prerequisite is the Node version from engines.node, and no q2-launcher checkout is needed"
- AC3 → unit `studio/tests/contributor-quickstart.test.ts` › "the quickstart says the studio writes the working tree and never commits, pushes or publishes"
- AC4 → unit `studio/tests/contributor-quickstart.test.ts` › "README.md and news/_templates/README.md link to the studio quickstart"
- AC5 → unit `studio/tests/contributor-quickstart.test.ts` › "one short paragraph explains the mirror and the out-of-sync warning"
- AC6 → unit `studio/tests/contributor-quickstart.test.ts` › "every npm command the studio README names exists as a root script"

## Done

