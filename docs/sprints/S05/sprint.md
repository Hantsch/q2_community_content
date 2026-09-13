---
sprint: S05
status: planned # planned | in-progress | done
branch: # set by /sprint
milestone: M5 — Preview
---

# Sprint S05 — See the post before anyone else does

## Goal

At the end of this sprint the original problem is solved: a news post can be looked at, as the
launcher will render it, at every width the launcher runs at, while it is still being written — and
without publishing anything to see it.

The three stories after the preview itself each remove one reason an author would otherwise still
have to publish first: a draft has no index row, a scheduled post is not visible yet, and neither of
those should be a reason to guess.

## Stories (in build order)

- [ ] 018 — Slide preview of the selected entry
- [ ] 019 — Preview width switcher
- [ ] 020 — Preview a draft without publishing it
- [ ] 021 — Preview an entry outside its visibility window

## Notes

- 018 previews the **delivered** form, never the declared one. A `cover` with a missing image must
  preview as the `text` slide it will actually be; a preview that flatters the author is worse than
  no preview.
- The isolation criterion in 018 is structural, not cosmetic: the iframe is what keeps studio chrome
  out of the rendering and what makes 019's width switch a real viewport rather than a scaled
  picture.
- 021 raises a question worth deciding deliberately: a simple visibility toggle, or a "preview as of
  &lt;date&gt;" clock. The clock answers a question the toggle cannot — what the whole feed looks
  like on release day — and costs more.
- Still no writes. The repository is read-only through the end of this sprint.
