---
description: Refines a story (requirements/NNN-*.md) and writes plan + deliverables straight into the file.
argument-hint: <id>
model: opus
effort: high
---

<!-- ai-scrum:managed 4.4.0 - plugin-owned, written by /ai-scrum:setup. Do not edit:
     setup diffs this file on update and asks before replacing it. Project facts go in .claude/ai-scrum.md. -->

Refine the story with ID **$1**.

## Project profile

Read `.claude/ai-scrum.md` first — it holds this project's paths, verify commands,
acceptance policy, doc language and the files every agent must read before coding.
If it is missing, stop and say: run `/ai-scrum:setup` (ai-scrum plugin) first.

Below, `<requirements>` means `requirements-path` from the profile.

## Never use plan mode

The plan goes **into the story file**, not into an external `.claude/plans/` file and not
into memory. Everything has to be reviewable in the repository.

## Steps

1. **Load:** open `<requirements>/$1-*.md` (finished stories live in
   `<requirements>/done/` — if you only find the ID there, say "already done" and stop).
   Also read linked `[[...]]` stories and referenced documents (bug/review reports) as far
   as the scope needs. **Before planning**, additionally read `CLAUDE.md` and every file
   listed under `## Context to read before coding` in the profile — a plan that violates a
   guardrail is not a plan.

2. **Triage — pick exactly ONE of three paths and tell the user which:**
   - **Trivial / mechanical / low risk** (a text or config fix, a clearly bounded
     one-liner): **no ceremony plan.** Say plainly: "this is small enough — I'll just do it
     here in this session, say GO." On GO, implement it like a normal task (then `/build`
     is not needed). This pushback is wanted, not optional.
   - **Unclear / gaps / ambiguous requirement:** fill `## Open Questions` with concrete
     questions and ask the user (`AskUserQuestion` for real decisions). **Status stays
     `draft`.** Only continue to step 3 once they are answered.
   - **Clear and ready:** continue to step 3.

3. **Research (keep context small):** for code search and exploration call `Agent` with
   `subagent_type: "Explore"` (pure search, fast) or `"Plan"`/`"general-purpose"`
   (architecture trade-offs) — never grep broadly through the repo yourself. Give each
   agent a self-contained prompt (goal, what is already known, what to return — it cannot
   see this conversation), and pin **`model: "sonnet"`** plus **`run_in_background: false`**
   on every one of them: searching does not need the expensive tier, an unset `model`
   silently takes the session's, and an unset `run_in_background` means background — which
   for a call whose answer you need in the next step is simply a lost answer. Several
   foreground calls in one message still run concurrently. If a sub-question needs real
   architectural thinking rather than search, that single call gets `model: "opus"`. Bring
   back the essence, not the raw material — ask for a bounded answer (10-20 lines,
   `file:line` pointers instead of pasted code), because whatever comes back is re-read on
   every remaining turn of this refine.

4. **Write into the file** (only the relevant sections, leave the rest of the structure
   untouched; write in the profile's `doc-language`):
   - **`## Plan`** — short and precise, **max. ~50 lines**: steps, affected files, order.
     The user should grasp it in one or two minutes. No essay.
   - **`## Deliverables`** — cut into small, individually acceptable pieces (scrum-like,
     not everything specified from A to Z). Each `D1/D2/...` is the smallest useful result
     with its own acceptance, and **names the files it touches** — plus the file to mirror,
     where it follows an existing pattern. `/build` hands that list to the
     implementing agent, which starts there instead of surveying the repo — and hands it
     **only this D's text plus its test lines**, with the instruction not to open the story
     file. So a D is complete on its own: everything the implementer needs stands in the D,
     not in the plan above it or in a sibling D. The story file is a spec, not a log:
     measured, story files of 25–38k characters were read seven to ten times per sprint by
     agents that had their part in the prompt already.

     **Size cap (cost lever #2):** a D that touches more than ~8 files, or spans more than
     one layer (core + IPC + renderer), is cut too coarsely — split it. Agent cost grows with
     turn count and turn count grows with the size of the D: two agents at 30 turns cost less
     than one at 65, and each returns a separately reviewable result.
   - **`## Model Hints`** — here you fix the **agent tier** per deliverable that
     `/build` will use. There are exactly two tiers:
     - **Default (leave unmarked):** the session/Sonnet tier with `/build`'s effort (`medium`).
     - **`deliverable-hard`** (agent definition in `.claude/agents/`, carries Opus +
       effort `high`) — for tricky Ds (regression risk, complex logic, subtle cross-module
       behaviour): a line `D3 → deliverable-hard` **plus a concrete risk justification**
       (which regression, which new path, which cross-file subtlety). `/build`
       passes that justification to the agent.

     **Tier discipline (cost lever #1):** `deliverable-hard` is ~5x more expensive —
     subagents are >90% of the session bill and the tier decides it. Measured over seven
     sprints in three repositories: 17–43% of all Ds were marked hard and 60% of all stories
     got the hard review, and Opus was 50–75% of every sprint's bill. "Only for real risk"
     did not bind, so the rule is now a budget:
     - **At most ONE `deliverable-hard` per story**, on your own authority, with the
       justification in one sentence (which regression, which new path, which cross-file
       subtlety). If a second D seems to need it, the story is cut too big, not the tier too
       low: propose the split into two stories in `## Open Questions` and leave the status
       `draft` (inside a sprint this returns `BLOCKED: user question`). The user decides; you
       do not mark two.
     - Mark **individual** Ds, never wholesale ("all architecture Ds → hard").
     - Also fix the **review line** — its own line, `Review: → default` or
       `Review: → story-review-hard` with a one-sentence justification. `/build` always
       delegates the code review to a fresh agent on the default tier that sees only spec +
       diff. `story-review-hard` does **not** replace that review: it adds a **second pass**
       on Opus after the default review has passed. Mark it only when you can name the
       plausible-looking *wrong* implementation that would pass the tests and a default
       review — a rigged number, a structural claim no test can see, a negative behaviour.
       "Foundation for later stories" or "touches the scheduler" is not that sentence.
       Measured in one repository, same sprint shape, both all-PASS: four default reviews
       cost $3, four hard reviews $32.
   - **`## Acceptance Tests`** — the AC → test mapping, and this is what replaces the manual
     test plan. **If `ac-tests-required: true` in the profile (P1):** every entry in
     `## Acceptance Criteria` gets one line naming the test that will prove it — level, file
     and the test name it will carry:

     ```
     - AC1 → e2e `tests/e2e/day-view.spec.ts` › "the day view reads top to bottom"
     - AC2 → unit `tests/core/journal/close-day.test.ts` › "a text-less day proposes nothing"
     - AC3 → manual residue: SmartScreen warns on an unsigned build — needs a signed
       certificate we do not have.
     ```

     Rules for that mapping:
     - **The test belongs to the deliverable that implements the behaviour.** Name it inside
       the D as well ("D2 — … plus its test in `<file>`"). A trailing "D5 — write the tests"
       is the anti-pattern: it is the D that gets dropped when time runs short, and the
       coverage was the point.
     - **`ui-acceptance-required: true`:** a criterion describing something the *user does* is
       mapped to the `e2e` command from the profile's `## Verify` — the real surface. A
       console command, a direct call into an internal module, or a renderer test with a faked
       backend is not a substitute for the real path. If the profile's `e2e` is `none`, the
       harness does not exist: plan it as the story's **first deliverable** where the scope
       carries it, otherwise map the criterion one level down *and* write the gap into this
       section and into `## Open Questions` for the sprint review. Never turn it into a manual
       step — that is exactly what this workflow is getting rid of.
     - **An e2e line is also a run target.** `/build` runs only the story's own e2e tests,
       by substituting the file and test name from these lines into the profile's
       `e2e-story` template. So name them exactly as the harness selects them — the real
       path relative to the repo root and the literal test (or flow) name — not a paraphrase.
     - **A missing trigger is a story gap, not a test problem.** If a user-facing action has no
       path through the real surface yet, plan that trigger as a deliverable.
     - **`manual residue`** (only if `manual-residue-allowed: true`) is for a criterion that
       cannot be automated for a *real* reason: an OS-level dialog, specific hardware, a paid
       external service. It needs the reason on the line. "Hard to test" and "would need a
       fixture" are not reasons — they are work. Residues are listed in the sprint review and
       block nothing.

5. **Coverage gate — every AC needs a D and a test:** walk `## Acceptance Criteria` top to
   bottom and name, for each entry, (a) the deliverable that delivers it and (b) the test line
   from `## Acceptance Tests` that proves it. Only then set `status: ready`.

   An uncovered criterion is the most expensive failure this workflow has. It is invisible on
   the way through: every D ticks green, the build reports success, and only the code review
   at the very end finds that the story is incomplete. The fix cycle that follows is then
   routinely the single most expensive agent of the whole story — more than the implementation
   agents together, because it re-establishes context the build already had.

   An untested criterion is the second most expensive: it ends up on a human's list, and that
   list is what this workflow exists to keep empty. A criterion nobody can write a test for is
   usually a criterion nobody can check at all — reformulate it here, with the user, into
   something observable, rather than shipping it as an unverifiable promise.

   If a criterion has no deliverable: cut one for it, or take the criterion back to the user.
   If it has no test and no residue reason: give it one. Do not set `ready` with either gap,
   and do not silently drop the criterion.

6. **Hand off:** summarise in **a few lines** what was refined and whether open questions
   remain. Say: the plan is in the file, corrections welcome, then `/build $1` —
   ideally in a **separate session**, while you keep refining here.

## Rules

- All `## Open Questions` must be resolved before `status: ready`.
- **No `status: ready` while an acceptance criterion has no deliverable covering it** (step 5).
  `/build` re-checks this and sends the story back here.
- **Acceptance is the test suite (P1)**, if `ac-tests-required: true`: no `status: ready`
  while a criterion has neither a named test nor a `manual residue` reason. There is no
  manual acceptance gate behind this — whatever is not tested here is not checked at all.
- **The real surface**, if `ui-acceptance-required: true`: a criterion about a *user action*
  maps to the `e2e` command, not to a console call or a faked-backend test. Missing trigger or
  missing harness = deliverable, or a named gap; never a manual step.
- Keep the plan skimmable — the user wants to iterate, not read every detail.
- Do not commit, do not push. Refine only writes the story file.
- **Older story files** may use the previous German headings (`## Anforderung`,
  `## Akzeptanzkriterien`, `## Offene Fragen`, `## Modell-Hinweise`, `## Testplan
  (manuelle Abnahme)`). Treat them as equivalent to the English ones and keep the file's
  existing language and headings — do not rename sections of a story in flight. A story that
  still carries `## Test Plan (manual acceptance)` / `## Testplan (manuelle Abnahme)` instead
  of `## Acceptance Tests` gets the AC → test mapping written into that existing section,
  under a `### Acceptance tests` sub-heading; do not restructure the file for it.
