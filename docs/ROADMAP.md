# Roadmap

As of: 2026-09-14 (S03). One screen: where the project stands, what was done recently, what comes
next. Detail lives where it is produced — sprint reviews, story files, concepts — and this file
links to it. Maintained by `/sprint`, `/concept` and `/roadmap`; the rules are in
`.claude/commands/roadmap.md`.

## Where we stand

- Sprint S03 is done: `npm run validate` (text or `--json`, `--strict`) states, per entry, what
  was declared and what the launcher will deliver, plus repository-wide findings (duplicate ids,
  drafts, orphaned images, unsafe names) — see [S03 review](sprints/S03/review.md).
- The mirror now also covers the launcher's file-safe-name rule (mirrored into
  `studio/src/launcher-core/`, re-exported through `studio/src/contract/launcher-safe-names.ts`),
  alongside the news contract and slide rendering from S02.
- Next step: `/sprint S04` — the studio shows the repository (library and validation panel).
- Waiting on the user: the launcher-side change from story 004's handoff spec, the
  `index.json` formatting policy that blocks story 024, and merging `sprint/S03` into
  `feature/studio`.

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
| M3 | Validation | done 2026-09-14 | [S03 review](sprints/S03/review.md) | `npm run validate`'s repository-findings count stays 0 until a follow-up wires story 013's findings into the CLI. |
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
  repeatedly on unrelated pre-existing files — every S02 and S03 story had to re-confirm the noise
  wasn't theirs. A `.gitattributes` line-ending policy would fix it once instead of per-story.
  [S02 review](sprints/S02/review.md)
- Wire story 013's `collectRepositoryFindings()` output into `npm run validate` (`studio/src/validate/`)
  so its `repositoryFindings` count reflects real data instead of always `0`. [S03 review](sprints/S03/review.md)
- Four `launcher-core/` mirror-hash-drift tests fail on this Windows checkout independently of any
  story's changes (confirmed on the base branch via `git stash` in every S03 story) — worth a
  one-time investigation into whether it's a line-ending or hashing issue specific to this checkout.
  [S03 review](sprints/S03/review.md)

## History

No phase completed yet.
