# Roadmap

As of: 2026-09-29 (S05). One screen: where the project stands, what was done recently, what comes
next. Detail lives where it is produced — sprint reviews, story files, concepts — and this file
links to it. Maintained by `/sprint`, `/concept` and `/roadmap`; the rules are in
`.claude/commands/roadmap.md`.

## Where we stand

- Sprint S05 is done (13 stories, M5-M7): preview at every width, drafts and visibility override,
  authoring (edit, save, new entry, image, reorder, publish), quickstart, extension guide and the
  end-to-end flow — see [S05 review](sprints/S05/review.md).
- Next step: plan a follow-up sprint; candidates are the mirror hash / CRLF fix and concept open
  points 1, 5 and 6.
- Waiting on the user: merging `sprint/S05` into `feature/studio`, and the launcher-side change
  from story 004's handoff spec.

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
| M4 | The studio shows the repository | done 2026-09-14 | [S04 review](sprints/S04/review.md) | Library and validation panel, driven by a content-type registry. |
| M5 | Preview | done 2026-09-29 | [S05 review](sprints/S05/review.md) | The post as the launcher renders it, at 940/1280/1920, drafts included. |
| M6 | Authoring | done 2026-09-29 | [S05 review](sprints/S05/review.md) | Create, edit, illustrate, order and publish — the first writes to the repository. |
| M7 | v1 | done 2026-09-29 | [S05 review](sprints/S05/review.md) | Quickstart, extension guide and the end-to-end flow; its mirror-integrity criterion was dropped. |

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
- Four `launcher-core/` mirror-hash-drift tests (and `check:drift`) fail on Windows CRLF checkouts:
  `launcher-core.lock.json` hashes LF bytes. Cause found in S05 (it blocked story 030's mirror
  guard); worth a story that hashes line-ending-normalised content and/or pins line endings.
  [S05 review](sprints/S05/review.md)
- The `repo-contract` test "profile records the e2e command and requires UI acceptance" fails
  because its `split('## Acceptance')` hits the text `## Acceptance Tests` in a Verify comment of
  `.claude/ai-scrum.md`; anchor it on the heading line. [S05 review](sprints/S05/review.md)
- Older e2e specs select entries by fragile locators (story 027's row buttons broke 11 of them); a
  shared select-entry helper would prevent a repeat. [S05 review](sprints/S05/review.md)
- Small hardening left from S05 reviews: the bridge Origin check accepts any loopback port (024),
  the delete/rename source scan misses aliased imports (026), a cancelled unsaved-changes prompt
  leaves a created entry unselected (025). [S05 review](sprints/S05/review.md)
- The empty-body message says the launcher drops the entry, but it only drops entries with neither
  title nor body (023). [S05 review](sprints/S05/review.md)
- Vite's built-in `/@fs/` dev-server route serves arbitrary repository files unguarded by story
  015's bridge allowlist/Host/Origin checks. Stock Vite behaviour, not a regression story 015
  introduced, but worth closing via `server.fs` hardening if the bridge's confinement guarantee is
  meant to be airtight. [S04 review](sprints/S04/review.md)

## History

No phase completed yet.
