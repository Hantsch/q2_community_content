---
sprint: S01
status: done # planned | in-progress | done
branch: sprint/S01
milestone: M1 — Foundation
---

# Sprint S01 — The studio exists and is verifiable

## Goal

At the end of this sprint, `npm run studio` opens a page in this repository, and every later story
has somewhere to put its tests. The repository gains a toolchain it has never had — typecheck, lint,
unit tests and an end-to-end harness — and `README.md` states the boundary that makes a code
directory legitimate here at all.

Nothing about news content changes. This sprint is the ground the rest stands on.

## Stories (in build order)

- [x] 001 — Studio scaffold with typecheck, lint and unit tests
- [x] 002 — End-to-end harness for the studio surface
- [x] 003 — Repository boundary between published surface and local tooling
- [x] 004 — The launcher's content-repo checker accepts `studio/`

## Notes

- Build order matters here more than usual: 001 creates the verification commands that 002 extends
  and that 003 needs to test a documentation claim at all. `.claude/ai-scrum.md` currently records
  every verify command as `none`, which is why the harness is the first deliverable of the first
  story rather than a later clean-up.
- **004 changes another repository** (`C:\development\Hantsch\q2-launcher`). Its first open question
  is whether it should be implemented from here at all, or handed to the launcher's own backlog.
  That needs an answer in the clarification round, before the story is refined.
- The launcher checker will fail from the moment 001 lands until 004 is done. That is expected, and
  it is the reason 004 is in this sprint rather than a later one.
- 004 was handed to the launcher's own backlog as a written spec rather than implemented as a
  q2-launcher code change from this sprint; see
  `docs/handoffs/q2-launcher-content-repo-checker.md`.
