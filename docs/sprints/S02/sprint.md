---
sprint: S02
status: in-progress # planned | in-progress | done
branch: sprint/S02
milestone: M2 — The launcher mirror
---

# Sprint S02 — The launcher's contract and rendering live here, verifiably

## Goal

At the end of this sprint, the launcher's news contract and its slide rendering run inside this
repository, copied verbatim, with a lock file that says which launcher commit they came from and a
check that fails when they drift apart.

This is the sprint that makes every later claim honest. After it, "the launcher will drop this
entry" and "this is what it will look like" are statements produced by the launcher's own code
rather than by something that agrees with it today.

## Stories (in build order)

- [ ] 005 — Sync command and lock file for the launcher mirror
- [ ] 006 — Drift check for the launcher mirror
- [ ] 007 — The mirrored news contract runs unmodified in the studio
- [ ] 008 — The mirrored slide rendering runs unmodified in the studio
- [ ] 009 — Mirror provenance is reported, not buried

## Notes

- The mirrored set is roughly 1200 lines: `src/shared/modules/home.ts`, `feed-pipeline.ts` and
  `frontmatter.ts` for the contract; the four slide components, `SlideButtons.tsx`,
  `resolveSlideTemplate.ts`, `home-hero.css` and its design tokens for the rendering. One runtime
  dependency, `zod`.
- 005 and 006 share an unresolved question — where the launcher path comes from — and should be
  clarified together rather than one deciding for the other.
- 007's fourth criterion is the one worth defending under time pressure: no contract rule may exist
  outside `studio/src/launcher-core/`. A re-implementation that agrees today is the failure mode
  this entire sprint is built to prevent.
- Nothing in this sprint is user-visible. The first thing anyone can look at arrives in S04.
