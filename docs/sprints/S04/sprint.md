---
sprint: S04
status: in-progress # planned | in-progress | done
branch: sprint/S04 # set by /sprint
milestone: M4 — The studio shows the repository
---

# Sprint S04 — Open it and see what is there

## Goal

At the end of this sprint the studio is something you look at rather than something you run. It
opens on a library of the news feed — published, scheduled, expired and draft entries in the order
the launcher will deliver them — with the validation report from S03 next to it.

It is also the sprint that decides whether this stays a news tool: the navigation is built from a
content-type registry, with the repository's other five content areas listed honestly rather than
hidden.

## Stories (in build order)

- [x] 014 — Content-type registry drives the studio
- [ ] 015 — Local file bridge between the browser and the working tree
- [ ] 016 — Library view of the news directory
- [ ] 017 — Validation panel in the studio

## Notes

- 015 is the most security-relevant story in the project: it turns a page into something that can
  read a contributor's filesystem. It stays read-only in this sprint, and its confinement rules are
  what stories 024, 026 and 027 will rely on.
- 015's first open question — how write tests avoid dirtying the real working tree — has to be
  answered here rather than improvised in S06, because the fixture-root override must never be
  reachable in normal use.
- 014 is cheap now and expensive later. Once the shell names `news` directly, adding `packs`
  becomes a refactor rather than a descriptor.
- 017's last criterion ties the surface to the command: the panel and `npm run validate` must agree,
  proven by a test.
