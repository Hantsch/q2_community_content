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
