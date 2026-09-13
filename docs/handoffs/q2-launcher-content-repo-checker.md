# Handoff: `q2-launcher`'s content-repo checker must accept `studio/`

This spec lives in `q2_community_content` because it is the repository whose layout the
checker inspects, and because the finding that the checker is now broken surfaced here, while
this repository's contributors have no write access to `q2-launcher`. It is implemented by
whoever next touches `q2-launcher/scripts/check-content-repo.mjs` — most likely as part of
`q2-launcher` story work, not a `q2_community_content` deliverable. Nothing here changes
`q2_community_content` itself; this document is the full deliverable.

## What the checker does today

`scripts/check-content-repo.mjs` (in the `q2-launcher` checkout) runs five check groups
against a sibling checkout of this repository at
`C:\development\Hantsch\q2_community_content`, skipping entirely (print + exit 0) if that
checkout does not exist on the machine:

1. **`checkLayout()`** — asserts presence of five named top-level paths (`news`, `news/img`,
   `packs`, `mods`, `config_templates`). It never rejects an unrecognized new top-level entry —
   there is no allow-list, only a presence check.
2. **`checkReservedReadmes()`** — `packs/README.md`, `mods/README.md`,
   `config_templates/README.md` must each mention "reserved" and "not read".
3. **`checkRootReadme()`** — the root `README.md` must exist and contain the required
   substrings: `engines/`, `gamedata/`, the `index.json` field names (`schemaVersion`,
   `entries`, `id`, `file`, `order`, `visibleFrom`, `visibleUntil`), the template names
   (`split`, `banner`, `text`), the button rule (max of 3, `github.com`,
   `raw.githubusercontent.com`), the order/ascending behaviour, the "content only" rule, and
   the "dropped" rule.
4. **`checkNewsByteIdentity()`** — recursively compares every file under `q2-launcher`'s own
   fixture copy of `news/` (`content/q2_community_content/news`) against this checkout's
   `news/` by sha256 hash; any file present on only one side, or differing in content, fails.
5. **`checkGitState()`** — four assertions against the checkout's git state: `git rev-parse
   HEAD` must equal a single pinned `EXPECTED_HEAD` commit hash; `git status --porcelain` must
   show only untracked (`??`) lines; `git branch` must list exactly one local branch named
   `main`; `git tag` must list zero tags.

**Refine findings** (established before this spec was written, restated here as-is):

- `checkLayout()` only asserts presence of the five named paths; it never rejects an
  unrecognized new top-level directory. Rejecting an unexpected new top-level directory (AC3)
  therefore requires a *new* allow-list assertion — there is no existing check to loosen.
- What actually turns the run red today is `checkGitState()` — the pinned `EXPECTED_HEAD`, the
  single-branch-named-`main` assertion, and the no-tag assertion — not the layout check. An
  implementer who only whitelists `studio/` in the layout will still fail AC1, because sprint
  branches and new commits still fail the git-state block.
- The branch/tag/exact-commit assertions are all facets of the same "stale pin" problem: this
  repository now commits content routinely and works on sprint branches (e.g. `sprint/S01`), so
  a single pinned commit hash, a single allowed branch name, or a no-tag assertion all go red on
  the very next commit or branch. Replacing `EXPECTED_HEAD` and the branch/tag assertions with
  direct layout and news byte-identity verification fixes this permanently, instead of needing a
  new pin every time.

## Requirements

### R1 — The checker passes with `studio/` present

With `studio/` present in `q2_community_content`, running
`node scripts/check-content-repo.mjs` from the `q2-launcher` checkout must pass (exit 0). Today
it fails, both because the git-state block goes stale on any new commit/branch (see R7) and
because nothing yet declares `studio/` an expected entry.

### R2 — `studio/` is an expected entry, with a stated reason

The layout check must treat `studio/` as an expected top-level entry, not silently ignore it or
special-case it without explanation. The stated reason should be recorded next to the check
(comment or equivalent): `studio/` is this repository's local authoring/validation tooling,
never fetched by the launcher, so its presence is expected rather than an anomaly.

### R3 — An unexpected new top-level directory still fails

Because `checkLayout()` has no allow-list today — only presence checks for five named paths —
accepting `studio/` must be implemented as a *new* allow-list assertion covering the full set of
expected top-level entries (the five existing ones plus `studio/`), not as removing or loosening
the existing presence checks. Any other unrecognized new top-level directory must still fail the
check.

### R4 — Existing guarantees are unchanged

`checkNewsByteIdentity()` (news/ byte-identity against the launcher's fixture copy),
`checkReservedReadmes()` (the reserved-directory READMEs), and `checkRootReadme()` (the root
README's required sections) remain unchanged. This work only adds the `studio/` layout
allowance (R2/R3) and replaces the stale git-state pin (R7); it does not touch these three
check groups.

### R5 — Skip line and exit 0 when the checkout is absent

`main()`'s existing behavior is unchanged: if `CHECKOUT_ROOT` does not exist on the machine
running the script, it prints exactly one skip line and exits 0 before running any check group.
This keeps the script a never-a-CI-gate, run-by-hand tool.

### R6 — The checker remains read-only

No file under `content/q2_community_content/**` (the `q2-launcher`-side fixture) or under the
external checkout is ever written by the script. The only git subcommands run against the
checkout stay read-only (e.g. `rev-parse`, `status`, `branch`, `tag`, or their replacements
under R7) — no `checkout`, `reset`, `commit`, or similar mutating command is introduced.

### R7 — Replace the stale git-state pin with direct verification

`checkGitState()`'s three stale-pin assertions — the exact `EXPECTED_HEAD` commit match, the
single-branch-named-`main` requirement, and the no-tag requirement — must be dropped. In their
place, the checker verifies the checkout directly: the layout allow-list (R2/R3) and the `news/`
byte-identity comparison (R4, unchanged) are sufficient evidence that the checkout is in the
expected shape, without needing to pin an exact commit, branch name, or tag state. The reason:
`q2_community_content` now commits content routinely and works on sprint branches (e.g.
`sprint/S01`), so any pinned commit hash, single-branch assumption, or no-tag assumption goes
red on the very next commit or branch created in the normal course of work — this is not a
one-off staleness to re-pin but a structural mismatch between the checker's assumptions and how
this repository is actually used.

## Out of scope

The reverse drift check — verifying `studio/src/launcher-core/` still matches its source in
`q2-launcher` — is story 006's concern, not this checker's. Whether to bundle that check into
`check-content-repo.mjs` alongside the changes above, or keep it as a separate script, is the
implementer's call when story 006 is picked up.
