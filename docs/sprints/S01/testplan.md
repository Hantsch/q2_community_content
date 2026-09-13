# Sprint S01 testplan — manual residue

`testplan: optional` in `.claude/ai-scrum.md` — this file lists only the criteria this sprint
could not automate. It is not an acceptance gate; the tests already proved everything else (see
`review.md`).

## Story 004 — the launcher's content-repo checker accepts `studio/`

**Reason it cannot be automated here:** AC1–AC6 describe behaviour of
`scripts/check-content-repo.mjs` in the `q2-launcher` repository, which this sprint deliberately
does not edit (per the user's decision to hand the change to the launcher's own backlog — see
story 004's `## Decisions (Sprint)`). No test in `q2_community_content` can make another
repository's script pass.

**Preparation:** in a `q2-launcher` checkout, implement the requirements in
`docs/handoffs/q2-launcher-content-repo-checker.md` (R1–R7): allow-list `studio/` as an expected,
explained top-level entry (R1–R3); keep the `news/` byte-identity, reserved-directory and root
README checks unchanged (R4); keep the "checkout absent → skip line, exit 0" behaviour (R5); keep
the script read-only (R6); replace the pinned `EXPECTED_HEAD` and the single-branch/no-tag
assertions with a mechanism that doesn't go stale on every content commit or sprint branch (R7).

**Steps:**
1. With this repository (including `studio/`, on the sprint branch or later) checked out
   alongside the updated `q2-launcher`, run `node scripts/check-content-repo.mjs` from the
   `q2-launcher` checkout.
2. Confirm the layout check accepts `studio/` without also accepting an arbitrary unexpected
   top-level directory (add one temporarily and confirm it still fails).
3. Confirm the check no longer depends on an exact commit, a specific branch name or the absence
   of tags.

**Expected result:** the script exits 0 against this repository as it stands after Sprint S01,
and still exits non-zero for a genuinely unexpected top-level entry.
