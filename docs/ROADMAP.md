# Roadmap

As of: 2026-09-13. One screen: where the project stands, what was done recently, what comes
next. Detail lives where it is produced — sprint reviews, story files, concepts — and this file
links to it. Maintained by `/sprint`, `/concept` and `/roadmap`; the rules are in
`.claude/commands/roadmap.md`.

## Where we stand

- Sprint S01 is done: `studio/` exists as a real npm workspace with typecheck, lint, unit-test and
  Playwright e2e commands, and `README.md`/`AGENTS.md` state the published-surface-vs-tooling
  boundary. Every verify command in `.claude/ai-scrum.md` is now real; `e2e` is a Chromium-only
  Playwright suite.
- Story 004 was handed to the `q2-launcher` repository's own backlog rather than implemented here;
  its handoff spec is at [docs/handoffs/q2-launcher-content-repo-checker.md](handoffs/
  q2-launcher-content-repo-checker.md) — see `sprints/S01/testplan.md` for the one manual-residue
  check once that lands.
- Next step: `/sprint S02` — the launcher mirror (contract and rendering copied verbatim,
  hash-locked and drift-checked).
- Waiting on the user: the launcher-side change from story 004's handoff spec, and the
  `index.json` formatting policy that blocks story 024.

## Phase overview

| Phase | Goal | Milestones | Status |
| --- | --- | --- | --- |
| 1 — Content Studio v1 | A contributor can write, preview, validate and publish a news post locally, without a launcher checkout | 0/7 | planned |

## Current phase: 1 — Content Studio v1

Concept: [Q2 Content Studio](concepts/content-studio.md).

| M | Milestone | Status | Sprints | Note |
| --- | --- | --- | --- | --- |
| M1 | Foundation | done 2026-09-13 | [S01 review](sprints/S01/review.md) | Story 004 handed to `q2-launcher`'s backlog as a handoff spec, not implemented here. |
| M2 | The launcher mirror | planned | [S02](sprints/S02/sprint.md) | Contract and rendering copied verbatim from the launcher, hash-locked and drift-checked. |
| M3 | Validation | planned | [S03](sprints/S03/sprint.md) | `npm run validate` states what the launcher will really do with each entry. |
| M4 | The studio shows the repository | planned | [S04](sprints/S04/sprint.md) | Library and validation panel, driven by a content-type registry. |
| M5 | Preview | planned | [S05](sprints/S05/sprint.md) | The post as the launcher renders it, at 940/1280/1920, drafts included. |
| M6 | Authoring | planned | [S06](sprints/S06/sprint.md) | Create, edit, illustrate, order and publish — the first writes to the repository. |
| M7 | v1 | planned | [S07](sprints/S07/sprint.md) | Quickstart, extension guide and one end-to-end proof of the whole flow. |

## Open / unprioritised

Ideas and concepts that need a decision before they become work. One line each.

| Topic | State | Next step |
| --- | --- | --- |
| `packs/`, `mods/`, `config_templates/` content formats | reserved, no contract sketched yet; the studio's registry is shaped to take them | `/concept` |
| Zero-install studio variant (File System Access API) | concept open point 1, deferred out of v1 | decide after v1 |
| Validation of `engines/`/`gamedata/` manifests | concept open point 5, read-only validation would be cheap | `/concept` |
| Studio running fully offline (font bundling and its licence check) | concept open point 6 | resolve in story 008 |

## Follow-ups worth doing

- Pin a Node version for the studio toolchain (`.nvmrc` or CI floor) — the default on the dev
  machine (v20.20.2) is below `engines.node: ">=22"`. [S01 review](sprints/S01/review.md)
- The launcher's own docs are stale in three places (a hand-copied README snapshot, the
  `home-screen.md` layout block, both missing `studio/`) — worth a launcher-side fix alongside
  story 004's handoff. [S01 review](sprints/S01/review.md)

## History

No phase completed yet.
