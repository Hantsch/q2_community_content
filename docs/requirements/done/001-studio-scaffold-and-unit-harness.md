---
id: 001
title: Studio scaffold with typecheck, lint and unit tests
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A contributor needs somewhere to write and check content locally. Today nothing runs in this
repository: there is no package manifest, no toolchain and no test command — `.claude/ai-scrum.md`
records `build`, `test`, `lint` and `typecheck` as `none`, which is why no story here can map an
acceptance criterion to a real test yet.

This story creates the studio application shell and the verification commands every later story
depends on. It delivers a page that opens, not a feature: the content work starts in Sprint 2.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-1, CS-2, CS-4.

## Acceptance Criteria

- [x] **AC1** — After `npm install`, `npm run studio` starts a dev server and serves a page whose
      title names the Content Studio; the command prints the URL it is reachable at.
- [x] **AC2** — `npm run typecheck` type-checks the studio sources and exits 0 on a clean tree.
- [x] **AC3** — `npm run lint` checks the studio sources with ESLint and Prettier and exits 0 on a
      clean tree.
- [x] **AC4** — `npm run test` runs Vitest and exits 0, with at least one test that asserts real
      behaviour rather than `expect(true)`.
- [x] **AC5** — `.claude/ai-scrum.md` records the real commands under `## Verify` for `build`,
      `test`, `lint` and `typecheck`, replacing the `none` entries.
- [x] **AC6** — `node_modules/` and build output are git-ignored; every studio source file is not.
- [x] **AC7** — Nothing under the published surface (`news/`, `engines/`, `gamedata/`, `packs/`,
      `mods/`, `config_templates/`) is added, moved or modified by this story.

## Decisions (Sprint)

- **(User)** Package manifest location: lives inside `studio/`, keeping the repository root free
  of build files. `npm run studio` from the clone root needs a thin passthrough (e.g. an
  `npm --prefix studio run dev` script or a root manifest with a `studio` script that shells into
  `studio/`) to satisfy AC1's wording without moving the manifest to the root.
- **(User)** React/Vite versions: pinned to match the launcher's exact versions, since
  `studio/src/launcher-core/` mirrors launcher source verbatim and version drift between the two
  trees risks subtle behavioural differences in the mirrored components.

Decisions taken during refine (not user-answered):

- **Passthrough shape: npm workspaces.** The root manifest declares `workspaces: ["studio"]`,
  because AC1 says "after `npm install`" (singular) — a workspace root installs the studio's
  dependencies in that one command, while every dependency stays declared in `studio/package.json`.
- **The root manifest carries no dependencies and no config**, only `private: true`, the workspace
  entry and four passthrough scripts (`studio`, `typecheck`, `lint`, `test`), so the root stays as
  free of build files as the user decision asks. The generated `package-lock.json` is committed —
  it is a lockfile, not build output.
- **Pinned versions are read from the launcher checkout** `C:\development\Hantsch\q2-launcher`
  (present on this machine, versions resolved from its installed `node_modules`): react and
  react-dom `19.2.8`, vite `7.3.6`, `@vitejs/plugin-react` `5.2.0`, typescript `7.0.2`, vitest
  `4.1.10`, `@types/react` `19.2.18`, `@types/react-dom` `19.2.4`, jsdom `30.0.1`,
  `@testing-library/react` `16.3.3`, prettier `3.9.6`, tailwindcss and `@tailwindcss/vite` `4.3.3`
  — written **exact** (no `^`), because "pinned" only holds if a later install cannot drift the
  compiler and renderer the mirror depends on.
- **ESLint is new, not mirrored.** The launcher has no ESLint config at all (only Prettier), so
  AC3's ESLint half cannot follow it: a flat `eslint.config.js` with `typescript-eslint`,
  `eslint-plugin-react-hooks` and `eslint-config-prettier` (so formatting rules never fight
  Prettier), at current stable ranges. The concept's "matches the launcher's setup" is true for
  Prettier only — recorded here rather than quietly ignored.
- **Prettier config is copied verbatim** from the launcher's `.prettierrc.json` (no semicolons,
  single quotes, print width 100, trailing commas, LF), so a contributor moving between the two
  repositories sees one style.
- **Tailwind v4 is part of the scaffold** (`@tailwindcss/vite`, the launcher's version), because
  the mirrored `home-hero.css` and its design-token subset arrive in stories 007/008 and
  retrofitting the CSS pipeline mid-sprint is more churn than two pinned dependencies now. The
  shell itself uses layout utilities only — no colour values, no token layer yet.
- **Scope of every command is `studio/`**; lint, typecheck and test never walk the published
  surface, which is how AC7 stays structurally true rather than merely observed.
- **`studio/src/launcher-core/` is in the ESLint ignore list from day one**, because CLAUDE.md
  forbids hand-editing the mirror and a lint error there would invite exactly that. It stays inside
  the tsconfig `include`, since CS-7 requires it to compile unchanged.
- **Test placement:** component tests are colocated (`StudioPage.test.tsx` next to the page, per
  the frontend-guidelines skill); repository-contract tests that assert about files rather than
  code live in `studio/tests/`.
- **AC1 is proven at dev-server level, not in a browser**, because the profile records `e2e: none`
  and `ui-acceptance-required: false`; story 002 adds the Playwright proof of the same page. The
  gap is named in `## Acceptance Tests`.
- **No router, no state library, no Storybook** in the scaffold — a single page needs none of them,
  and each would be dead weight the first content story has to work around.

## Open Questions

- ~~Does the package manifest live at the repository root, or inside `studio/`?~~ answered →
  Decisions (Sprint)
- ~~Is there a reason to pin the exact React and Vite versions to the launcher's?~~ answered →
  Decisions (Sprint)

## Plan

Create `studio/` as an npm workspace of a thin repository root, then add the four verification
commands in the order that lets each one verify what came before.

1. **Workspace + hygiene** — root `package.json` (private, `workspaces: ["studio"]`, passthrough
   scripts only), `studio/package.json` with the exact pinned versions above and
   `engines.node: ">=22"`, `.gitignore` (`node_modules/`, `dist/`, `*.tsbuildinfo`). `npm install`
   at the root produces the committed `package-lock.json`.
2. **App shell** — `studio/index.html` (`<title>Q2 Content Studio</title>`), `vite.config.ts`
   (react + tailwind plugins), `src/main.tsx`, `src/App.tsx`, `src/pages/studio/StudioPage.tsx`
   (heading plus one line on what the studio will do), `src/styles/index.css` with
   `@import 'tailwindcss'`. `npm run studio` → `vite`, which prints its local URL itself.
3. **Typecheck** — `studio/tsconfig.json` (strict, `jsx: react-jsx`, `moduleResolution: bundler`,
   mirroring the launcher's `tsconfig.web.json`) plus `tsconfig.node.json` for the Vite and Vitest
   config files; script `typecheck`.
4. **Lint** — `eslint.config.js` (flat; TS + react-hooks + prettier-config; ignores
   `src/launcher-core/`, `dist/`), `.prettierrc.json` copied from the launcher, `.prettierignore`;
   script `lint` = `eslint .` then `prettier --check .`.
5. **Tests** — `vitest.config.ts` (environment `node`, jsdom opted into per file via a
   `// @vitest-environment jsdom` docblock, mirroring the launcher's config), the colocated
   `StudioPage.test.tsx`, and `tests/dev-server.test.ts` which boots Vite programmatically, asserts
   `server.resolvedUrls.local[0]`, fetches it and asserts the served title.
6. **Profile + contract** — rewrite `## Verify` in `.claude/ai-scrum.md` (`build: npm run build`,
   `test: npm run test`, `lint: npm run lint`, `typecheck: npm run typecheck`; `e2e` stays `none`
   for story 002) and drop the stale "content-only repository" note; add
   `tests/repo-contract.test.ts` asserting the profile, the ignore rules and the untouched
   published surface.

Order matters: 3 before 4 before 5 (each new command must pass against what already exists), and 6
last so the contract test sees the final state. Nothing outside `studio/`, `.gitignore`,
`package.json`, `package-lock.json` and `.claude/ai-scrum.md` is touched.

## Deliverables

- [x] **D1 — Workspace root and git hygiene.**
  Files: `package.json` (root, new), `studio/package.json` (new), `.gitignore` (new),
  `package-lock.json` (generated, committed).
  Root manifest: `private: true`, `workspaces: ["studio"]`, scripts `studio`, `typecheck`, `lint`,
  `test`, each delegating with `--workspace studio`. Studio manifest: `private: true`,
  `type: module`, `engines.node: ">=22"`, the exact pinned dependencies from the Decisions
  section, scripts `dev`, `build`, `typecheck`, `lint`, `test`.
  Acceptance: `npm install` at the clone root succeeds, `npm run studio` resolves to the studio's
  `dev` script, and `git status` shows no `node_modules` entry.

- [x] **D2 — Vite + React app shell (AC1's subject).**
  Files: `studio/index.html`, `studio/vite.config.ts`, `studio/src/main.tsx`, `studio/src/App.tsx`,
  `studio/src/pages/studio/StudioPage.tsx`, `studio/src/styles/index.css`.
  Mirror for the Vite/React wiring: `q2-launcher/electron.vite.config.ts` (renderer section) and
  `q2-launcher/src/renderer/src/main.tsx`.
  Acceptance: `npm run studio` starts, prints a local URL, and that URL serves a page titled
  "Q2 Content Studio" with a visible heading. No colour values anywhere in the shell.

- [x] **D3 — TypeScript project and `typecheck` (AC2).**
  Files: `studio/tsconfig.json`, `studio/tsconfig.node.json`, `studio/package.json` (script).
  Mirror: `q2-launcher/tsconfig.web.json` for the compiler options, minus its Electron paths.
  Acceptance: `npm run typecheck` exits 0 against D2's sources and fails on an introduced type
  error.

- [x] **D4 — ESLint + Prettier and `lint` (AC3).**
  Files: `studio/eslint.config.js`, `studio/.prettierrc.json`, `studio/.prettierignore`,
  `studio/package.json` (script + dev dependencies).
  Mirror: `q2-launcher/.prettierrc.json`, verbatim.
  Acceptance: `npm run lint` exits 0 on the clean tree, flags an unused variable, and flags a
  mis-formatted file.

- [x] **D5 — Vitest harness and the first two real tests (AC4, and AC1's proof).**
  Files: `studio/vitest.config.ts`, `studio/src/pages/studio/StudioPage.test.tsx`,
  `studio/tests/dev-server.test.ts`, `studio/package.json` (script).
  Mirror: `q2-launcher/vitest.config.ts` for the config and the per-file jsdom convention.
  Acceptance: `npm run test` exits 0; the page test renders the shell and asserts its heading text
  (jsdom, `@testing-library/react`); the dev-server test boots Vite, asserts a resolved local URL
  and the served `<title>`, and closes the server in `afterAll` so the run terminates.

- [x] **D6 — Profile update and repository-contract test (AC5, AC6, AC7).**
  Files: `.claude/ai-scrum.md` (the `## Verify` block and the stale note under it),
  `studio/tests/repo-contract.test.ts`.
  Acceptance: the profile names the four real commands; the contract test asserts (a) no `none`
  remains for `build`/`test`/`lint`/`typecheck` in `## Verify` and the manifests expose those
  scripts, (b) `git check-ignore` ignores `node_modules/` and `studio/dist/` while every file under
  `studio/src/` is tracked, (c) `git diff --name-only <merge-base with feature/studio> -- news
  engines gamedata packs mods config_templates` is empty.

## Model Hints

- D1 → default
- D2 → default
- D3 → default
- D4 → default
- D5 → **deliverable-hard** — the dev-server test starts a real Vite server inside Vitest, where
  port allocation, `resolvedUrls` timing and teardown are exactly what leaves the run hanging or
  flaky, and this harness is what stories 002-030 all build on.
- D6 → default
- Review: → default — scaffolding with no existing behaviour to regress, and every criterion is
  machine-checked by the commands this story itself installs.

## Acceptance Tests

- AC1 → unit `studio/tests/dev-server.test.ts` › "the dev server reports a local URL and serves a
  page titled Q2 Content Studio" (D5).
  Named gap, deliberate: this proves the served document, not a browser. The profile records
  `e2e: none` and `ui-acceptance-required: false`; story 002 is this sprint's e2e harness and
  re-proves the same page through Playwright. It never becomes a manual step.
- AC2 → verify command `npm run typecheck`, the `typecheck` gate `/build` runs before this story
  may be called done (D3); plus unit `studio/tests/repo-contract.test.ts` › "the manifests expose
  studio, typecheck, lint and test" so the script cannot silently disappear (D6).
- AC3 → verify command `npm run lint`, the `lint` gate `/build` runs (D4); plus the same
  repo-contract script assertion (D6).
- AC4 → verify command `npm run test`, whose suite contains unit
  `studio/src/pages/studio/StudioPage.test.tsx` › "the shell renders the Content Studio heading" —
  a rendered-DOM assertion, not `expect(true)` (D5).
- AC5 → unit `studio/tests/repo-contract.test.ts` › "the profile's Verify block names real commands
  for build, test, lint and typecheck" (D6).
- AC6 → unit `studio/tests/repo-contract.test.ts` › "node_modules and build output are ignored and
  every studio source file is tracked" (D6).
- AC7 → unit `studio/tests/repo-contract.test.ts` › "the published surface is unchanged against the
  branch base" (D6).

Coverage: AC1→D5, AC2→D3, AC3→D4, AC4→D5, AC5→D6, AC6→D6, AC7→D6 — every criterion has a
deliverable and a named automated check. No manual residue.

## Done

Built the `studio/` npm workspace end to end: an npm-workspaces root manifest with passthrough
scripts, a Vite + React 19 app shell serving a "Q2 Content Studio" page, a strict TypeScript
project, a flat ESLint config plus a Prettier config mirrored from the launcher, and a Vitest
harness with a real dev-server boot test and a rendered-component test. `.claude/ai-scrum.md`'s
`## Verify` block now names the four real commands, and a repository-contract test locks in the
git-hygiene and published-surface guarantees so a later story can't quietly regress them.

Commit message: `001: scaffold studio workspace with typecheck/lint/test harness`

### Decisions

- ESLint/Prettier dev-dependency versions (eslint ^10.10.0, @eslint/js ^10.0.1,
  typescript-eslint ^8.70.0, eslint-plugin-react-hooks ^7.1.1, eslint-config-prettier ^10.1.8)
  were not pinned exact like the runtime/build deps — the story's pinning decision covers only
  the versions that mirror the launcher (React/Vite/TS/Vitest/Tailwind); ESLint tooling is new
  to this project, so current stable `^` ranges were used instead.
- `studio/package.json` declares `engines.node: ">=22"`; this dev machine's default Node is
  v20.20.2, which cannot run jsdom 30/Vitest 4 here (jsdom 30 requires Node ^22.22.2 || ^24.15.0
  || >=26). All verification in this story was run under Node v26.1.0 (available locally via
  nvm, invoked directly from its install directory since the nvm-for-Windows symlink step
  requires elevation this sandbox doesn't have). No `.nvmrc`/CI Node-version pin was added — out
  of scope for this story's deliverables; worth a follow-up if a CI runner is added later.
- AC1 is proven at dev-server level (`studio/tests/dev-server.test.ts`), not through a browser —
  the profile records `e2e: none` and `ui-acceptance-required: false` at the time of this story;
  story 002 (this sprint) adds the Playwright proof of the same page. This gap is named in
  `## Acceptance Tests` above, not silently left as a manual step.

### Verification

- `npm run build`, `npm run test` (5 tests / 3 files), `npm run lint`, `npm run typecheck` all
  exit 0 (run under Node v26.1.0).
- AC1 → `studio/tests/dev-server.test.ts` — boots a real Vite server, asserts a resolved local
  URL, fetches it and asserts the served `<title>Q2 Content Studio</title>`. Passed.
- AC2 → `npm run typecheck` exits 0; `studio/tests/repo-contract.test.ts` asserts the script is
  real. Passed.
- AC3 → `npm run lint` exits 0; same repo-contract assertion for `lint`. Passed.
- AC4 → `npm run test` exits 0; `studio/src/pages/studio/StudioPage.test.tsx` renders the real
  component and asserts real heading/body text via `@testing-library/react`. Passed.
- AC5 → `studio/tests/repo-contract.test.ts` asserts `.claude/ai-scrum.md`'s `## Verify` block
  has no `none` left for build/test/lint/typecheck. Passed.
- AC6 → same file asserts `node_modules/` and `studio/dist/` are git-ignored and every
  `studio/src/` file is tracked. Passed; also confirmed live with `git check-ignore -v`.
- AC7 → same file diffs the published surface against the `feature/studio` merge-base (plus
  untracked-file check) and asserts it is empty. Passed; confirmed live and via a
  create/verify-fail/revert sanity check during D6.
- No manual residue — every criterion has a passing automated test.
- Clean-agent code review: **PASS**, no findings (scope, test quality, guardrails, and
  correctness all checked; see review agent's report for the full breakdown).
