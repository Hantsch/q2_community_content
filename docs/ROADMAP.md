# Roadmap

As of: 2026-09-13. One screen: where the project stands, what was done recently, what comes
next. Detail lives where it is produced — sprint reviews, story files, concepts — and this file
links to it. Maintained by `/sprint`, `/concept` and `/roadmap`; the rules are in
`.claude/commands/roadmap.md`.

## Where we stand

- AI Scrum and the tech-rules house rules are installed; no sprint has run yet.
- The [Content Studio concept](concepts/content-studio.md) is drafted (6 open points) and v1 is cut
  into 7 sprints / 30 stories (S01–S07, 001–030), all `draft`.
- This repository still has no toolchain: every verify command in `.claude/ai-scrum.md` is `none`
  until story 001 lands, which is why the harness is that story's first deliverable.
- Next step: `/sprint S01`, starting with the clarification round on 001 (where the package manifest
  lives) and 004 (whether the cross-repo change is implemented from here).
- Waiting on the user: the launcher-side change in story 004, and the `index.json` formatting policy
  that blocks story 024.

## Phase overview

| Phase | Goal | Milestones | Status |
| --- | --- | --- | --- |
| 1 — Content Studio v1 | A contributor can write, preview, validate and publish a news post locally, without a launcher checkout | 0/7 | planned |

## Current phase: 1 — Content Studio v1

Concept: [Q2 Content Studio](concepts/content-studio.md).

| M | Milestone | Status | Sprints | Note |
| --- | --- | --- | --- | --- |
| M1 | Foundation | planned | [S01](sprints/S01/sprint.md) | The studio starts and the repository gains its first verification harness. |
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

Nothing yet — sprint reviews fill this section.

## History

No phase completed yet.
