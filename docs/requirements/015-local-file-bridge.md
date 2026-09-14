---
id: 015
title: Local file bridge between the browser and the working tree
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The studio runs in a browser, and a browser cannot read the repository. Something has to sit between
them. That something is the most security-relevant part of this project: it turns a page into a
process that can read — and later write — files on a contributor's machine.

So it gets a narrow definition on purpose. It serves the directories a content-type descriptor
declares, and nothing else; it refuses anything that resolves outside the repository root; and it
exists only while a developer is running the studio locally.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — section 4, "File access".

## Acceptance Criteria

- [ ] **AC1** — The studio reads `news/index.json`, the `.md` documents and the drafts through the
      bridge, from the browser, using the reader from story 010.
- [ ] **AC2** — A request whose resolved path lies outside the repository root is refused with an
      error, including `..` traversal, absolute paths and symlinks that point outside.
- [ ] **AC3** — Only directories declared by a registered content-type descriptor are reachable; a
      request for any other path in the repository is refused.
- [ ] **AC4** — Images under `news/img/` are served so the mirrored renderer can display them.
- [ ] **AC5** — The bridge exists only in the dev server; a production build of the studio contains
      no file-access code path.
- [ ] **AC6** — The bridge binds to localhost only.
- [ ] **AC7** — In this story the bridge is read-only: no route writes, creates or deletes anything.

## Open Questions

- ~~How do tests that will later exercise writing (stories 024, 026, 027, 030) avoid dirtying the
  real working tree? The obvious answer is a fixture repository root the bridge can be pointed at in
  tests only — but that is exactly the override that must never be reachable in normal use, so it
  needs deciding here rather than improvised later.~~ answered → Decisions (Sprint)
- ~~Does v1 need a production build of the studio at all, given it is a local tool? If not, AC5 gets
  simpler and the bundle never has to be built.~~ answered → Decisions (Sprint)
- ~~Should the bridge surface file modification times, so the editor can later detect a file that
  changed on disk while it was open?~~ answered → Decisions (Sprint)

## Decisions (Sprint)

- **(User)** Fixture repository root is wired as a constructor/factory argument, not an env var or
  CLI flag. Test code passes a fixture path directly; the real dev-server entrypoint always passes
  the real repository root. No runtime toggle exists that a normal run could trigger.
- **(User)** v1 is dev-server only; no production build of the studio exists in this sprint. AC5
  is satisfied by the bridge code only ever being reachable through the dev server — there is no
  separate production bundle to strip a file-access path from. Note this reinterpretation in the
  Done section when AC5 is proven.
- **(User)** File modification times are deferred. No editor exists yet in this sprint to detect a
  stale file; add mtimes to file responses when a later story needs conflict detection.
- The reader from story 010 (`readContentRepo`) runs **server-side inside the bridge** and the
  browser receives its result as JSON — it imports `node:fs` and can never run in a page, and a
  second browser-side reader would be exactly the drifting reimplementation this project refuses.
- The bridge exposes three route families under one prefix: a whole-directory read (no
  caller-supplied path at all), a single-file read, and the image route — the narrowest surface that
  still covers AC1, AC2 and AC4.
- The allowlist (AC3) is derived at construction time from the directories of story 014's
  descriptors (`createContentTypeRegistry(...)` mapped to `directory`), so the bridge names no
  content type in its own code and story 014 needs no change.
- Path confinement is a separate pure module rather than an inline check, because it is the one
  piece that must be unit-testable against every escape shape without booting a server.
- Symlink escapes are caught by resolving the real path of both the root and the candidate
  (`realpathSync`, falling back to the nearest existing ancestor for a missing file) — a string
  comparison of unresolved paths cannot see a link.
- The symlink escape fixture is created at test runtime as a directory junction on Windows and a
  symlink elsewhere, never committed: git on Windows cannot represent a symlink, and a test that
  skips would leave AC2's hardest case unproven.
- `src/mirror-runtime/newsImgMiddleware.ts` is folded into the bridge's image route, keeping the
  existing `/news-img/` prefix from `newsImageUrl.ts` — leaving a second, independently guarded
  file-access path in the dev server is the exact failure this story exists to prevent.
- Served images are limited to an extension allowlist of raster formats and sent with an explicit
  `Content-Type` plus `X-Content-Type-Options: nosniff`; `.svg` is refused, because an SVG served
  same-origin executes script and nothing in the studio needs one.
- The bridge additionally refuses any request whose `Host` header is not loopback and any
  cross-origin `Origin` — defence in depth against DNS rebinding, which a localhost bind alone does
  not stop.
- Read-only (AC7) is enforced twice: non-`GET`/`HEAD` methods answer 405, and a source-level test
  asserts no write API is imported anywhere under `src/bridge/`.
- AC5 is proven by a module-graph test walking the static imports of `src/main.tsx` (no bridge
  server module, no `node:` import) plus the plugin declaring `apply: 'serve'` — deterministic and
  fast, where building the bundle inside a test would not be.
- Localhost binding (AC6) is pinned explicitly as `server.host: '127.0.0.1'` in `vite.config.ts`
  rather than relying on Vite's default, so a later config edit cannot widen it silently.
- The browser client is wired into the news mount region story 014 D4 leaves behind, as a minimal
  read summary, so AC1 has a real surface to be proven through; story 016 replaces that region with
  the library view.

## Plan

1. **Path guard** (`studio/src/bridge/resolve-bridge-path.ts`): one pure function
   `resolveBridgePath({ repoRoot, directories, requestPath })` returning `{ ok, absolutePath }` or
   `{ ok: false, reason }`. Refuses, in order: NUL bytes and undecodable escapes, UNC paths, Windows
   drive letters, absolute paths, anything resolving outside the real repository root (after
   `realpathSync` on both sides, so a symlink or junction escape is caught), anything outside every
   declared content-type directory, and anything that is not a regular file. Mirrors
   `src/content-repo/paths.ts`'s `resolveInsideNews`, extended by the realpath and allowlist steps.
2. **Bridge server** (`studio/src/bridge/create-file-bridge.ts`): `createFileBridge({ repoRoot,
   directories })` returns a connect-style middleware. Routes under `/__studio/fs/`:
   `GET read?type=<id>` → story 010's `readContentRepo({ repoRoot })` as JSON;
   `GET file?path=<repo-relative>` → guarded text; plus `GET /news-img/<name>` → guarded image.
   Every other method → 405. Non-loopback `Host` or cross-origin `Origin` → 403. The root is only
   ever the constructor argument — no query parameter can change it.
3. **Vite plugin** (`studio/src/bridge/file-bridge-plugin.ts`): `apply: 'serve'`, `configureServer`
   binds the middleware to `resolveRepoRoot(server.config.root)` and to the directories of story
   014's registry. Wired in `vite.config.ts` in place of `newsImgMiddlewarePlugin`, which is
   deleted; `server.host: '127.0.0.1'` is pinned in the same file.
4. **Browser client** (`studio/src/bridge/client.ts` + `bridge-protocol.ts`): browser-safe fetch
   wrapper over the routes, returning the shape story 014's registry expects as its `source`, with a
   readable error state instead of a throw. Rendered as a small read summary in the news mount
   region from 014 D4.
5. **Order**: D1 → D2 → D3 → D4. D4 depends on story 014 D4's mount region being in place.
   Files touched: `studio/src/bridge/*`, `studio/vite.config.ts`,
   `studio/src/mirror-runtime/newsImgMiddleware.ts` (deleted),
   `studio/src/pages/studio/StudioPage.tsx`, `studio/src/organisms/NewsBridgeSummary.tsx`,
   `studio/tests/file-bridge-*.test.ts`, `studio/e2e/file-bridge.spec.ts`.

## Deliverables

- **D1 — The path guard.**
  Files: `studio/src/bridge/resolve-bridge-path.ts`,
  `studio/src/bridge/resolve-bridge-path.test.ts`.
  Pattern to mirror: `studio/src/content-repo/paths.ts` (`resolveInsideNews`, result-object style,
  never throws).
  Acceptance: every escape shape is refused with a distinct reason — `..` traversal (also
  percent-encoded and double-encoded), absolute POSIX and Windows paths, drive letters, UNC paths,
  NUL bytes, a symlink/junction inside a declared directory pointing outside the repository root, a
  path inside the root but outside every declared directory (`docs/`, `.git/`, `studio/`), and a
  path that resolves to a directory rather than a regular file. A legitimate path inside a declared
  directory resolves. Tests in the named test file; the symlink case is created at runtime.

- **D2 — The bridge server and its routes.**
  Files: `studio/src/bridge/bridge-protocol.ts`, `studio/src/bridge/create-file-bridge.ts`,
  `studio/tests/file-bridge-server.test.ts`.
  Pattern to mirror: `studio/src/mirror-runtime/newsImgMiddleware.ts` (middleware shape, GET/HEAD
  only, stream a file) and `studio/src/content-repo/read-content-repo.ts` (injected `repoRoot`,
  never-throws style).
  Acceptance: driven over HTTP against a fixture root from `studio/tests/fixtures/content-repo/ok`,
  the `read` route returns the story-010 reader's index, documents, drafts and images; the `file`
  route refuses every D1 escape shape with a 4xx and a reason; `?type=` for an undeclared directory
  is refused; `POST`/`PUT`/`PATCH`/`DELETE` answer 405; a non-loopback `Host` header and a
  cross-origin `Origin` answer 403; a `repoRoot`/`root` query parameter is ignored; and
  `git status --porcelain` on a git fixture is byte-identical before and after the whole run. A
  source-level assertion proves no write API is imported under `src/bridge/`.

- **D3 — Dev-server plugin, localhost binding, and the image route.**
  Files: `studio/src/bridge/file-bridge-plugin.ts`, `studio/vite.config.ts`,
  `studio/src/mirror-runtime/newsImgMiddleware.ts` (deleted),
  `studio/tests/file-bridge-dev-server.test.ts`,
  `studio/tests/file-bridge-not-in-production.test.ts`, `studio/e2e/file-bridge.spec.ts`.
  Pattern to mirror: `studio/src/mirror/provenance-plugin.ts` (plugin shape) and
  `studio/tests/dev-server.test.ts` (booting a real Vite server in a test).
  Acceptance: against a booted dev server, `/news-img/<existing image>` returns 200 with an explicit
  image `Content-Type` and `nosniff`, an `.svg` and a traversal request are refused, and story 008's
  `studio/e2e/mirrored-rendering.spec.ts` stays green with `newsImgMiddleware` gone; the server's
  listening address is `127.0.0.1` and `resolvedUrls.network` is empty; the plugin declares
  `apply: 'serve'` and the static import graph of `src/main.tsx` contains no bridge server module
  and no `node:` import.

- **D4 — Browser client and the news read summary.**
  Files: `studio/src/bridge/client.ts`, `studio/src/bridge/client.test.ts`,
  `studio/src/organisms/NewsBridgeSummary.tsx`,
  `studio/src/organisms/NewsBridgeSummary.test.tsx`,
  `studio/src/pages/studio/StudioPage.tsx`, `studio/e2e/file-bridge.spec.ts`.
  Pattern to mirror: story 014's registry `source` port and
  `studio/src/organisms/ContentTypeNav.tsx`; tokens per `/design-tokens` (no raw palette classes),
  layering per `/frontend-guidelines`.
  Acceptance: selecting `news` in the running studio shows, read through the bridge, the index file
  path plus the counts of entries, documents and drafts, and names the reason instead of leaving a
  blank area when the bridge answers with an error. The client imports nothing from `node:`.

## Model Hints

- D1 → `deliverable-hard` — it carries the whole security argument of the story: traversal,
  encoding, symlink/junction escape and the allowlist all meet in one function, and a subtle miss
  there is silently inherited by stories 024, 026, 027 and 030.
- D2 → default.
- D3 → default.
- D4 → default.
- Review: → `story-review-hard` — this is the story that opens filesystem access from a browser
  page, and the regressions that matter (a widened bind, a second unguarded path after
  `newsImgMiddleware` is folded in, a write API slipping into the server) are only visible by
  reading the whole diff against the confinement rules.

## Acceptance Tests

- AC1 → e2e `studio/e2e/file-bridge.spec.ts` › "the studio reads the news directory through the
  bridge" (D4)
- AC2 → unit `studio/src/bridge/resolve-bridge-path.test.ts` › "every path that resolves outside the
  repository root is refused, including symlink escapes" (D1) **and** integration
  `studio/tests/file-bridge-server.test.ts` › "the bridge refuses traversal, absolute paths and a
  symlink escape over HTTP" (D2)
- AC3 → integration `studio/tests/file-bridge-server.test.ts` › "only directories a registered
  descriptor declares are reachable" (D2)
- AC4 → e2e `studio/e2e/file-bridge.spec.ts` › "an image under news/img/ is served to the mirrored
  renderer" (D3) **and** integration `studio/tests/file-bridge-dev-server.test.ts` › "the image
  route serves a raster image with an explicit content type and refuses svg and traversal" (D3)
- AC5 → unit `studio/tests/file-bridge-not-in-production.test.ts` › "the bridge is dev-server only
  and unreachable from the browser entry" (D3) — read per the user's sprint decision: v1 has no
  production bundle, so the proof is that the plugin is `apply: 'serve'` and no bridge server module
  is reachable from `src/main.tsx`
- AC6 → integration `studio/tests/file-bridge-dev-server.test.ts` › "the dev server listens on the
  loopback address only" (D3)
- AC7 → integration `studio/tests/file-bridge-server.test.ts` › "every write method is refused and
  the working tree is unchanged after a full read" (D2)

Coverage gate: AC1 → D4, AC2 → D1 + D2, AC3 → D2, AC4 → D3, AC5 → D3, AC6 → D3, AC7 → D2. Every
criterion has a deliverable and a named automated test; no manual residue.

## Done

<Filled by `/build 015`.>
