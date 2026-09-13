---
id: 002
title: End-to-end harness for the studio surface
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Most of what this project builds is something a person does: open the studio, pick an entry, see
it, fix it, save it. Those criteria are only honestly proven through the real surface — a test
that calls an internal module and a test that drives the actual page are not the same claim.

`.claude/ai-scrum.md` currently records `e2e: none` and `ui-acceptance-required: false`, both of
which were correct while this repository had no surface at all. Story 001 gives it one. This story
gives the project the harness that proves it, and flips the profile so every later story is held
to it.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-4.

## Acceptance Criteria

- [x] **AC1** — `npm run e2e` starts the studio, drives it with Playwright and exits 0 on a clean
      tree.
- [x] **AC2** — At least one e2e test opens the studio in a real browser and asserts on a visible
      element of the shell, not on the served HTML string.
- [x] **AC3** — The e2e run reaches nothing beyond localhost — no network access is required to
      run it.
- [x] **AC4** — A broken studio (the dev server fails to start, or the asserted element is absent)
      makes `npm run e2e` exit non-zero with a message naming what was expected.
- [x] **AC5** — `.claude/ai-scrum.md` records the e2e command under `## Verify` and sets
      `ui-acceptance-required: true`, with the stale "no user-facing surface" note removed.
- [x] **AC6** — Getting from a fresh clone to a passing e2e run is documented in one place,
      including the browser-install step.

## Decisions (Sprint)

- **(User)** Browsers: Chromium only — fast and sufficient for a local authoring tool that is not
  shipped to end users.
- **(User)** Dev server lifecycle: the harness starts it itself, so a fresh contributor can run
  `npm run e2e` cold with no separate manual step.
- **(User)** Artefacts: traces and failure screenshots go to `studio/test-results/`, git-ignored.

Decisions taken during refine (not user-answered):

- **Runner: `@playwright/test`, pinned exact `1.62.1`** — the version the launcher checkout resolves
  for `playwright`, following story 001's rule that toolchain versions are pinned exact, not ranged.
- **Layout: specs in `studio/e2e/`, config `studio/playwright.config.ts`** — a separate tree from
  Vitest's scope, so `npm run test` stays fast and browser-free and `npm run e2e` is the only
  command that needs chromium.
- **Scripts follow story 001's workspace shape** — `e2e` and `e2e:install` in `studio/package.json`,
  root passthroughs delegating with `--workspace studio`, because a contributor should not need to
  know where the manifest lives.
- **Fixed port `5173` with `--strictPort`** — the harness starts the dev server on a known URL
  instead of parsing Vite's output, and a port already in use fails loudly rather than silently
  testing another tree.
- **`reuseExistingServer: false`** — the user decision says a fresh contributor runs `npm run e2e`
  cold; reusing a server someone left running would prove a different tree than the one on disk.
- **AC3 is a shared fixture, not a single spec** — `localhost-only.ts` extends `test` so every later
  e2e spec inherits the guard, rather than one spec asserting it once and future specs escaping it.
- **AC4 is proven by nested runs against their own config** — the harness spawns
  `playwright test --config e2e/harness/negative.config.ts`; a separate config makes re-entering the
  real suite structurally impossible, and it keeps the proof inside `npm run e2e`.
- **The broken-server half is triggered by `E2E_WEBSERVER_COMMAND`** read only by the negative
  config — the real config is never mutated at runtime to produce a failure.
- **AC6's documentation lives in `studio/README.md`, not the root `README.md`** — story 003 rewrites
  the root README's boundary section in this same sprint, and two stories editing the same section
  is a merge conflict waiting to happen.
- **Artefacts: `outputDir: test-results`, `trace: retain-on-failure`, `screenshot: only-on-failure`,
  html reporter with `open: 'never'` into the same directory** — one git-ignored directory, as the
  user decision asks, and no browser window opening in an autonomous run.
- **The profile flip happens in this story, not a later clean-up** — AC5 is what makes every
  following story hold itself to the real surface, and a harness nobody is required to use decays.

## Open Questions

- ~~Which browsers does the harness install and run?~~ answered → Decisions (Sprint)
- ~~Does the harness start the dev server itself, or expect one to be running?~~ answered →
  Decisions (Sprint)
- ~~Where do e2e artefacts go, and are they git-ignored?~~ answered → Decisions (Sprint)

## Plan

Add a Playwright suite on top of story 001's workspace scaffold (`studio/` as the app root, root
passthrough scripts delegating with `--workspace studio`), then flip the profile that still says
this repository has no surface.

1. **Runner + config** — `@playwright/test` `1.62.1` (exact, the launcher's resolved version) as a
   dev dependency of `studio/package.json`; `studio/playwright.config.ts` with the chromium project
   only, `testDir: 'e2e'`, `baseURL: 'http://127.0.0.1:5173'`, `outputDir: 'test-results'`,
   `trace: 'retain-on-failure'`, `screenshot: 'only-on-failure'`, and a `webServer` block running
   `npm run dev -- --port 5173 --strictPort` with `reuseExistingServer: false`. Scripts `e2e` and
   `e2e:install` in `studio/package.json`, passthroughs of the same names at the root.
   `.gitignore` gains `studio/test-results/`.
2. **The real assertion** — `studio/e2e/studio-shell.spec.ts` navigates to `/` and asserts the
   page title and a visible heading via `getByRole`, i.e. the rendered DOM, not the served HTML.
3. **Localhost-only guard** — `studio/e2e/fixtures/localhost-only.ts` extends `test` with a route
   handler that records and aborts every request outside `localhost`/`127.0.0.1`;
   `studio/e2e/localhost-only.spec.ts` asserts the recorded list is empty. Every later spec imports
   `test` from that fixture, so the rule holds for the whole suite.
4. **Negative proof** — `studio/e2e/harness/negative.config.ts` (its own config, pointed at
   `studio/e2e/harness/fixtures/`, so a nested run can never re-enter the real suite) plus two
   fixture specs: one asserting an element that does not exist, one run with
   `E2E_WEBSERVER_COMMAND` set to a command that exits immediately. `studio/e2e/harness/
   negative-run.spec.ts` spawns both through `playwright test --config …` and asserts a non-zero
   exit code and the expected text in the output.
5. **Profile + docs** — `.claude/ai-scrum.md`: `e2e: npm run e2e` under `## Verify`,
   `ui-acceptance-required: true`, stale "no user-facing surface" note removed;
   `studio/README.md` documents fresh clone → `npm install` → `npm run e2e:install` →
   `npm run e2e`; story 001's `studio/tests/repo-contract.test.ts` gains the two assertions that
   keep both from silently regressing.

Order: 1 before 2-4 (nothing runs without the config), 5 last so the contract test sees the final
state. Nothing outside `studio/`, `.gitignore`, the two manifests and `.claude/ai-scrum.md` is
touched; the root `README.md` belongs to story 003 and stays untouched here.

## Deliverables

- [x] **D1 — Playwright runner, config and scripts (AC1's command).**
  Files: `studio/package.json` (dev dependency + `e2e`, `e2e:install` scripts), `package.json`
  (root passthroughs, mirroring the `test`/`lint` entries story 001 writes), `.gitignore`,
  `studio/playwright.config.ts` (new).
  Mirror for the script/passthrough shape: the root manifest from story 001's D1.
  Acceptance: `npm run e2e:install` fetches chromium; `npm run e2e` from the clone root starts the
  dev server itself, runs the (initially empty-then-D2) suite and exits 0; `git status` shows no
  `studio/test-results` entry after a run.

- [x] **D2 — The shell spec through a real browser (AC1, AC2), plus its test.**
  Files: `studio/e2e/studio-shell.spec.ts` (new).
  Acceptance: the spec navigates to `baseURL`, asserts `page.title()` names the Content Studio and
  that `getByRole('heading', …)` from story 001's `StudioPage` is visible; it fails if the heading
  is removed. No assertion touches the raw HTML response.

- [x] **D3 — Localhost-only fixture and its spec (AC3).**
  Files: `studio/e2e/fixtures/localhost-only.ts` (new), `studio/e2e/localhost-only.spec.ts` (new),
  `studio/e2e/studio-shell.spec.ts` (import `test` from the fixture).
  Acceptance: loading the studio records zero aborted external requests; a deliberate
  `page.goto('https://example.com')` inside the fixture's scope is aborted and reported, proving
  the guard actually fires.

- [x] **D4 — Negative harness proof (AC4).**
  Files: `studio/e2e/harness/negative.config.ts` (new), `studio/e2e/harness/fixtures/
  missing-element.spec.ts` (new), `studio/e2e/harness/fixtures/server.spec.ts` (new),
  `studio/e2e/harness/negative-run.spec.ts` (new), `studio/playwright.config.ts` (a second
  `harness` project, so `npm run e2e` covers it).
  Acceptance: both spawned runs exit non-zero; the missing-element run's output names the expected
  heading text, the failed-server run's output names the server/URL it waited for. The nested runs
  use their own config and cannot re-enter the real suite.

- [x] **D5 — Profile, contributor doc and contract assertions (AC5, AC6).**
  Files: `.claude/ai-scrum.md`, `studio/README.md` (new), `studio/tests/repo-contract.test.ts`
  (extended, from story 001's D6).
  Acceptance: the profile's `## Verify` records `e2e: npm run e2e`, `ui-acceptance-required: true`
  and no longer carries the "No user-facing surface lives in this repository yet" note;
  `studio/README.md` names `npm install`, `npm run e2e:install` and `npm run e2e` in that order;
  the contract test asserts both and fails if either is reverted.

## Model Hints

- D1 → default
- D2 → default
- D3 → default
- D4 → **deliverable-hard** — a Playwright test that spawns nested Playwright runs is where exit
  codes, recursion into the real suite, worker timeouts and Windows process handling all go wrong
  at once, and a false green here would make AC4 an unverified promise.
- D5 → default
- Review: → default — a new harness with no existing behaviour to regress; every criterion is
  machine-checked by the commands this story installs.

## Acceptance Tests

- AC1 → e2e `studio/e2e/studio-shell.spec.ts` › "the studio shell opens at the dev server URL"
  (D2), run by the profile's `e2e` command, which starts the dev server itself (D1); plus unit
  `studio/tests/repo-contract.test.ts` › "the manifests expose e2e and e2e:install" (D5) so the
  script cannot silently disappear.
- AC2 → e2e `studio/e2e/studio-shell.spec.ts` › "the shell heading is visible in the browser" (D2)
  — a `getByRole` assertion against the rendered DOM.
- AC3 → e2e `studio/e2e/localhost-only.spec.ts` › "the studio run requests nothing beyond
  localhost" and › "an external request is aborted and reported" (D3).
- AC4 → e2e `studio/e2e/harness/negative-run.spec.ts` › "a missing shell element fails the run and
  names what was expected" and › "a dev server that cannot start fails the run" (D4).
- AC5 → unit `studio/tests/repo-contract.test.ts` › "the profile records the e2e command and
  requires UI acceptance" (D5).
- AC6 → unit `studio/tests/repo-contract.test.ts` › "studio/README.md documents install, browser
  install and the e2e run" (D5).

Coverage: AC1→D1+D2, AC2→D2, AC3→D3, AC4→D4, AC5→D5, AC6→D5 — every criterion has a deliverable
and a named automated check. No manual residue.

Dependency, named deliberately: this suite only passes once story 001's D2 shell exists. It is the
second story of the sprint for that reason.

## Done

Playwright (`@playwright/test` 1.62.1, chromium only) is now the studio's e2e harness: a
`studio/playwright.config.ts` that starts the dev server itself on `127.0.0.1:5173`, a real-browser
shell spec, a localhost-only guard fixture every spec inherits, and a nested-run negative harness
that proves a broken studio fails loudly. The profile is flipped (`e2e: npm run e2e`,
`ui-acceptance-required: true`), `studio/README.md` documents the fresh-clone path, and
`studio/tests/repo-contract.test.ts` guards all of it against silent regression.

**Commit message:** `002: add Playwright e2e harness and flip ui-acceptance-required`

**Decisions (Sprint, made during build, not user-answered):**
- Vite's default `localhost` bind resolved to `::1` only on this Windows machine, so the
  `webServer` command was changed to `npm run dev -- --port 5173 --strictPort --host 127.0.0.1`
  (not the bare `--port 5173 --strictPort` from the plan) — otherwise `baseURL:
  'http://127.0.0.1:5173'` could never reach it.
- The negative-harness config runs its nested dev server on port `5199`, not `5173` — the outer
  run's real server already holds `5173` while the nested run happens, and `reuseExistingServer:
  false` would either abort on "port in use" (wrong-reason failure) or, with `true`, spuriously
  reuse the healthy server and pass the broken-server test for the wrong reason.
- Playwright 1.62's webServer-timeout error does not itself name the URL, so
  `negative.config.ts` logs the harness URL at config-load time and the test asserts on
  `config.webServer` plus that URL together, so the log line alone can never look like the
  expected failure text.
- `npx` was avoided for spawning the nested Playwright CLI (a `.cmd` shim on Windows needs a
  shell); spawned instead via `process.execPath` + `require.resolve('@playwright/test/cli')`.
- Removed `--pass-with-no-tests` from the `e2e` script once real specs existed (D1 needed it
  transiently against an empty suite) — code review flagged that leaving it in would let a
  silently-broken test-discovery pattern still exit 0, which is exactly the kind of false green
  AC4 exists to catch.
- D4 also fixed lint fallout left by D1/D3 (Playwright/e2e files were outside every tsconfig
  `project`, and ESLint's `react-hooks` rule misfired on Playwright's `use` fixture callback):
  `studio/tsconfig.node.json` now includes `playwright.config.ts` and `e2e/**/*.ts`,
  `studio/.prettierignore` ignores `test-results/`, and `studio/eslint.config.js` scopes
  `react-hooks` to `src/**` only. Reviewed and confirmed as legitimate scope corrections, not
  weakenings.

**Verification:**
- `npm run build`, `npm run test` (8/8 passed), `npm run lint`, `npm run typecheck` — all green.
- `npm run e2e` — 6/6 passed, exit 0, run repeatedly with no leaked port/process state.
- AC1 → `studio/e2e/studio-shell.spec.ts` › "the studio shell opens at the dev server URL" (passed)
  + `studio/tests/repo-contract.test.ts` › "the manifests expose e2e and e2e:install" (passed).
- AC2 → `studio/e2e/studio-shell.spec.ts` › "the shell heading is visible in the browser" (passed,
  `getByRole` against the rendered DOM).
- AC3 → `studio/e2e/localhost-only.spec.ts` › "the studio run requests nothing beyond localhost"
  and › "an external request is aborted and reported" (both passed; the guard was confirmed to
  actually intercept and abort a real external `fetch`, not a no-op).
- AC4 → `studio/e2e/harness/negative-run.spec.ts` › "a missing shell element fails the run and
  names what was expected" and › "a dev server that cannot start fails the run" (both passed;
  nested runs use their own config and cannot re-enter the real suite).
- AC5, AC6 → `studio/tests/repo-contract.test.ts` › "the profile records the e2e command and
  requires UI acceptance" and › "studio/README.md documents install, browser install and the e2e
  run" (both passed).
- No manual residue.
- Clean-agent review: PASS. Two findings, both handled: (1) stale `--pass-with-no-tests` flag —
  fixed (removed, re-verified green); (2) `negative-run.spec.ts` imports `test` from the
  localhost-only fixture without using the `page` fixture in either test — left as-is, since
  every e2e spec importing from the shared fixture is the story's own decision, and this D's
  tests do no page navigation so the guard is inert rather than wrong.
- No open blockers.
