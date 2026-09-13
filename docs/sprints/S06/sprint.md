---
sprint: S06
status: planned # planned | in-progress | done
branch: # set by /sprint
milestone: M6 — Authoring
---

# Sprint S06 — Write it here

## Goal

At the end of this sprint the studio is an editorial desk rather than a viewer: start a post from
the templates kit, fill its fields with the contract's rules enforced while typing, write the body
with the slide updating next to it, add an image, save, order it and publish it.

This is also the sprint in which the studio first writes to the repository. Every story in it is as
much about restraint as about capability — touch what the operation concerns, nothing else, and
leave a diff a human can review before committing.

## Stories (in build order)

- [ ] 022 — Frontmatter editor with live validation
- [ ] 023 — Body editor with live preview
- [ ] 024 — Saving an entry writes the document and its index row
- [ ] 025 — New entry from the templates kit
- [ ] 026 — Adding an image to an entry
- [ ] 027 — Reordering entries and publishing a draft

## Notes

- Six stories is the upper end of a sprint. If it has to be split, 022–024 form the writing half and
  025–027 the managing half; 024 is the natural seam.
- **024 carries a decision that blocks it:** the formatting policy for `index.json`. Reformatting the
  whole file is far simpler and produces a diff nobody can read. This is open point 3 in the concept
  and needs an answer in the clarification round, before refine.
- 023's fifth criterion depends on a fact nobody has established yet: which markdown features the
  launcher actually renders. That list has to come from the launcher's renderer, not an assumption.
- 026's dimension expectations likewise come from the kit READMEs and the real rendering. The story
  deliberately does not let the studio modify an image — it warns, and the author decides.
- No story in this sprint performs a git operation. Publishing means writing a row in `index.json`;
  what leaves the machine stays a deliberate human act.
