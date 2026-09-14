# Sprint S01 review — The studio exists and is verifiable

## Overview

**Goal:** `npm run studio` opens a page in this repository, every later story has somewhere to put
its tests, and `README.md` states the boundary that makes a code directory legitimate here at all.

| Story | Status | Commit |
| --- | --- | --- |
| 001 — Studio scaffold with typecheck, lint and unit tests | done | `899b9de` |
| 002 — End-to-end harness for the studio surface | done | `6c110e2` |
| 003 — Repository boundary between published surface and local tooling | done | `bf6e37f` |
| 004 — The launcher's content-repo checker accepts `studio/` | done | `e8640bc` |

All four stories are done. Nothing is blocked.

## Implemented stories

- **001** — `studio/` now exists as an npm workspace (React 19 + Vite, versions pinned exact to
  match the `q2-launcher` checkout) with real `build`/`test`/`lint`/`typecheck` commands recorded
  in `.claude/ai-scrum.md`, replacing the `none` placeholders. A dev-server test and a
  repository-contract test are the first two real tests in the repository.
- **002** — A Chromium-only Playwright suite (`studio/e2e/`) starts the dev server itself, asserts
  the shell renders through a real browser (not the served HTML), guards every spec against
  reaching anything beyond localhost, and proves a broken studio fails loudly via a nested
  negative-harness run. `.claude/ai-scrum.md` now has a real `e2e` command and
  `ui-acceptance-required: true`.
- **003** — `README.md` and `AGENTS.md` now state the boundary explicitly: the published surface
  (`news/`, `engines/`, `gamedata/`, `packs/`, `mods/`, `config_templates/`) carries no
  presentation, and `studio/` is local tooling the launcher never fetches. The launcher checker's
  `/content only/i` phrase was kept intact while its scope was corrected. `CLAUDE.md` already
  stated the rule and needed no change.
- **004** — Rather than editing the sibling `q2-launcher` repository from this sprint (the user's
  decision in the clarification round), this story produced a handoff spec
  (`docs/handoffs/q2-launcher-content-repo-checker.md`) restating AC1–AC6 as requirements R1–R6 for
  that repository's `scripts/check-content-repo.mjs`, plus R7: replace the pinned `EXPECTED_HEAD`
  (and the single-branch/no-tag assertions) with a mechanism that doesn't go stale on every content
  commit or every sprint branch. Discoverable from `docs/README.md` and this sprint's notes.

## Findings & decisions

Aggregated from `## Decisions (Sprint)` across the four stories, plus review findings — input for
later sprint planning:

- **Sprint branch base was wrong at Phase 0.** The orchestrator initially cut `sprint/S01` from
  `main`, per `.claude/ai-scrum.md`'s then-default `branch-base: main`. The user corrected this:
  sprints in this repository must branch from `feature/studio`, the long-running feature branch
  studio work lives on. Fixed immediately (branch recreated, profile's `branch-base` updated to
  `feature/studio` — commit `69a53f5`). Worth double-checking on every future sprint that the
  profile still matches wherever studio work is currently landing.
- **The launcher's own documentation is stale in three places** (found while refining 003):
  `q2-launcher/content/q2_community_content/README.md` (a hand-copied, non-submodule snapshot
  already missing `packs/`, `mods/`, `config_templates/`), `q2-launcher/docs/concepts/
  home-screen.md` (§6 layout block doesn't list `studio/`), and the done story `085-…` (history,
  correctly left alone). Not fixed here — it's another repository — but worth a launcher-side
  follow-up alongside 004's handoff.
- **The launcher checker's real failure mode, once `studio/` exists, is `checkGitState()`, not the
  layout check** — `checkLayout()` never rejected unknown top-level entries in the first place, so
  a naive "allow `studio/`" fix wouldn't have been enough; `EXPECTED_HEAD`, the single-branch and
  no-tag assertions are what actually turns the check red. Carried into the handoff spec as R3 and
  R7.
- **Exact-version pinning** (React, Vite, TypeScript, Vitest, Playwright, Prettier, Tailwind) to
  match the `q2-launcher` checkout, established in 001 and followed by 002, is now the convention
  for any dependency shared with the mirror (`studio/src/launcher-core/`). ESLint has no launcher
  precedent (the launcher has no ESLint config) and was set up fresh with ranged versions.
- **Test placement convention set in 001**: component tests colocated next to their component;
  repository-contract / documentation-assertion tests live in `studio/tests/`. Followed by 002, 003
  and 004 without deviation.
- Dev machine's default Node (v20.20.2) is below the scaffold's `engines.node: ">=22"` floor;
  verification in 001 ran under Node v26.1.0 via nvm. No `.nvmrc` or CI pin was added — flagged as
  a possible follow-up (see below), not fixed in this sprint.

## Blocked / open

None. All four stories are done.

## Acceptance

Every criterion below was proven by an automated test written as part of its story; see each
story's `## Done` section for the full mapping.

- **001** — AC1–AC7: all proven — `npm run studio`/typecheck/lint/test/`.claude/ai-scrum.md`
  update/`.gitignore`/published-surface-untouched, each with a named Vitest test in
  `studio/tests/repo-contract.test.ts` or `studio/tests/dev-server.test.ts`. No manual residue.
  Note: AC1 ("serves a page") is proven at dev-server level here; story 002 re-proves the same
  claim through a real browser.
- **002** — AC1–AC6: all proven by `studio/e2e/*.spec.ts` and the harness's nested negative run
  (`studio/e2e/harness/negative-run.spec.ts`). No manual residue.
- **003** — AC1–AC6: all proven by `studio/tests/boundary.test.ts` (6 assertions against
  `README.md`, `AGENTS.md` and `CLAUDE.md`). No manual residue.
- **004** — AC1–AC6: proven as faithfully-restated requirements (R1–R6) in the handoff spec, via
  `studio/tests/launcher-handoff.test.ts` — this is the honest ceiling for a story whose criteria
  describe another repository's future change; no code in `q2_community_content` can make
  `q2-launcher`'s checker actually pass. **Manual residue:** the criteria are only truly green once
  the launcher-side change lands and `node scripts/check-content-repo.mjs` passes in the
  `q2-launcher` checkout — see `testplan.md`.

No criterion was covered a level below the real surface where the real surface existed to test
against — `ui-acceptance-required` only became `true` partway through this sprint (by story 002
itself), so nothing in 001–002 needed the e2e gate before it existed.
