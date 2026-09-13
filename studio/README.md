# studio

`studio/` is the local authoring and validation tool for this repository. It is local
tooling only — per `CLAUDE.md`, the launcher never fetches it; the published surface
(`news/`, `engines/`, `gamedata/`, and the reserved `packs/`, `mods/`, `config_templates/`)
is content only.

## Getting started

From a fresh clone, run the following from the repository root, in this order:

1. `npm install` — installs dependencies for the whole workspace, including `studio`.
2. `npm run e2e:install` — fetches the Chromium browser Playwright needs to run the
   end-to-end suite.
3. `npm run e2e` — runs the end-to-end test suite. This starts the dev server itself;
   there is no separate `npm run dev` step to run first.

## Test artefacts

Playwright writes traces and screenshots for failing tests to `studio/test-results/`.
That directory is git-ignored.
