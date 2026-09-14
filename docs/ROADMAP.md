# Roadmap

As of: 2026-09-14. One screen: where the project stands, what was done recently, what comes
next. Detail lives where it is produced — sprint reviews, story files, concepts — and this file
links to it. Maintained by `/sprint`, `/concept` and `/roadmap`; the rules are in
`.claude/commands/roadmap.md`.

## Where we stand

- Sprint S02 is done: the launcher's news contract and slide rendering run inside this repository,
  copied verbatim via `npm run sync:launcher`, hash-locked in `studio/launcher-core.lock.json`,
  and checked for drift via `npm run check:drift` — see [S02 review](sprints/S02/review.md).
- The mirror's provenance (launcher commit, sync date, drift verdict) is reported by the drift CLI
  and exposed to the studio as structured data; a rendered provenance UI is still open, planned
  for M4/S04.
- Next step: `/sprint S03` — validation (`npm run validate` states what the launcher will really
  do with each entry).
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
| M2 | The launcher mirror | done 2026-09-14 | [S02 review](sprints/S02/review.md) | Provenance UI still open, planned for M4/S04. |
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

## Follow-ups worth doing

- Pin a Node version for the studio toolchain (`.nvmrc` or CI floor) — the default on the dev
  machine (v20.20.2) is below `engines.node: ">=22"`. [S01 review](sprints/S01/review.md)
- The launcher's own docs are stale in three places (a hand-copied README snapshot, the
  `home-screen.md` layout block, both missing `studio/`) — worth a launcher-side fix alongside
  story 004's handoff. [S01 review](sprints/S01/review.md)
- This checkout's `core.autocrlf=true` with no `.gitattributes` makes `prettier --check` fail
  repeatedly on unrelated pre-existing files — every S02 story had to re-confirm the noise wasn't
  theirs. A `.gitattributes` line-ending policy would fix it once instead of per-story.
  [S02 review](sprints/S02/review.md)

## History

No phase completed yet.
