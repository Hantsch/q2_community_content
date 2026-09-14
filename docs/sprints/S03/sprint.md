---
sprint: S03
status: in-progress # planned | in-progress | done
branch: sprint/S03
milestone: M3 — Validation
---

# Sprint S03 — The launcher's silent behaviour, stated out loud

## Goal

At the end of this sprint, `npm run validate` answers the question this project started from: is
anything in `news/` going to behave differently than I wrote it? Every entry gets a verdict — what
you declared, what the launcher will deliver, and which rule made the difference — plus the findings
that only looking at the whole directory can produce.

No window, no UI. If the verdicts are right here, the surface in S04 and S05 is presentation of
something already true.

## Stories (in build order)

- [x] 010 — Reader for the content repository's working tree
- [x] 011 — The declared-versus-delivered report
- [ ] 012 — Headless validate command
- [ ] 013 — Repository-level findings across the news directory

## Notes

- 011 is the heart of the project and the story most worth refining carefully. Its last criterion
  sets the discipline: the report classifies and explains, it never decides — every verdict comes
  from the mirrored pipeline's own output.
- The reader in 010 deals with something the launcher never sees: a half-edited working tree with
  drafts, a broken `index.json`, and files the index does not mention. That difference is the story,
  not the file I/O.
- The severity model is open in 011 and affects 012's exit code and 017's display. Worth settling
  once, in this sprint's clarification round.
- Everything here is read-only. The first write to the repository happens in S06.
