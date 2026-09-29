---
id: 030
title: v1 acceptance — the full authoring flow
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

Every story before this one proves its own piece. None of them proves the thing the project was
actually for: that a person can sit down, write a news post, see it, check it and publish it,
without leaving the studio and without knowing the contract by heart.

This is the story that says v1 is done. It walks the whole path through the real surface, in one
run, and it is deliberately the same path the quickstart documents — so the documentation and the
acceptance test cannot describe two different products.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-28.

## Acceptance Criteria

- [ ] **AC1** — An end-to-end run walks the full flow through the studio's real surface: create from
      a template, write the body, fill the frontmatter, add an image, preview it, validate it,
      publish it.
- [ ] **AC2** — The run exercises the failure the project exists to prevent: an entry that would
      silently fall back is caught and reported before publishing, and the run shows it being fixed.
- [ ] **AC3** — The flow writes only inside a fixture content tree; the repository's own `news/` is
      byte-identical before and after the run.
- [ ] **AC4** — After the flow, the `validate` command reports the new entry as delivered exactly as
      declared.
- [ ] **AC5** — The documented quickstart and this flow describe the same sequence of steps, checked
      rather than assumed.
- [ ] **AC6** — The run performs no git operation and reaches nothing beyond localhost.

## Open Questions

- ~~Where does the fixture content tree come from — a copy of the repository's own `news/`, or a
  purpose-built minimal one? A copy is more realistic and breaks whenever real content changes.~~ answered → Decisions (Sprint)
- ~~Should this flow also be the thing that produces reference screenshots of the four templates, so a
  rendering regression after a re-sync is visible?~~ answered → Decisions (Sprint)
- ~~Does v1 need a second flow for the reverse path — opening an existing entry, changing it and
  saving — or is that sufficiently covered by the individual stories?~~ answered → Decisions (Sprint)
- ~~BLOCKING — the mirror hash lock depends on the checkout, so the former mirror-integrity
  criterion cannot pass anywhere: `studio/launcher-core.lock.json` hashes the launcher's
  working-tree bytes, the mirror files' line endings differ per checkout (`core.autocrlf=true`, no
  `.gitattributes`), and `npm run check:drift` fails here with 6 `locally-edited` findings. Options
  were (a) a new story that hashes line-ending-normalised content, (b) `.gitattributes` in both
  repos, (c) fold (a) into 030.~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Fixture content tree: purpose-built and minimal, not a copy of news/
- **(User)** Mirror integrity vs. LF/CRLF lock hashes: AC5 is dropped from 030; the hash/line-ending problem is out of scope for this sprint (follow-up candidate for the review)
- Numbering after that decision: the dropped AC5 was the mirror-integrity guard ("the run fails if
  the mirror is out of sync"); the former AC6/AC7 are now AC5/AC6, and the mirror guard helper and
  its `checkDrift` call are gone from the plan. The flow still asserts the mirrored `home-hero-*`
  markers in the preview as part of AC1/AC2, but does not check the lock.
- Fixture shape: a temporary sandbox root (in `os.tmpdir()`, outside any git repository) made of a
  committed minimal `news/` (one published `text` entry, its `.md`, an `index.json`, an empty
  `img/`) and an empty `studio/` marker, with `news/_templates/` copied at setup from the
  repository's real kit (a read-only copy). Reason: this is the sandbox shape
  `studio/tests/validate-cli.test.ts` already uses, and the copied kit keeps story 025's "the kit
  is the only starter content" true inside the fixture.
- Dev-server seam: an env var `STUDIO_REPO_ROOT`, read only by `fileBridgePlugin`. It is checked
  through the same `resolveRepoRoot` rule (it must hold a `studio/` marker), is not documented in
  the quickstart, and is replaced by an equivalent seam if stories 024–027 already built one.
  Reason: AC3 needs the real bridge to write into a fixture, while the concept rules out a
  user-facing repo-path argument, so the seam is test-only and limited to the bridge (mirror
  provenance still comes from the real studio).
- The flow starts the studio with Vite's `createServer` on the studio's own `vite.config.ts`
  (127.0.0.1, ephemeral port), not by spawning `npm`. Reason: spawning npm adds process-lifecycle
  flakiness on Windows, and npm's own update check would be an outbound request outside AC6's
  control.
- The silent failure the flow exercises: a `cover` entry whose `image` points to a file not yet in
  `img/`, which the launcher silently delivers as `text`. "Caught before publishing" means the
  validation panel names the fallback and the preview shows a `text` slide, before the publish
  step runs. The fix is adding that image through the studio. Reason: this is the concept's
  canonical silent behaviour, and story 027 only blocks *dropped* entries at publish, so 030 must
  not invent a second publish gate.
- The upload source image is the repository's `news/img/cover-community-welcome.png`, read-only.
  Reason: it already has the dimensions the cover kit expects, so story 026's size warnings stay
  quiet and no binary fixture is added.
- AC5 mechanism: the flow reads its step sequence at runtime from the quickstart's marked ordered
  list in `studio/README.md` and dispatches each step to a typed step registry. A unit test also
  checks that the two sets are equal. Reason: the flow then follows the document literally, so any
  drift fails the run instead of being assumed away.
- The `install` step checks the prerequisites it documents (Node ≥ 22, dependencies resolvable)
  instead of re-running `npm install`. Reason: a reinstall reaches the network, which AC6 forbids.
- AC6 proof: the existing `e2e/fixtures/localhost-only.ts` covers the browser. Node gets a
  `net.Socket.prototype.connect` recorder (in-process for the server, `--import` for the spawned
  CLI) and a `git` shim prepended to `PATH` that records any invocation. Reason: both catch real
  calls from either process without relying on code review.
- No reference screenshots of the four templates in this story. Reason: pixel baselines break on every
  legitimate re-sync and on font rasterisation, so they are a follow-up story if wanted (together
  with the mirror-integrity follow-up above).
- No second flow for the reverse path (open, change, save an existing entry). Reason: the criteria
  name only the create-to-publish path, and stories 022–024 prove editing and saving an existing
  entry through their own e2e tests.

## Plan

Order: D1 → D2 → D3 → D4. D4 needs stories 018–028 built.

1. **D1 — content-root seam.** `fileBridgePlugin` honours `STUDIO_REPO_ROOT` (validated like
   `resolveRepoRoot`), so a dev server can serve and write a sandbox. Everything else still comes
   from the real studio.
2. **D2 — flow harness (Node side, no browser).** Covers sandbox creation from a committed fixture
   plus the copied kit, a sha256 snapshot of the repository's own `news/`, the network recorder,
   and the `git` shim. Each part gets vitest tests, including a negative one per guard.
3. **D3 — quickstart step contract.** A parser for a marked ordered list in `studio/README.md` and
   the typed `FLOW_STEP_NAMES`. The README's list is aligned to the flow (create, write,
   frontmatter, image, preview, validate, publish after install and start). A unit test checks that
   the two agree.
4. **D4 — the flow spec.** `studio/e2e/v1-acceptance-flow.spec.ts`: beforeAll snapshots `news/`, builds the
   sandbox, installs the guards and starts Vite on it. The steps come from the README in order, driven only through the UI. After the steps it runs the
   `validate --json` CLI on the sandbox, and afterAll checks that `news/` is unchanged, that neither
   guard recorded anything and that no `.git` exists in the sandbox.

Files: `studio/src/bridge/file-bridge-plugin.ts`, `studio/e2e/v1-flow/*.ts`,
`studio/e2e/fixtures/v1-flow-tree/news/**`, `studio/README.md`, `studio/tests/v1-flow-*.test.ts`,
`studio/e2e/v1-acceptance-flow.spec.ts`. Nothing under `news/` or `studio/src/launcher-core/`
changes.

## Deliverables

- **D1 — `STUDIO_REPO_ROOT` seam for the dev-server file bridge.** In
  `studio/src/bridge/file-bridge-plugin.ts`, if `process.env.STUDIO_REPO_ROOT` is set, pass
  `resolveRepoRoot(<that path>)` (from `studio/src/content-repo/paths.ts`, which throws unless the
  path holds a `studio/` directory) to `createFileBridge` instead of
  `resolveRepoRoot(server.config.root)`. The value must be an absolute path. A relative path is
  refused with a thrown error that names it. Nothing else reads the variable: mirror provenance
  (`mirrorProvenancePlugin`) and the registry stay on the real studio. First check whether stories
  024–027 already added an equivalent seam; if so, reuse it, keep only the tests below, and update
  the name in D2/D4. Add a one-line comment saying it is a test seam and not a user option (no
  README mention). Tests: extend `studio/tests/file-bridge-dev-server.test.ts` (mirror its existing
  server-start pattern) with "STUDIO_REPO_ROOT serves the sandbox's news, not the repository's" and
  "a relative STUDIO_REPO_ROOT is refused".
- **D2 — Node-side flow harness under `studio/e2e/v1-flow/`.** This is plain TypeScript with no
  `@playwright/test` import, so vitest can load it.
  - `sandbox.ts`: `createFlowSandbox(repoRoot)` makes a `mkdtemp` dir under `os.tmpdir()` (never
    inside the repo), copies in `studio/e2e/fixtures/v1-flow-tree/news/`, copies the repository's
    real `news/_templates/` into `news/_templates/` (a read-only copy), and adds an empty `studio/`
    marker plus empty dirs for the other registry directories (`engines`, `gamedata`, `packs`,
    `mods`, `config_templates`). It returns `{ root, cleanup }`.
  - Committed fixture `studio/e2e/fixtures/v1-flow-tree/news/`:
    - `index.json` with one row `{ "id": "fixture-welcome", "file": "2026-01-01-fixture-welcome.md" }`,
      matching the shape of the real `news/index.json`.
    - That `.md` file as a `text` template with a title, `order: 10` and a one-line body.
    - `img/.gitkeep`.
  - `news-snapshot.ts`: `snapshotTree(dir)` returns a sorted `path → sha256` map of every file, for
    the before/after comparison.
  - `network-guard.ts`: when imported, it patches `net.Socket.prototype.connect` to append any
    non-loopback target (anything other than `127.0.0.1`, `::1` or `localhost`) to the file named
    by `process.env.FLOW_NETWORK_LOG`, and then lets it proceed. It is loadable both in-process and
    via `node --import`.
  - `git-shim.ts`: `installGitShim()` writes a dir holding `git` (sh) and `git.cmd`. Both append
    their argv to a log file and exit 1. It returns `{ binDir, logPath }`, so a caller can prepend
    `binDir` to `PATH`.

  Tests in `studio/tests/v1-flow-harness.test.ts`:
  - "the sandbox holds the fixture news, the real kit and a studio marker, outside the repository"
  - "snapshotTree detects a one-byte change"
  - "the network guard records a non-loopback connect and ignores 127.0.0.1"
  - "the git shim records an invocation found through PATH"
- **D3 — the quickstart step contract.**
  - `studio/e2e/v1-flow/quickstart-steps.ts` exports
    `FLOW_STEP_NAMES = ['install', 'start', 'create', 'write', 'frontmatter', 'image', 'preview', 'validate', 'publish'] as const`,
    the type `FlowStepName`, and `readQuickstartSteps(readmeText)`. The function returns the
    lower-cased bold keyword that starts each item of the ordered list between
    `<!-- flow-steps:start -->` and `<!-- flow-steps:end -->` in `studio/README.md`. It throws if
    the markers are missing or an item has no bold keyword.
  - In `studio/README.md` (the quickstart story 028 wrote), wrap the quickstart's ordered list in
    those markers. Where 028's list differs from `FLOW_STEP_NAMES`, change the README so each item
    starts with the matching keyword, e.g. `**Frontmatter** — …` or `**Image** — …`. Keep 028's
    wording otherwise.
  - Tests in `studio/tests/v1-flow-quickstart.test.ts`:
    - "the quickstart lists exactly the flow's steps, in order", which compares against the real
      README.
    - "a quickstart without the step markers is refused".
- **D4 — the v1 acceptance flow, `studio/e2e/v1-acceptance-flow.spec.ts`.** Import `test`/`expect`
  from `./fixtures/localhost-only`, so every browser request goes through the external-request
  recorder. Run it as one serial test with a `test.step` per quickstart step.
  - `beforeAll`:
    - Take `snapshotTree(<repo>/news)`.
    - Run `createFlowSandbox`.
    - Run `installGitShim` and prepend its `binDir` to `process.env.PATH`.
    - Set `FLOW_NETWORK_LOG` and import `network-guard.ts`.
    - Set `STUDIO_REPO_ROOT=<sandbox>`.
    - Run `createServer({ configFile: <studio>/vite.config.ts, root: <studio>, server: { host: '127.0.0.1', port: 0 } })`,
      then `listen()`, and use its URL as the page's base URL.
  - Steps, in the order read by `readQuickstartSteps(<studio>/README.md)`, dispatched through a
    `Record<FlowStepName, (ctx) => Promise<void>>`. Every step drives the real UI only: no
    `page.route` on `/__studio/`, and no `fs` writes into the sandbox from the test.
    - `install`: `process.versions.node` major ≥ 22, and `vite` and `@playwright/test` resolve.
    - `start`: the root `package.json`'s `studio` script runs the studio workspace's `dev` script,
      which is `vite`; then `page.goto(base)` shows the library listing `fixture-welcome`.
    - `create`: pick `cover` in the new-entry picker (story 025) with title `V1 Flow Cover`.
    - `write`: type the body in the body editor (story 023).
    - `frontmatter`: fill the required cover fields (story 022). Set `image` to
      `img/v1-flow-cover.png`, a file that does not exist yet, then save (story 024). Assert the
      validation panel (story 017) names the fallback: declared `cover`, delivered `text`, reason
      naming `img/v1-flow-cover.png`. Assert the preview iframe (stories 018/020) shows the mirrored
      text slide and no `img.home-hero-cover-image`.
    - `image`: add `news/img/cover-community-welcome.png` as `v1-flow-cover.png` through the add
      image control (story 026), using `setInputFiles`.
    - `preview`: inside the preview iframe, `img.home-hero-cover-image` is visible, its `src` ends
      in `/news-img/v1-flow-cover.png`, and `naturalWidth` > 0.
    - `validate`: the panel shows delivered `cover` with no fallback finding.
    - `publish`: publish the draft (story 027). The library shows it as published.
  - After the steps, spawn `validate --json` with `cwd = sandbox`. Mirror `runCli` in
    `studio/tests/validate-cli.test.ts` (tsx cli plus `--tsconfig`), with
    `--import <network-guard.ts>` in `NODE_OPTIONS` and the shimmed `PATH`. Expect exit 0, and the
    new entry has declared template `cover` = delivered template `cover`, with no findings.
  - `afterAll`, in order:
    - Check `snapshotTree(<repo>/news)` deep-equals the before snapshot.
    - Check the network log and the git log are empty or absent, and the page's `externalRequests`
      is `[]`.
    - Check no `.git` exists in the sandbox.
    - Close the server and clean up the sandbox.

  Use the selectors and test ids that stories 017–027 actually shipped, read from their e2e specs,
  and never invent new ones in product code. Test name: "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree".

## Model Hints

- D4 → deliverable-hard. D4 is the only place stories 017–027 are driven together through one
  running studio, with its own server lifecycle, env seams and guards. A missed selector or a
  step that quietly writes via `fs` still turns green while proving nothing.
- Review: → story-review-hard. The plausible wrong implementation is a flow that sets up a step by
  hand, which every assertion here accepts and a default diff review easily misses. Examples:
  copying the image into the sandbox with `fs.copyFileSync`, stubbing a bridge route, or a registry
  step that is a no-op.

## Acceptance Tests

- AC1 → e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree" (steps create…publish through the UI).
- AC2 → e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree" (the `frontmatter` step asserts the
  cover→text fallback in the panel and the preview, the `image` step fixes it, the `validate` step
  sees it gone).
- AC3 → e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree" (the `news/` snapshot comparison in afterAll),
  plus unit `studio/tests/v1-flow-harness.test.ts` › "snapshotTree detects a one-byte change" and
  › "the sandbox holds the fixture news, the real kit and a studio marker, outside the repository",
  plus unit `studio/tests/file-bridge-dev-server.test.ts` › "STUDIO_REPO_ROOT serves the sandbox's
  news, not the repository's".
- AC4 → e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree" (the spawned `validate --json` shows the entry
  delivered as declared).
- AC5 → unit `studio/tests/v1-flow-quickstart.test.ts` › "the quickstart lists exactly the flow's
  steps, in order", plus e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write,
  illustrate, preview, validate and publish a post in a fixture tree" (the step order is read from
  the README at runtime).
- AC6 → e2e `studio/e2e/v1-acceptance-flow.spec.ts` › "v1: create, write, illustrate, preview,
  validate and publish a post in a fixture tree" (empty `externalRequests`, network log and git
  log, and no `.git` in the sandbox), plus unit `studio/tests/v1-flow-harness.test.ts` › "the
  network guard records a non-loopback connect and ignores 127.0.0.1" and › "the git shim records
  an invocation found through PATH".

Coverage gate: every criterion has a deliverable and a test.

| AC | Deliverable | Test |
| --- | --- | --- |
| AC1 | D4 | flow e2e |
| AC2 | D4 | flow e2e |
| AC3 | D1, D2, D4 | flow e2e, harness unit, seam unit |
| AC4 | D4 | flow e2e (spawned CLI) |
| AC5 | D3, D4 | quickstart unit, flow e2e |
| AC6 | D2, D4 | flow e2e, harness unit |

## Done

<Filled by `/build 030`.>
