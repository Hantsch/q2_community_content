# Story history

One line per finished story, appended by `/build` when it moves the file here.
Format: `- NNN — <title> · <sprint or —> · <one-sentence result>`.

The full texts live next to this file. This index is the fast overview — do not turn it into a
second roadmap.

- 001 — Studio scaffold with typecheck, lint and unit tests · S01 · Delivered the `studio/` npm
  workspace (Vite + React shell, TypeScript, ESLint/Prettier, Vitest) and wired the real
  build/test/lint/typecheck commands into `.claude/ai-scrum.md`.
- 002 — End-to-end harness for the studio surface · S01 · Added a Playwright (chromium-only) e2e
  harness with a localhost-only guard and a nested negative-run proof, and flipped
  `.claude/ai-scrum.md` to `e2e: npm run e2e` / `ui-acceptance-required: true`.
- 003 — Repository boundary between published surface and local tooling · S01 · Re-scoped
  `README.md` and added an `AGENTS.md` section to distinguish the published surface from
  `studio/` as local tooling, with a new `studio/tests/boundary.test.ts` guarding the wording.
- 004 — The launcher's content-repo checker accepts `studio/` · S01 · Wrote a handoff spec
  (`docs/handoffs/q2-launcher-content-repo-checker.md`, R1–R7) for `q2-launcher`'s own backlog
  instead of changing that repository, restating AC1–AC6 and the `EXPECTED_HEAD` stale-pin
  replacement, proven here by `studio/tests/launcher-handoff.test.ts`.
- 005 — Sync command and lock file for the launcher mirror · S02 · Added `npm run sync:launcher
  -- --launcher <path>` (manifest, preflight, deterministic lock with `syncedAt` carry-over) that
  copies the 11 declared launcher-core files byte-identically into `studio/src/launcher-core/`,
  fails closed on any preflight problem, and is idempotent on rerun; proven by real-CLI
  integration tests against throwaway git fixtures.
- 006 — Drift check for the launcher mirror · S02 · Added `npm run check:drift -- --launcher
  <path>` (`studio/scripts/drift.ts` core + `check-drift.ts` CLI) that re-hashes the mirror against
  its lock, three-way-classifies each file as clean/locally-edited/stale against a real launcher
  checkout when given one, skips that comparison with one explanatory line otherwise, stays
  read-only in both repositories, and prints a kind-specific remedy on failure; proven by real-CLI
  integration tests against synthetic git fixtures.
- 007 — The mirrored news contract runs unmodified in the studio · S02 · Wired the studio
  toolchain (zod pin, `@shared/*` alias) and a single boundary module
  (`studio/src/contract/launcher-contract.ts`) so `buildFeed` from `studio/src/launcher-core/`
  runs unmodified over the repo's real `news/` tree and over drop/fallback fixtures, guarded by an
  eslint zone plus a scanning test proving no contract rule is re-implemented anywhere else;
  `npm run check:drift` stays green.
- 008 — The mirrored slide rendering runs unmodified in the studio · S02 · Mirrored the four slide
  templates, `SlideButtons`' import closure and the whole `renderer/src/styles/` entry graph into
  `studio/src/launcher-core/`, added a Vite/Vitest boundary plugin that substitutes a thin stub for
  the mirror's one non-mirrored import (`../client`), and proved the templates render with real
  classes, real tokens, bundled fonts and a real repository image on a standalone
  `studio/mirror-check.html` page, in jsdom unit tests and in a real Chromium `npm run e2e` run;
  `npm run check:drift` stays green.
- 009 — Mirror provenance is reported, not buried · S02 · Added `studio/src/mirror/provenance.ts`
  (verdict vocabulary, `describeMirror`, `formatProvenance`) and `read-provenance.ts` (reads the
  lock, hashes the mirror, never throws); `npm run check:drift` now prints the launcher commit and
  verdict as its header, and the studio surface gets the same data build-time via the
  `virtual:mirror-provenance` Vite module. Data-only per the sprint's Decisions — a rendered UI
  binding lands in M4/S04.
- 010 — Reader for the content repository's working tree · S03 · Added a read-only, never-throwing reader for news/ (index, documents, drafts, image listing, _templates on request) with a shared finding vocabulary and a proven no-write guarantee.
- 011 — The declared-versus-delivered report · S03 · Built a pure library (`studio/src/report/`) that turns the mirrored news pipeline's own output into a per-entry declared-vs-delivered verdict (template, buttons, visibility, order) with a source-tagged finding for every difference, so the contract's forgiving fallback/drop rules are stated out loud before publishing.
- 012 — Headless validate command · S03 · Added `npm run validate` (text and `--json`), wiring story 010's reader and story 011's report into a headless, read-only CLI that exits non-zero on a dropped entry and prints entries-delivered/falling-back/dropped/repository-finding counts.
- 013 — Repository-level findings across the news directory · S03 · Added `studio/src/report/repository-findings.ts` (duplicate ids, order collisions via the mirrored pipeline's delivered order, drafts, unreferenced images, missing documents, frontmatter/index order mismatches, unsafe names) and a second mirror door (`studio/src/contract/launcher-safe-names.ts`) exposing the launcher's own safe-name predicates; wiring the real findings into `npm run validate`'s count is a named follow-up gap.
- 014 — Content-type registry drives the studio · S04 · Added `studio/src/content-types/` (descriptor type, registry factory, the six descriptors) and wired `StudioPage` to `ContentTypeNav`/`ContentTypeStateNotice` so navigation and per-state views come from the registry, not from shell code; also fixed a Node-builtin browser-crash bug in the mirror's import graph, first exposed by this story, via an extended `launcherBoundary.ts` stub-redirect plugin.
- 015 — Local file bridge between the browser and the working tree · S04 · Added `studio/src/bridge/` (realpath-based path guard, a method/Host/Origin-guarded connect middleware for `/__studio/fs/read`, `/__studio/fs/file` and the folded-in `/news-img/` image route, a Vite dev-server-only plugin pinning `server.host: 127.0.0.1`, and a browser `ContentTypeSource` client) so the studio reads `news/` through a narrow, read-only, localhost-only bridge instead of a browser-side reader; a hard-tier security review found and fixed 6 confirmed issues (unimplemented content types silently returning `news` data, image-route confinement widened to all of `news/` instead of `news/img/`, and a default-allow on a missing `Host` header among them).
- 016 — Library view of the news directory · S04 · Added `studio/src/library/` (pure model fusing delivered/visibility/draft status), `EntryStatusBadge`, the `LibraryEntryRow`/`LibraryStateNotice`/`LibraryView` organisms, the `useNewsLibrary` hook and `current-entry-context`, wiring `StudioPage` to show the feed as the launcher will deliver it — published order, drafts, scheduled/expired dates, drop reasons, template mismatches and thumbnails, plus distinct empty/unreadable states — replacing story 015's interim `NewsBridgeSummary`.
