---
sprint: S05
status: done
branch: sprint/S05
milestone: M5 — Preview, M6 — Authoring, M7 — v1
---

# Sprint S05 — From preview to v1

## Goal

At the end of this sprint a contributor can go from a fresh clone to a published news post inside
the studio: see the post as the launcher will render it at every width, write and illustrate it with
the contract enforced while typing, order and publish it — and one end-to-end run proves the whole
flow, including the failure this project exists to prevent (an entry that would silently fall back,
caught before publishing).

This sprint bundles the former S05 (preview), S06 (authoring) and S07 (v1). The stories keep their
original order; it is one linear dependency chain, so nothing in the merge reorders or parallelises
anything.

## Stories (in build order)

Preview (was S05, read-only)

- [x] 018 — Slide preview of the selected entry
- [x] 019 — Preview width switcher
- [x] 020 — Preview a draft without publishing it
- [x] 021 — Preview an entry outside its visibility window

Authoring (was S06, the first writes)

- [x] 022 — Frontmatter editor with live validation
- [x] 023 — Body editor with live preview
- [x] 024 — Saving an entry writes the document and its index row
- [x] 025 — New entry from the templates kit
- [x] 026 — Adding an image to an entry
- [x] 027 — Reordering entries and publishing a draft

v1 (was S07)

- [x] 028 — Contributor quickstart for the studio
- [x] 029 — Guide for adding a content type
- [x] 030 — v1 acceptance — the full authoring flow

## Notes

- 13 stories is well above the usual sprint size. Blocked stories do not stop a sprint, and the
  chain is resumable, but if it has to be split, the seams are after 021 (read-only / writing) and
  after 027 (authoring / v1).
- **Read-only until 024.** Stories 018–023 perform no writes; 024 is the first story that writes to
  the repository. No story performs a git operation — publishing means writing a row in
  `index.json`; what leaves the machine stays a deliberate human act.
- **024 carries a blocking decision:** the formatting policy for `index.json`. Reformatting the whole
  file is far simpler and produces a diff nobody can read (concept open point 3). It is asked in the
  clarification round, before refine.
- 018 previews the **delivered** form, never the declared one. A `cover` with a missing image must
  preview as the `text` slide it will actually be. The iframe isolation is structural: it keeps
  studio chrome out of the rendering and makes 019's width switch a real viewport.
- 021: a simple visibility toggle, or a "preview as of <date>" clock. The clock answers what the
  whole feed looks like on release day, and costs more.
- 023's fifth criterion depends on which markdown features the launcher actually renders — that list
  must come from the launcher's renderer, not an assumption. 026's dimension expectations come from
  the kit READMEs and real rendering; the studio warns, it never modifies an image.
- 030 and 028 are coupled: the acceptance flow walks the sequence the quickstart documents, and a
  criterion in each checks they have not drifted. Refine 028 before 030. Both documentation stories
  carry a test.
- Anything a walk-through finds after this sprint becomes a new story. Concept open points 1, 5 and
  6 (zero-install variant, `engines`/`gamedata` manifest validation, fully offline) are the obvious
  candidates after v1.

## Regression gate

Run on `38cf6ea` (the last story commit) after all 13 stories.

| Command | Minutes | Result |
| --- | --- | --- |
| `npm run build` | ~0 | green |
| `npm run test` | ~0.1 | 546 passed, 6 failed (all pre-existing, see below) |
| `npm run e2e` | ~1.4 | 55 of 109 failed, fixed in `ffbcedd`; 109/109 green afterwards |

`e2e-all` is `none`. `npm run lint` fails on prettier for ~165 untouched files (CRLF), pre-existing
across the whole sprint.

| Failure | Verdict | Outcome |
| --- | --- | --- |
| drift-provenance, launcher-core-unmodified, mirror-set, mirrorDrift (`check:drift`) | pre-existing: `launcher-core.lock.json` hashes vs. CRLF checkout; fails at the merge-base too | left; story proposal in the review |
| repo-contract "profile records the e2e command and requires UI acceptance" | pre-existing, fails at the merge-base. The profile line is fine; the test's `split('## Acceptance')` matches the text `## Acceptance Tests` in a Verify comment first | left; noted in the review |
| repo-contract AC6 (gitignore) | flaky: timed out at 5 s once, passed on rerun | none |
| e2e, 55 specs: entry-select queries matched 2 buttons | story 027 (`f60ff13`) added Publish/Unpublish/thumbnail buttons inside each entry row | fixed in `ffbcedd`: locators tightened in 11 specs with `.filter({ hasNotText: /^(Un)?publish$/i })`, no assertion touched |
| boundary "news contract is unchanged" and repo-contract AC7 | story 028 (`a3b6ac3`) edited `news/_templates/README.md` | fixed in `752c5b2`: file restored to the merge-base, 028 AC4 reworded (root README links the quickstart, the quickstart links the templates README) |
