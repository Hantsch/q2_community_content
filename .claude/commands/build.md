---
description: Implements an approved story (status ready) deliverable by deliverable, verifies it, has it reviewed by a clean agent and fills the Done section.
argument-hint: <id>
model: sonnet
effort: medium
---

<!-- ai-scrum:managed 4.0.0 - plugin-owned, written by /ai-scrum:setup. Do not edit:
     setup diffs this file on update and asks before replacing it. Project facts go in .claude/ai-scrum.md. -->

Implement the story with ID **$1**.

## Project profile

Read `.claude/ai-scrum.md` first — paths, verify commands, acceptance policy,
`changelog-path`, doc language and the files every agent must read before coding all come
from there. If it is missing,
stop and say: run `/ai-scrum:setup` (ai-scrum plugin) first. Below, `<requirements>` means
`requirements-path` from the profile.

## Precondition

Open `<requirements>/$1-*.md`. Status must be **`ready`**.
- `draft` → stop, say "run `/refine $1` first".
- `done` → stop, say "already done".
- Not found → look in `<requirements>/done/$1-*.md`; if it is there, also "already done".

Then check coverage — **both halves**:

- every entry in `## Acceptance Criteria` is covered by at least one deliverable, and
- if `ac-tests-required: true` in the profile, every entry has a line in
  `## Acceptance Tests` naming its test or declaring a `manual residue` with a reason.

If either is missing, **stop** and name the uncovered criterion — that is a refine gap, and
building around it is the most expensive mistake available here: the Ds all go green, the code
review finds the hole at the very end, and the fix cycle costs more than the implementation
agents together. An untested criterion is worse than that, because nothing downstream catches
it: there is no manual acceptance round behind this command. Back to `/refine $1`.

## Delegation rules

You delegate every line of code in this command, so these five decide whether the build
finishes or quietly stops with nothing in the working tree to show for it.

- **Never start a background child.** Put `run_in_background: false` on every `Agent` call you
  make. Completion notifications are delivered to the **top-level session only** — you are a
  subagent, so a background child you start will never wake you again, however long you wait.
- **Never end a turn with "waiting".** A turn without a tool call *ends you*. "Waiting for D2
  and D3 to come back" is not a pause, it is your final answer, and the build stops there. If
  you have nothing left to do, you are not waiting — you are done, so return your report.
- **Parallelism is several foreground calls in ONE message**, never background plus polling.
  Multiple `Agent` calls in a single message run concurrently *and* block until all of them
  have returned. That is the only safe way to overlap deliverables, and it applies only to Ds
  that touch disjoint files — anything sharing a file (an i18n bundle, a barrel export, a
  central test file) stays strictly sequential, or the two agents overwrite each other.
- **A failed agent is not a finished agent.** A report that comes back empty, or says
  "terminated early", or names an API error (`529 Overloaded` and relatives), means nothing
  was delivered. Look at the working tree first — a terminated agent often leaves partial
  edits behind — then re-dispatch that one deliverable once with the same prompt. Only if it
  fails twice is it a blocker.
- **Progress trail — the timestamp is never typed, only produced.** When the caller (`/sprint`)
  names a progress file, every delegation event gets ONE shell command that reads the clock and
  appends the line in the same step. You fill in only story id, deliverable and status:

  ```powershell
  Add-Content -Encoding utf8 <progress-file> ("- " + (Get-Date -Format "yyyy-MM-dd HH:mm") + " · <id> · D<n> <short title> · started")
  ```
  ```bash
  echo "- $(date '+%Y-%m-%d %H:%M') · <id> · D<n> <short title> · started" >> <progress-file>
  ```

  Run it **immediately before** each `Agent` call (`started`) and **immediately after** it
  returns (`done` or `blocked`) — one command per event, at the moment it happens. Never write
  the line with `Edit`/`Write`, never batch several events into one command, never fill the
  timestamp in yourself, not even when you "know" it. Every previous wording of this rule
  ("read the clock, then write the line") produced trails with invented times: hours off, in
  the future, running backwards. A trail like that is worse than none — the user reads it to
  decide whether the build is alive, and a plausible-looking lie tells them nothing. Standalone
  `/build` (no progress file named) skips this rule.

## Flow (scrum-like: small deliverables, acceptance at the end)

1. Set `status: in-progress`.
2. Read `## Plan`, `## Deliverables` and `## Model Hints`.
3. Work the deliverables **in order**, without waiting for approval in between. For each
   `D` you are the orchestrator — the actual implementation is delegated to a fresh `Agent`:
   - **Pick the tier:** default is `model: "sonnet"`, written out on the `Agent` call.
     **Never leave `model` unset.** An unset `model` does not inherit this command's
     frontmatter — it inherits the *session* model, and hands that down to the children of
     your children. A session switched to Opus therefore re-tiers the whole agent tree
     silently, and that is the single largest cost item in this workflow: measured across
     real sprints, the same sprint shape came out at ~$255 per story on an inherited Opus
     tree and ~$63 per story with the default pinned to Sonnet. If the D is marked
     `→ deliverable-hard` in `## Model Hints` (legacy marking: `→ Opus`), use
     `subagent_type: "deliverable-hard"`;
     that agent definition (`.claude/agents/deliverable-hard.md` in this project) carries
     Opus **and** high thinking effort — do not additionally set `model` by hand. If the
     agent cannot be resolved, fall back to a plain `Agent` call with `model: "opus"` and
     `effort: "high"`.

     **Do not escalate on your own:** the hard tier is ~5x more expensive and thinks longer;
     subagents are >90% of the session bill. A D gets `deliverable-hard` **only** when
     `## Model Hints` says so — not by gut feeling, not "to be safe", not because it looks
     complicated. No marking means default tier. If an unmarked D turns out to feel risky
     enough for the hard tier while implementing, that is a plan-gap signal → stop briefly
     and ask the user instead of silently escalating.
   - **Delegate:** if a progress file was named, run the `started` trail command first (see
     the delegation rules — one command, timestamp produced by the shell). Then ONE `Agent`
     call with **`run_in_background: false`** spelled out, and a
     self-contained prompt. Spelling it out is the point: `false` is *not* the default, and a
     background child never wakes you again — see the delegation rules above. The agent
     cannot see this conversation, so give it:
     - the full text of exactly this one deliverable (not the other Ds),
     - the affected files/paths — from the D itself and from `## Plan` — and the file to
       mirror if the D names one, with the instruction to **start from those files instead of
       surveying the repo**: read what is listed, search only for what is genuinely missing.
       Exploration is the biggest cost driver in a build, because an agent's whole context is
       re-read on every turn: a wide search early makes every later turn more expensive. The
       plan already did that search — the agent should not repeat it.
     - **the test lines from `## Acceptance Tests` that belong to this D** (verbatim: level,
       file, test name, and the criterion they prove), with the instruction to write them as
       part of this deliverable — same agent, same turn sequence, not as a follow-up. The test
       asserts the *criterion* as a user would observe it; a test that merely mirrors what the
       implementation happens to do proves nothing and will be rejected in the review. If the
       named test file does not exist yet, it creates it next to the project's existing ones
       and follows their shape.
     - for `deliverable-hard`, the risk justification from `## Model Hints`,
     - the instruction to read and honour `CLAUDE.md` plus every file listed under
       `## Context to read before coding` in `.claude/ai-scrum.md` **before writing code**,
     - that ONLY this deliverable is implemented (no jumping ahead to later Ds),
     - that nothing is committed or pushed,
     - that it returns **at most 10 lines**: changed files with their paths, the verification
       result, and anything genuinely notable — no diffs, no pasted file contents, no
       restatement of the deliverable. Every line it returns lands in your context and is
       paid for again on each of your remaining turns.
   - **Check and continue:** if a progress file was named, run the `done` (or `blocked`) trail
     command now, before anything else. Review the agent's result briefly (file diff, build
     relevance), tick `- [ ] D…` to `- [x]` in the file and start the next D immediately — no
     stop at the user. Tick it **right away, not at the end of the story**: that tick is the only liveness
     signal the user has — they watch the working tree, where a healthy build and a dead one
     look identical except that the ticks keep moving.
     **Keep a note of which files each D actually changed** — the code review in step 6
     gets that mapping, so it does not have to reconstruct it from the diff. Interrupt only on
     a real blocker (plan has gaps, agent fails, ambiguity only the user can resolve).
4. Honour the project rules in `CLAUDE.md` and the profile's context files yourself as well.

## Closing

5. **Verification:**
   - Run the `build`, `test` (and `lint`/`typecheck`, if set) commands from the profile's
     `## Verify` section. Entries set to `none` are skipped. Run `test` when tests exist or
     were touched.
   - **Run `e2e` too, if the profile sets it and this story mapped any criterion to it.**
     That run *is* the acceptance of those criteria — there is no manual round behind it, so a
     skipped or red e2e suite is a blocker, not a note for the user. If the harness cannot run
     here (no display, missing dependency), say exactly that and treat it as a blocker: leave
     `status: in-progress`, name what is missing, and let the sprint report it. Do **not**
     substitute a screenshot, a console call or your own reading of the code for it.
   - **Run each command once.** A green result stays valid until something changes — do not
     re-run a suite "to be sure" while the tree is untouched. The deliverable agents already
     verified their own work; this pass is the story-level gate, not a repeat of theirs.
   - **Then walk `## Acceptance Tests` line by line** and confirm that each named test exists,
     ran, and passed in this verification. A criterion whose test was never written is not
     done — send that D back rather than ticking the criterion. A `manual residue` line needs
     no run; it is carried into the Done section as-is.
   - Report the result honestly — name failing tests, gloss over nothing.
6. **Code review (clean agent):** the review is NOT done by this session — whoever
   implemented does not verify. Delegate to a fresh `Agent` (foreground):
   - **Tier:** from the `Review: → …` line in `## Model Hints`. If it says
     `story-review-hard` (legacy: `Review: → Opus`), use
     `subagent_type: "story-review-hard"` — that definition carries Opus + high effort.
     Otherwise (including when the line is missing) a plain `Agent` call inheriting this
     command's model and effort.
   - **Prompt (self-contained — the agent knows neither this session nor the
     implementation):**
     - path to the story file; `## Acceptance Criteria` + `## Plan` are its spec,
     - the story's diff: `git diff HEAD` plus new untracked files (`git status`) — nothing
       has been committed,
     - the deliverable → changed-files mapping you kept in step 3, so the reviewer goes
       straight to the relevant code instead of rediscovering which D produced what,
     - the story's `## Acceptance Tests` mapping, and the instruction that this is now the
       story's whole acceptance — nobody walks it by hand afterwards,
     - the review assignment:
       (a) each acceptance criterion individually: PASS / FAIL / UNCLEAR with evidence
           (`file:line`),
       (a2) **the test named for each criterion: does it actually prove it?** The reviewer
           opens each one and judges whether a broken implementation would make it fail.
           Report as a finding: a test that asserts nothing meaningful, that re-states the
           implementation instead of the criterion (asserting the value the code happens to
           produce), that mocks away the very thing under test, that is skipped or
           conditionally skipped, or that covers a narrower case than the criterion claims.
           This item exists because whoever implements also wrote the test, and a green
           tautology looks exactly like acceptance from the outside.
       (b) weakened or deleted tests, disabled assertions, suppressed warnings, silenced
           null checks or commented-out validations without a justifying comment on the
           same line,
       (c) scope creep: changes with no visible relation to plan/deliverables,
       (d) correctness bugs, removed validation or error handling, violations of the
           guardrails in `CLAUDE.md`,
     - the agent proposes no fixes and changes no files — it returns a verdict
       (PASS/FAIL/UNCLEAR) + a findings list (`file:line` + one line of reasoning).
   - **Handle findings:** fix confirmed ones, then repeat the verification from step 5;
     document deliberately unfixed findings with a reason in the Done section. Max. 3
     review-fix cycles, then stop and ask the user. Only then continue.
7. **`## Acceptance Tests`**: bring the section in line with what was actually written — the
   real test names and paths, if a deliverable ended up placing one differently. Do not write
   a manual click list here; a human step is only ever a `manual residue` line with its
   reason.
8. **Fill `## Done`:**
   - Short summary (2–5 lines): what was done.
   - Commit message (1–2 lines, keywords are enough — no full sentence needed; story ID
     first, e.g. `042: finish team-based combat`).
   - Verification: build/test/lint/e2e status + review outcome; **the AC → test mapping as
     verified** (which criterion, which test, passed), every `manual residue` with its reason,
     and open points or blockers.
9. Check all `## Acceptance Criteria` and tick the ones that are met.
9b. **If `changelog-path` is set in the profile:** every user-facing feature or fix in this
    story gets an entry there, under `# Features` or `# Fixes` of the **current** version
    section — appended, never restructuring an earlier one. Short, punchy, a little funny, in
    `doc-language`; what the user can now do, not how it was built. Tests, refactors and
    internal changes get no entry, because they change nothing for the user. A story with no
    user-facing change adds nothing at all — an empty entry is worse than none. When
    `changelog-path` is `none`, skip this step entirely.
10. Set `status: done` once verification (step 5) is green and the review (step 6) is through.
    **That is the whole gate** — there is no user acceptance round to wait for, and a story is
    not held open so someone can look at it later. `in-progress` is only for a real blocker:
    red tests you cannot fix, a criterion whose test was never written, an e2e harness that
    cannot run, or review-fix cycles exhausted. Name the blocker in the story file; anything
    a walk-through finds *after* this becomes a new story, not a reopened one.
    Then `git mv` the file to `<requirements>/done/` and append a line to
    `<requirements>/done/INDEX.md`
    (`- NNN — <title> · <sprint or —> · <one-sentence result>`) — move and index line are
    part of the story, not of the user's commit.

## Rules

- **You orchestrate, you do not read.** Resist opening source files yourself: your context is
  re-read in full on every turn, so a file you pull in during D2 is still being paid for at
  the review in step 6. Read the story file, and whatever you need in order to *decide*
  something — the code itself belongs to the agents you delegate to. Catching yourself reading
  a file a second time is the signal that you are doing an agent's job.
- **Do not commit, do not push**, unless the user explicitly asks. `/build` writes
  code + the Done section; the commit is the user's deliberate act, using the prepared
  commit message. (Inside `/sprint` the orchestrator commits — see that command.)
- **No stop after individual deliverables.** The whole story is pulled through in one go;
  the user accepts once at the end based on `## Done`, not after every `D`.
- Never weaken tests to go green. A red test is reported, not silenced. That now cuts both
  ways: the acceptance tests this story writes are the only check the criteria will ever get,
  so a test trimmed until it passes is not a shortcut — it is the story shipping unverified.
- If you notice while implementing that the plan has gaps: stop, say so, back to
  `/refine`.
- **Older story files** may use the previous German headings (`## Akzeptanzkriterien`,
  `## Modell-Hinweise`, `## Testplan (manuelle Abnahme)`, `## Done`) — treat them as
  equivalent and keep the file's existing language. A story refined before
  `## Acceptance Tests` existed has no mapping to check: verify its criteria against the
  tests that exist, note in the Done section that the story predates the mapping, and do not
  retrofit the section.
