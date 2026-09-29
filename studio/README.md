# studio

`studio/` is the local authoring and validation tool for this repository. It is local
tooling only — per `CLAUDE.md`, the launcher never fetches it; the published surface
(`news/`, `engines/`, `gamedata/`, and the reserved `packs/`, `mods/`, `config_templates/`)
is content only.

## Quickstart

### Prerequisites

- Node 22 or newer.

No `q2-launcher` checkout is needed, and no Electron build. This assumes the repository is
already cloned.

The studio reads and writes files in your working tree only. It never commits, pushes or publishes
anything on its own; what leaves your machine is your own deliberate act.

### 1. Install

Run `npm install` from the repository root.

### 2. Start

Run `npm run studio`, then open the URL Vite prints (by default http://localhost:5173).

### 3. Create

Press **New entry**, pick a template, give the entry a title and press **Create**. To choose the
right template, see [the news templates](../news/_templates/README.md).

### 4. Write

Fill in the fields in the **Frontmatter** editor and write the text in the **Body** editor.
Use **Save** to write the entry to disk. **Add an image** attaches an image to the entry.

### 5. Preview

The **Draft preview** shows the slide as the launcher would render it. Use the **Preview width**
switch to try different widths. Drafts preview without being published.

### 6. Validate

The **Entry findings** panel lists what is wrong with the entry you are editing, and the
**Repository findings** panel covers the whole repository. `npm run validate` gives you the same
verdict on the command line.

### 7. Publish

Use **Publish** on a draft in the library (**Unpublish** takes it back out), and arrange entries
in the **Order** list. Publishing here means a row in `news/index.json`; committing and pushing
stays yours.

The preview renders the launcher's own slide components, mirrored verbatim into
`studio/src/launcher-core/` and hash-locked in `studio/launcher-core.lock.json`. If **Mirror
provenance** reads "out of sync", the mirror no longer matches its lock, so the preview is not
evidence until it is re-synced (see "Syncing the launcher mirror" below).

## Running the tests

Studio developers run the tests from the repository root. Contributors writing posts do not need
this section; Playwright and the end-to-end suite are not a prerequisite for the quickstart. From
a fresh clone, in this order:

1. `npm install` — installs dependencies for the whole workspace, including `studio`.
2. `npm run e2e:install` — fetches the Chromium browser Playwright needs to run the
   end-to-end suite.
3. `npm run e2e` — runs the end-to-end test suite. This starts the dev server itself;
   there is no separate dev-server step to run first.

## Syncing the launcher mirror

`studio/src/launcher-core/` is a verbatim copy of contract and rendering source from the
`q2-launcher` repository — per `CLAUDE.md` it is mirrored, never hand-edited. Refresh it with
`npm run sync:launcher -- --launcher <path to a q2-launcher checkout>` (from the repository
root or from `studio/`). The command copies the files declared in
`studio/scripts/launcher-core.manifest.ts` byte for byte, removes mirrored files the manifest no
longer declares, and records the launcher commit plus a SHA-256 per file in
`studio/launcher-core.lock.json`. It only ever reads the launcher checkout and only ever writes
inside `studio/`; a checkout that is missing a declared file or has uncommitted changes to one
aborts with a single error and writes nothing. Running it again against the same checkout
changes nothing. Like the rest of `studio/`, it is local tooling — the launcher never fetches it.

## The contract boundary

`studio/src/contract/launcher-contract.ts` is the only studio file allowed to import from
`src/launcher-core/` or the `@shared/*` alias. It re-exports the pipeline functions (`buildFeed`,
`resolveFeed`, `filterAndSortSlides`), the contract types, and the rule constants; everything else
in `studio/` reaches the contract through it, never directly.

The `@shared/*` alias (`tsconfig.json` `paths`, `vite.config.ts`/`vitest.config.ts`
`resolve.alias`) maps to `src/launcher-core/src/shared/*`, which is what lets the mirrored
`feed-pipeline.ts`'s own `@shared/modules/home` import resolve unmodified. This mapping exists
purely so the mirror compiles with zero edits to its contents, per `CLAUDE.md`'s "mirrored, never
hand-edited" rule; it is not a general-purpose alias for studio's own code.

An eslint `no-restricted-imports` zone plus a guard test
(`studio/tests/contract-single-source.test.ts`) enforce that nothing outside
`launcher-contract.ts` imports the mirror or the alias, and that no contract rule (button host
allowlist, three-button cap, image-fallback rule, drop rules) is re-implemented anywhere else in
`studio/src`/`studio/tests`, so a later re-sync only ever touches one import site.

## Checking the launcher mirror for drift

`npm run check:drift` (from the repository root or from `studio/`) re-hashes every mirrored file
against `studio/launcher-core.lock.json` and reports anything that does not match: a file edited
by hand here, a file the lock does not know about, or a lock entry with no file on disk. Add
`-- --launcher <path to a q2-launcher checkout>` to also compare each untouched mirrored file
against the launcher's current source — that is what tells a mirror that has simply fallen behind
(re-sync it) apart from one that was edited locally (move the change into `q2-launcher` first,
then re-sync). Without `--launcher` it only checks the mirror against the lock and says so. It
only reads; it never writes to either repository. Exits non-zero when it finds drift.

## Test artefacts

Playwright writes traces and screenshots for failing tests to `studio/test-results/`.
That directory is git-ignored.

## Third-party

The mirrored rendering (`studio/src/mirror-runtime/mirrorStyles.ts`) bundles the three font
families the launcher's own `home-hero.css` and base styles read — Inter, Oswald and JetBrains
Mono — via the `@fontsource-variable/*` packages, the same packages and import pattern the
launcher's own `main.tsx` uses. Each is licensed under the SIL Open Font License 1.1 (OFL 1.1):

- Inter — Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
- Oswald — Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)
- JetBrains Mono — Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono)
