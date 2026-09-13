---
sprint: S07
status: planned # planned | in-progress | done
branch: # set by /sprint
milestone: M7 — v1
---

# Sprint S07 — v1

## Goal

At the end of this sprint the studio is something a contributor can be pointed at: a documented path
from a fresh clone to a published post, a guide that makes the second content type cost a fraction
of the first, and one end-to-end run that proves the whole flow works rather than proving each piece
works separately.

This sprint is what turns a working tool into a v1.

## Stories (in build order)

- [ ] 028 — Contributor quickstart for the studio
- [ ] 029 — Guide for adding a content type
- [ ] 030 — v1 acceptance — the full authoring flow

## Notes

- 030 and 028 are deliberately coupled: the acceptance flow walks the sequence the quickstart
  documents, and a criterion in each checks that they have not drifted apart. Refining 028 first
  gives 030 the sequence to walk.
- 030's second criterion is the one that matters most: the run has to exercise the failure this
  project exists to prevent — an entry that would silently fall back, caught before publishing.
- Both documentation stories carry a test, so neither can quietly describe an older version of the
  tool.
- Anything a walk-through finds after this sprint becomes a new story, not a reopened one. The
  concept's open points 1, 5 and 6 (the zero-install variant, manifest validation for
  `engines`/`gamedata`, running fully offline) are the obvious candidates for what comes after v1.
