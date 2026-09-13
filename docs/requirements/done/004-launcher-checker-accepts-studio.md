---
id: 004
title: The launcher's content-repo checker accepts studio/
status: done # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

The `q2-launcher` repository verifies this one. `scripts/check-content-repo.mjs` checks this
checkout's top-level layout, the byte-identity of `news/` against the launcher's own fixture copy,
a pinned `HEAD` commit and a clean git state. It is a real signal today.

The moment `studio/` lands, that signal turns red and stays red — not because anything is wrong,
but because the checker does not know the directory exists. A check that is permanently red is a
check nobody reads, and the byte-identity guarantee for `news/` is worth keeping.

**This story changes a file in another repository** (`C:\development\Hantsch\q2-launcher`). It is
listed here because the need comes from this project's work and would otherwise be forgotten; where
it is actually implemented is an open question below.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — section 9.

## Acceptance Criteria

- [x] **AC1** — With `studio/` present in this repository, `node scripts/check-content-repo.mjs` in
      the launcher checkout passes.
- [x] **AC2** — The checker treats `studio/` as an expected top-level entry with a stated reason,
      not as an unexplained exception.
- [x] **AC3** — An unexpected new top-level directory still fails the check — the layout assertion
      is loosened for `studio/` only, not removed.
- [x] **AC4** — The existing guarantees are unchanged: `news/` byte-identity against the launcher
      fixture, the reserved-directory READMEs, and the root README's required sections.
- [x] **AC5** — The script still prints one skip line and exits 0 when this checkout does not exist
      on the machine.
- [x] **AC6** — The script remains read-only: it writes nothing in either repository.

## Decisions (Sprint)

- **(User)** Where implemented: handed to the launcher's own backlog, not implemented from this
  sprint. This story's deliverable in `q2_community_content` becomes a written handoff spec (the
  acceptance criteria above, restated as a launcher-side backlog item) rather than a code change in
  `q2-launcher`. The acceptance criteria describe what that future launcher-side change must
  satisfy; none of them are proven by a test in this repository.
- **(User)** `EXPECTED_HEAD` should not remain a pinned commit — it should be replaced with a
  mechanism that does not go stale on every content commit (e.g. checking the top-level layout and
  the `news/` byte-identity directly, without also requiring an exact commit match). This is carried
  into the handoff spec as a requirement, for whoever implements it in `q2-launcher`.
- Reverse drift check (`studio/src/launcher-core/` vs. launcher sources) is noted in the handoff
  spec as a related but separate concern for story 006, not decided here — it is the launcher-side
  implementer's call whether to bundle it with this change.

Decisions taken during refine (not user-answered):

- **The handoff spec lives at `docs/handoffs/q2-launcher-content-repo-checker.md`** — a new
  `docs/handoffs/` folder, because `docs/concepts/` is for this repository's unbuilt systems and
  `docs/systems/` for its built ones, and neither covers a requirement owned by another repository.
- **Discoverability is one bullet under `## Project-specific` in `docs/README.md`** (the only
  section that survives a regeneration of that index) plus a Notes line in
  `docs/sprints/S01/sprint.md`, so the spec is findable from both the docs map and the sprint.
- **The acceptance criteria are restated, not proven, here:** each AC becomes a numbered
  requirement `R1`–`R6` in the spec, and the story's own test asserts the spec carries all of them,
  because no code in this repository can make the launcher's checker green.
- **The test is a documentation test, `studio/tests/launcher-handoff.test.ts`** — story 003 already
  establishes the pattern of asserting documentation claims in Vitest, and story 001 delivers that
  harness before this story runs.
- **Finding carried into the spec: the layout check does not currently reject unknown top-level
  entries** (`checkLayout()` only asserts that five named paths exist: `news/`, `news/img/`, `packs/`, `mods/`,
  `config_templates/`), so AC3 needs a *new*
  allow-list assertion rather than a loosening of an existing one.
- **Finding carried into the spec: what breaks today is the git-state block, not the layout** —
  `EXPECTED_HEAD`, `no local branch besides main` and `no tag exists` are what turn the run red, so
  an implementer who only whitelists `studio/` will not get AC1.
- **The branch and tag assertions are part of the "does not go stale" requirement** alongside
  `EXPECTED_HEAD`, since this repository now works on sprint branches and AC1 cannot hold while a
  single pinned branch name is asserted.
- **No file in `q2-launcher` is touched by this story**, per the user decision above — refine plans
  no code deliverable there, and the spec is written as a backlog item addressed to that repository.

## Open Questions

- ~~Does this land as a story implemented from here, or as an item in the launcher's own
  backlog?~~ answered → Decisions (Sprint)
- ~~Should `EXPECTED_HEAD` remain a pinned commit at all?~~ answered → Decisions (Sprint)
- ~~Should the checker gain the reverse drift check?~~ answered → Decisions (Sprint) (deferred to
  the launcher-side implementer, not decided here)

## Plan

This story ships a document, not a code change. `q2-launcher` is read for evidence only.

1. **Write the handoff spec** — `docs/handoffs/q2-launcher-content-repo-checker.md`: what the
   launcher's `scripts/check-content-repo.mjs` does today, why it goes red once `studio/` lands,
   and requirements `R1`–`R6` restating AC1–AC6 verbatim in substance, plus `R7` for the
   stale-pin replacement (`EXPECTED_HEAD`, and with it the branch/tag assertions). The current
   behaviour section names the two evidence points found in refine: `checkLayout()` asserts only
   presence, never absence of unknown entries (so `R3` is a new assertion); and the failures that
   actually appear are in `checkGitState()`, not the layout.
2. **Make it discoverable** — one bullet under `## Project-specific` in `docs/README.md`, one Notes
   line in `docs/sprints/S01/sprint.md` recording that 004 was handed to the launcher's backlog and
   pointing at the spec.
3. **Prove it** — `studio/tests/launcher-handoff.test.ts` asserts the spec file exists, carries a
   requirement heading for each of `R1`–`R7`, names `scripts/check-content-repo.mjs` and
   `EXPECTED_HEAD`, and is linked from `docs/README.md`.

Nothing outside `docs/handoffs/`, `docs/README.md`, `docs/sprints/S01/sprint.md` and
`studio/tests/` is touched. The published surface is not touched at all.

## Deliverables

- **D1 — The handoff spec (AC1–AC6, restated as requirements).**
  Files: `docs/handoffs/q2-launcher-content-repo-checker.md` (new), plus its test in
  `studio/tests/launcher-handoff.test.ts` (new).
  Content: title and one-paragraph context (why this lives in `q2_community_content` and who
  implements it); "What the checker does today" with the five check groups and the two refine
  findings above; "Requirements" `R1`–`R7`, each a short heading plus one or two sentences —
  `R1`–`R6` are AC1–AC6, `R7` is the stale-pin replacement: verify the layout and the `news/`
  byte-identity directly, drop the exact-commit match and the single-branch/no-tag assertions, and
  state the reason (this repository commits content and works on sprint branches, so any pin is red
  by the next commit); a closing "Out of scope" note that the reverse drift check
  (`studio/src/launcher-core/` vs. launcher sources) is story 006's concern and the implementer's
  call whether to bundle it.
  Acceptance: the file exists, every AC1–AC6 appears as `R1`–`R6` without adding or dropping a
  condition, and `npm run test` passes with the new test asserting `R1`–`R7`,
  `scripts/check-content-repo.mjs` and `EXPECTED_HEAD` are present.

- **D2 — Discoverability from the docs map and the sprint.**
  Files: `docs/README.md` (`## Project-specific` section only), `docs/sprints/S01/sprint.md`
  (`## Notes`), `studio/tests/launcher-handoff.test.ts` (extended).
  Mirror for the bullet style: the existing `research/` bullet under `## Project-specific`.
  Acceptance: `docs/README.md` links `handoffs/q2-launcher-content-repo-checker.md` with a
  one-line description, the sprint note records that 004 is handed to the launcher's backlog and
  points at the spec, and the test asserts the link in `docs/README.md`.

## Model Hints

- D1 → default — writing a document from acceptance criteria that already exist; no regression risk.
- D2 → default — two doc lines and one added assertion.
- Review: → default — a documentation-only diff with no runtime behaviour; the risk is a missing
  requirement, which the test already checks.

## Acceptance Tests

Every criterion below describes the *future* `q2-launcher` change. In this repository they are
proven only as faithfully-restated requirements in the handoff spec; the tests assert that.

- AC1 → unit `studio/tests/launcher-handoff.test.ts` › "the spec requires the checker to pass with
  studio/ present"
- AC2 → unit `studio/tests/launcher-handoff.test.ts` › "the spec requires studio/ to be an expected
  entry with a stated reason"
- AC3 → unit `studio/tests/launcher-handoff.test.ts` › "the spec requires an unexpected top-level
  directory to still fail"
- AC4 → unit `studio/tests/launcher-handoff.test.ts` › "the spec keeps news byte-identity, reserved
  READMEs and root README sections"
- AC5 → unit `studio/tests/launcher-handoff.test.ts` › "the spec keeps the skip line and exit 0
  when the checkout is absent"
- AC6 → unit `studio/tests/launcher-handoff.test.ts` › "the spec keeps the checker read-only"
- Spec completeness → unit `studio/tests/launcher-handoff.test.ts` › "the spec exists, covers R1-R7
  and is linked from the docs index" (covers `R7`, the `EXPECTED_HEAD` replacement, which has no AC
  of its own).
- manual residue: the criteria are only truly green once the launcher-side change lands and
  `node scripts/check-content-repo.mjs` passes in the `q2-launcher` checkout — that run lives in
  another repository, which this story deliberately does not modify.

## Done

Shipped the written handoff spec this story planned instead of a `q2-launcher` code change, per
the Decisions section. `docs/handoffs/q2-launcher-content-repo-checker.md` documents the checker's
five check groups today, the two refine findings (no allow-list in `checkLayout()`; the actual
failures come from `checkGitState()`, not layout), and restates AC1–AC6 as `R1`–`R6` plus `R7` (the
`EXPECTED_HEAD`/branch/tag stale-pin replacement). Made it discoverable via one bullet in
`docs/README.md` under `## Project-specific` and a `## Notes` line plus a ticked checklist entry in
`docs/sprints/S01/sprint.md`. `studio/tests/launcher-handoff.test.ts` asserts the spec carries every
requirement and is linked from the docs index.

Commit message: `004: add q2-launcher content-repo checker handoff spec`

Decisions:
- Requirement text for R1–R7 goes beyond a one-line restatement of each AC, adding the "why"
  (refine findings, sprint-branch reasoning) so the spec is actionable by an implementer who has
  not read this story — this is additive detail, not a changed condition; the reviewer confirmed
  no AC condition was added or dropped.
- The one initially-failing assertion in D1 (docs-index link, owned by D2) was expected and
  resolved once D2 landed; no separate fix cycle was needed.

Verification:
- `npm run build`: green.
- `npm run test`: green, 5 files / 23 tests passed (one lint-driven fix applied after the initial
  green run: an unnecessary `!` type assertion in `launcher-handoff.test.ts:26`, removed; re-ran
  test afterward, still 23/23 green).
- `npm run lint`: green (after the fix above).
- `npm run typecheck`: green.
- `npm run e2e`: not run — this story is documentation-only, maps no criterion to the UI surface,
  and the profile's e2e gate only applies to criteria describing something a user does through the
  studio surface.
- Clean-agent review: PASS. No functional or scope-creep findings; one process-bookkeeping note
  (this Done section / status / file move were still pending at review time) which this step now
  closes.
- AC → test mapping, as verified:
  - AC1 → `launcher-handoff.test.ts` › "the spec requires the checker to pass with studio/
    present" — passed.
  - AC2 → › "the spec requires studio/ to be an expected entry with a stated reason" — passed.
  - AC3 → › "the spec requires an unexpected top-level directory to still fail" — passed.
  - AC4 → › "the spec keeps news byte-identity, reserved READMEs and root README sections" —
    passed.
  - AC5 → › "the spec keeps the skip line and exit 0 when the checkout is absent" — passed.
  - AC6 → › "the spec keeps the checker read-only" — passed.
  - Spec completeness (R7 + docs-index link) → › "the spec exists, covers R1-R7 and is linked
    from the docs index" — passed.
  - manual residue: the ACs are only truly green once the launcher-side change lands and
    `node scripts/check-content-repo.mjs` passes in the `q2-launcher` checkout — that run lives in
    another repository this story deliberately does not modify. Carried forward via the handoff
    spec, not held open here.
- No open points or blockers.
