---
description: Runs a sprint (sprints/SNN/sprint.md) autonomously — branch, refine + build every story with its acceptance tests, one commit per story, a full regression gate, then the review doc.
argument-hint: <sprint-id>
model: sonnet
effort: medium
---

<!-- ai-scrum:managed 4.4.0 - plugin-owned, written by /ai-scrum:setup. Do not edit:
     setup diffs this file on update and asks before replacing it. Project facts go in .claude/ai-scrum.md. -->

Run sprint **$1**.

## Project profile

Read `.claude/ai-scrum.md` first — paths, verify commands, branching, auto-commit,
acceptance policy, `changelog-path` and doc language come from there. If it is missing, stop
and say: run `/ai-scrum:setup` first. Below, `<sprints>` and `<requirements>` mean the
corresponding paths from the profile.

## Core principle

You are the sprint orchestrator. The sprint runs **largely autonomously**: no stops for
small things, no question on every detail decision.

**Exception — deliberately open decisions belong to the user.** Whatever a story lists under
`## Open Questions` was left open on purpose — **never** decided by an agent. You (the
orchestrator) resolve those, bundled, via `AskUserQuestion` in the clarification round
(phase 1a) and in the follow-up after refine. Subagents cannot reach the user — that is why
every user question goes through you.

All **other** detail decisions are made by the agents themselves, **verified against the
spec** (story file, roadmap + the concept it links for the milestone, guardrails in
`CLAUDE.md`) and written down — in the story under `## Decisions (Sprint)` or in the Done
section. Only a real blocker that only the user can resolve, and that surfaces in the build
phase, stops the **affected story** (not the sprint) — it is marked as blocked and the rest
continues.

All state lives in files (`sprint.md`, story files, commits) — after a context reset
`/sprint $1` is **resumable** and continues at the first open spot.

## Status lines — what the user gets while the run is silent

The user sits in the chat and sees only your text. A foreground `Agent` call shows them
nothing until it returns, a story build is 10–60 minutes of exactly that, and a healthy run
looks the same as a dead one. So every step that can take longer than about three minutes is
framed by two lines of yours. They are part of this command, not chatter: an output style may
shorten their wording or change their language, never drop them.

- **Before the step**, one line of facts, not reassurance: what starts and how many are left,
  the clock, how long the last step of its kind took, the file to watch, and the escape —
  `Build 107 (2/4) · started 09:52 · 106 took 12 min · watch docs/sprints/S22/progress.md ·
  Esc + /sprint S22 resumes`. The clock is never typed: it is the output of the `Bash` call
  that appends the step's line to `<sprints>/$1/progress.md` in the same command, exactly like
  the trail rule in `build.md` — `- <shell timestamp> · 107 · build · started` for a story,
  `· refine · 106 107 108 109 · started` for the refine round, `· gate · e2e-all · started`
  for the long suite. The last duration comes from the trail (the previous story's `build ·
  started` and `story · done` lines) or from the previous sprint's `## Regression gate` record;
  for the first of a kind write `first one, no estimate` — never a guess.
- **After the step**, one line: result, elapsed, commit — `107 done · 16 min · 0a99dce · 2/4`.
- **The first line of the sprint** (phase 0) names the shape once: `Refine (parallel, ~10 min)
  → Build 4 stories (one after another, 10–20 min each, silent while they run) → Regression
  gate (long suite in the background, log named when it starts) → Review · progress:
  docs/sprints/S22/progress.md`.

Nothing else goes between delegations — no summary of what an agent did, that costs context —
but these lines are not optional, and `Now building story 107.` does not satisfy them: no
clock, no estimate, no file.

**When the user asks whether it hangs** ("status?", "hängt das?", "machst du noch was?" — the
message reaches you when the current call returns), answer in at most five lines and start
nothing new in that turn:

1. the current step and its start time · elapsed of expected;
2. the last line of `<sprints>/$1/progress.md` with its timestamp (`tail -n 1`), or for a gate
   suite the last three lines of its log;
3. background tasks alive (`<id> <command> since HH:MM`) or `none`;
4. what you are waiting for and when you expect it;
5. the escape: `Esc, then /sprint $1 — it resumes at the first open spot`.

"It is running, not hung" without those numbers is not an answer — a hung process also runs,
and the user asked because the numbers were missing. If the last trail or log line is older
than 15 minutes and you cannot name the reason, say that in those words; it is the user's cue
to intervene. A status question is never a reason to relaunch or re-verify anything. Derive
the state from `git status`, the trail and `sprint.md`, never from memory — an orchestrator
that "knew" its agent had stopped while it was still editing the tree has happened.

## Precondition

1. Open `<sprints>/$1/sprint.md`. If it does not exist: abort and point at
   `<sprints>/_TEMPLATE/sprint.md`.
2. Sprint status: `planned` → start normally. `in-progress` → **resume** (skip finished
   stories, continue at the first open spot). `done` → abort.
3. `git status` must be clean. Foreign uncommitted changes → abort and ask the user.

## Phase 0 — Setup

1. **Mark the sprint as running where everyone looks — on `branch-base`, before the branch
   exists.** With the sprint `planned`: check out `branch-base`, set `status: in-progress` and
   the `branch:` line in `sprint.md` (the name the branch is about to get, from
   `sprint-branch-pattern`), and commit exactly that one file as `$1: sprint started`. This is
   the one commit this command makes outside the sprint branch, and it is allowed even when
   `branch-base` is listed in `protected-branches`: it touches nothing but `sprint.md`, and it
   is what lets anyone on the base branch see that the sprint is under way and on which
   branch. Never push it.
2. Create and check out the sprint branch from `branch-base`, named after
   `sprint-branch-pattern` (e.g. `sprint/$1`). On resume (`in-progress`) the start commit
   already exists and nothing is committed on `branch-base` again: check the branch out, or
   create it now if the run died between the two steps.
3. **Say what the run looks like from the outside** — the first-line status from
   `## Status lines`: the phases with their shape and rough length, and the progress file
   `<sprints>/$1/progress.md`.

## Phase 1a — Clarification round (orchestrator ↔ user)

Before any refine agent starts:

1. From every story in the sprint list with status `draft`, read `## Open Questions`. Skip
   entries already marked as answered (resume). If any are open, say so in one line before
   asking — `3 open questions in 114, 116 block the start; the run continues once they are
   answered` — because a sprint started before leaving the desk waits here until someone comes
   back (measured: a sprint started at 17:14 asked at 17:27 and got its answers at 05:50 the
   next morning). Open questions are best resolved in planning, with `/refine`, before
   `/sprint` is called; this round exists for the ones that slipped through.
2. If open entries exist: put them to the user **bundled** via `AskUserQuestion` (max. 4
   questions per call, as many calls as needed). Per question: one sentence of story
   context, sensible answer options derived from spec/concept doc, one marked as
   recommended. Do NOT ask questions the story explicitly defers to refine, or pure
   balancing placeholders — those belong to the agents.
3. Write each answer into the affected story immediately: under `## Decisions (Sprint)` as
   `- **(User)** <short form of the question>: <decision>`, and mark the entry under
   `## Open Questions` as `~~…~~ answered → Decisions (Sprint)`.
4. Phase 1b starts only once every question asked has been answered and recorded.

## Phase 1b — Refine (all stories, in parallel)

For every story in the sprint list whose requirement is still `draft`, ONE fresh `Agent`
(`subagent_type: "general-purpose"`, **`model: "opus"`**, **`run_in_background: false`**) —
all calls in ONE message. Several foreground calls in one message run concurrently *and*
block until all of them have returned, which is exactly what this phase wants; backgrounding
them instead buys nothing and costs you the completion notifications. The status line before
it (`## Status lines`) counts the stories; exactly that many `Agent` calls follow **in this
same message**. One call per message is not parallel — measured: four refines one after
another, 20 minutes instead of seven. If you notice that the first refine has returned and the
others were never started, say so in one line and issue every remaining call in one message.
Prompt (self-contained, the agent does not know this session):

- Read the refine procedure — the file is
  `.claude/commands/refine.md` — and refine story **<id>** exactly along those
  steps, with the following **sprint deviations**:
  - **No questions to the user** (you cannot reach them). The deliberately open decisions
    are already answered under `## Decisions (Sprint)`, marked `(User)` — they are
    **binding** and are not re-decided or reinterpreted.
  - All **other** detail questions you decide yourself: against acceptance criteria, linked
    stories, the roadmap plus the concept linked for the milestone, and the guardrails in
    `CLAUDE.md` + the profile's context files. Document every decision with a one-sentence
    reason in the story under `## Decisions (Sprint)` (without the `(User)` marker).
  - **Triage "trivial":** do not wait for GO, do not implement anything directly — even
    trivial stories get a minimal plan + 1 deliverable and `status: ready`, so the build
    phase works uniformly.
  - **Tier budget, as in `refine.md`:** at most one `deliverable-hard` per story; the review
    line is `Review: → default` unless you can name the plausible wrong implementation that
    would pass the tests and a default review — then `Review: → story-review-hard`, which
    adds a second review pass, it does not replace the first. A story that seems to need two
    hard Ds is cut too big: put the split proposal into `## Open Questions`, leave `draft`
    and return `BLOCKED: user question`.
  - If you hit a **new** decision that belongs to the user (design direction, a
    contradiction in the spec, a missing factual basis): leave status `draft`, phrase the
    question precisely with answer options in `## Open Questions`, and return
    `BLOCKED: user question`.
- Return: `ready` or `BLOCKED: <reason>` + max. 5 lines of plan essence + the list of
  decisions taken + one line `tiers: D <n> / hard <h> · review default[+hard]`.

**Follow-up:** if a story came back with `BLOCKED: user question`, put the new questions to
the user (as in phase 1a), record the answers and start exactly ONE more refine round for
those stories. Stories still blocked afterwards are marked in their `sprint.md` line
(`(blocked: <reason>)`) — they are skipped in phase 2.

**Then one line of tiers**, from the refine returns, before the first build starts —
`Tiers: 114 D5/hard 1 · review default+hard — 115 D6/hard 1 · review default — …`. It is not
a question and needs no answer; it is the moment the user can still stop the run if the
budget looks wrong, and it is what the tier record in phase 3 is compared against.

## Phase 2 — Build (all stories, sequentially in list order)

For every `ready` story ONE fresh `Agent` (`subagent_type: "general-purpose"`,
**`model: "sonnet"`**, **`run_in_background: false`**) — strictly one after another (later
stories build on earlier ones). Both parameters are written out on purpose: an unset `model`
inherits the *session* model rather than this command's frontmatter and re-tiers the entire
agent tree below it, and an unset `run_in_background` means **background**, which for a
story-long build is a coin flip on whether you ever hear back. Do **not** escalate the tier
on your own — the hard tier is chosen per deliverable inside `/build`, from `## Model Hints`.
Before every build `Agent` call the status line with its `build · started` trail append, after
it returns the closing line, before the commit (`## Status lines`). Prompt (self-contained):

- Read the build procedure — the file is
  `.claude/commands/build.md` — and implement story **<id>** exactly along it:
  delegate deliverables one by one to fresh agents, honour `## Model Hints` (hard tier only
  where marked), verification with the commands from `.claude/ai-scrum.md`, clean-agent
  review over the diff, fill the Done section. **Sprint deviations:**
  - **No questions to the user.** Make decisions during implementation yourself, verify them
    against plan + acceptance criteria and document them in the Done section under
    "Decisions".
  - On a real blocker (plan has gaps, review-fix cycles exhausted, red tests you cannot
    fix): leave status `in-progress`, document the blocker honestly in the story file and
    return `BLOCKED: <reason>`. QA rules apply without exception — never weaken tests to go
    green.
  - Do not commit (the orchestrator does that).
  - **Narrow gate only.** Verify with step 5 of `build.md` as written — `test-story` /
    `e2e-story` where the profile sets them. Skip step 6b and the closing line of step 11:
    the full regression gate is the sprint's, and runs once after the last story.
  - **Progress file:** `<sprints>/$1/progress.md` (spell out the resolved path; the file is
    created by the first append). Apply the "Progress trail" rule from `build.md`'s
    `## Delegation rules` for every deliverable, the verification, each review cycle and the
    story's end (`<id> · story · done` as the last command before returning): one shell
    command per `started`/`done`/`blocked` event, the timestamp produced by the shell inside
    that same command, never typed. It costs almost nothing and it is the only thing that
    tells the user a long build is alive — they watch that file, where a running agent and a
    dead one look identical the moment the lines stop.
- Return: `done` or `BLOCKED: <reason>`, the commit message from the Done section, changed
  files, findings/decisions as bullet points, and the `tiers:` line from the Done section
  verbatim (`tiers: D <n> / hard <h> · review default[+hard] · cycles <c> · agents <a>`) —
  **at most 20 lines**, no diffs and no pasted file contents. Everything it returns stays in
  your context for the rest of the sprint.

**After each story YOU commit** — but only if `auto-commit-per-story: true` in the profile,
and only on the sprint branch (never push, never on a `protected-branches` entry). If it is
`false`, leave the changes staged-free and tell the user at the end which commits to make.

- Story `done`: tick the checkbox in `sprint.md`, then `git add -A` and commit with the
  prepared message (story ID first, e.g. `042: finish team-based combat`).
- Either way, glance at the new lines in `<sprints>/$1/progress.md`: timestamps must be
  monotonic and none may be later than `date`/`Get-Date` says now. If they are not, the build
  agent typed them instead of running the trail command — note that under findings for
  `review.md` (phase 3) so it is visible, and do not repair the lines by hand.
- Story `BLOCKED`: commit the partial changes as `WIP <id>: blocked — <reason>` so they do
  not bleed into the next story's diff; mark the story in `sprint.md`. If a later story
  depends on the blocked one, skip it too (with a note) instead of building on a broken base.
- **Anything else is a failed agent, not a pause.** A return that is neither `done` nor
  `BLOCKED` — a status sentence ("waiting for D2", "sent a nudge to the D8 agent"), an API
  error, nothing at all — means the build stopped: it is a subagent, and whatever it said it
  was waiting for will never wake it. Do not `SendMessage` it and do not end your turn. Run
  `git status --short` and `tail -n 5` on the progress file, then dispatch ONE fresh foreground
  build `Agent` for the same story with the same prompt plus the note that partial edits may
  already exist. A second such return is `BLOCKED`. A rate-limit message instead (`429`,
  "session limit", a reset time) ends the run: print the reset time and the resume instruction
  (`/sprint $1` after it), commit nothing, stop.

## Phase 2b — Regression gate (mandatory, after the last story, before the review)

Every story passed its own narrow gate; this is where they run **together**. A story's gate
proves its criteria and what its changes touch — it cannot see a later story breaking an
earlier one's flow, or two stories that are each fine and wrong in combination. Running all
suites once, on the finished branch, is what catches that. This phase is not optional and is
not skipped because every story came back green: that is exactly the state in which such a
regression hides.

Resume: the result lives in `sprint.md` under `## Regression gate` and is committed with the
review in phase 3. If that section already holds a result and no story or fix commit came
after the commit it names, skip to phase 3.

**Budget — launches, and it is small.** The full suites run once (steps 1 and 1b). The
attribution agent re-runs only the failing tests, at most twice (once on `HEAD`, once at the
merge-base). A fix agent re-runs the failing tests and the short suites once per attempt, and
you re-run the long suite once per attempt — two attempts. One extra launch is allowed for a
run the environment lost — an empty log, `another instance is already running`, a port in
use, a crash before the first test — after the leftover check in step 1b; a second loss of
that kind is reported as the environment's state, not launched a third time. That is every
launch this phase has: at most five, usually one per suite. A collision with a stale process
is not a test result. And once the attribution agent has returned its verdicts, the gate is
**decided**: no baseline run in a worktree, no "one clean, isolated run", no re-run "to be
sure", no second attribution — go to step 5 with what you have. Measured without this
paragraph: nine launches of the same 15-minute suite, and a gate phase longer than all four
story builds together.

1. **Run the short suites** — ONE fresh `Agent` (`model: "sonnet"`, `run_in_background: false`),
   so the suite output lands in its context and not in yours. It runs, each once, on the
   sprint branch's `HEAD`: `build`, the full `test`, the full `e2e` — each only if set and not
   `none` — **but not `e2e-all`**, which is step 1b and yours. Quote it the ceiling rule from
   `build.md`'s `## Delegation rules` ("A `Bash` call ends after ten minutes …") word for
   word: `timeout: 600000` on every suite call, and a command that is moved to the background
   anyway is stopped with `TaskStop` at once and reported as `exceeded`, never awaited. It
   changes no files and returns at most 15 lines: per command green / red / exceeded with its
   minutes, and for red the failing test names with their files. Nothing to run at all (every
   entry `none`) → record that and go on.
1b. **Run the long suite yourself, in the background, once.** `e2e-all` (if set, not `none`,
   and not the same command as `e2e`) — and any command step 1 returned as `exceeded` — runs
   from your session, never from a subagent: a subagent cannot outlive a ten-minute tool call
   and is never told when a background task ends; this session is. In this order:
   - **Leftovers first.** If the suite drives a single-instance app or a server on a fixed
     port (Electron, a dev server), look once for instances a previous run left behind and stop
     them — a stale one makes every flow fail with `another instance is already running`, which
     is a collision, not a red test. Run the profile's `e2e-cleanup` if it is set.
   - **The status line** (`## Status lines`), its trail append `- <ts> · gate · e2e-all ·
     started` and `watch: <sprints>/$1/gate-e2e-all.log`. The last duration comes from the
     previous sprint's `## Regression gate` record; without one, `first run — a full flow suite
     is usually 10–20 min`.
   - **ONE `Bash` call with `run_in_background: true`**, the output through `tee` into that
     log — `<e2e-all> 2>&1 | tee <sprints>/$1/gate-e2e-all.log` — never a bare `>`: a suite
     that buffers or dies leaves an empty file, and an empty log is a result nobody can
     attribute (measured: eleven minutes for nothing). Never as a foreground `Bash` either:
     that only burns ten minutes before landing in the same background state.
   - **End the turn** with exactly that one task in flight and nothing else pending. This is
     the one sanctioned wait in this command (see Rules): the task's exit notification wakes
     this session. When it arrives, read only the runner's summary — `tail -n 40` of the log —
     never the whole file; the attribution agent gets the log path.
2. **Green** → record it (step 5) and go to phase 3.
3. **Red → attribute it to a story.** Delegate to ONE fresh `Agent` (`model: "sonnet"`,
   `run_in_background: false`) with the failing tests, the gate log's path, the sprint's story
   commits (`git log --oneline <branch-base>..HEAD`), the `build` command, the ceiling rule from
   `build.md` and the instruction to change no source file and to run only the failing tests,
   never a whole suite — if the failing subset alone would exceed ten minutes, it says so and
   returns `unattributed` for those tests instead of running them. Its verdict is final for
   this sprint: you do not launch a suite to check a subagent's result.
   - **Flaky first:** run only the failing tests once more on `HEAD`. Green now → not a
     regression but a flaky test; it is named as a finding in the review, never silenced, and
     not bisected.
   - **Pre-existing:** run only the failing tests on the sprint's start
     (`git merge-base <branch-base> HEAD`). Red there too → the sprint did not cause it; it is
     reported as pre-existing, not bisected, not fixed here.
   - **Otherwise bisect** over the sprint's commits: `git bisect start HEAD <merge-base>`, then
     `git bisect run` with a script that runs `build` (when set) and only the failing tests —
     never the whole suite per step. The first bad commit names the story by its ID prefix
     (`042: …`, or `WIP 042: …` for a blocked one). Always finish with `git bisect reset`, and
     confirm the branch is back on its `HEAD` with a clean tree.
   - Returns at most 10 lines: per failing test the verdict (`flaky` / `pre-existing` /
     `story <id>, commit <sha>`).
   Without per-story commits (`auto-commit-per-story: false`) there is nothing to bisect: the
   agent attributes by which story's changed files the failing test exercises, and says that
   the attribution is a judgment, not a bisect result.
4. **Fix it on the sprint branch, or report it as a blocker.** Per attributed story, ONE fresh
   `Agent` (`model: "sonnet"`, `run_in_background: false`) gets the story file, the failing
   tests, the bisected commit's diff and the build rules that still hold: fix the cause, never
   the test — a test weakened until the gate goes green is the regression shipped. It re-runs
   the failing tests and the short suites once; the long suite's confirmation run is yours, as
   in step 1b, once per attempt. Green → commit on the sprint branch as
   `<id>: fix regression from sprint gate` (only with `auto-commit-per-story: true`, same rules
   as phase 2), and append one line to that story's `## Done` naming the regression and the fix
   commit. Two fix attempts without green → stop fixing: it is a **blocker for the merge**,
   reported in the review with the failing tests and the attributed story. The story file is
   not moved back out of `done/`; the blocker is the sprint's, not a reopened story.
5. **Record** under `## Regression gate` in `sprint.md` (append the section if missing): the
   commands that ran with their measured minutes (the next sprint's status lines quote them),
   green/red, the commit it ran on, and per failure its verdict and outcome (fixed in `<sha>` /
   blocker / pre-existing / flaky / `unattributed — budget exhausted after <n> launches`;
   `unattributed` counts as a merge blocker). This is the resume marker, and the source for the
   review. Recording the gate closes it: before writing this section, `TaskStop` every gate
   launch that is still running — a result that arrives after the record cannot change it, and
   its notification after the final report would restart the sprint (`## Closing the run`) —
   and delete `<sprints>/$1/gate-*.log`; the record is what survives.

## Phase 3 — Sprint review

1. **`<sprints>/$1/review.md`** you write yourself from the collected results (in the
   profile's `doc-language`):
   - **Overview:** sprint goal + table (story · status · short commit description).
   - **Implemented stories:** 1–3 lines each on what was built.
   - **Findings & decisions:** aggregated from the `## Decisions (Sprint)` sections, the
     build feedback and the review findings — input for the next sprint planning
     (corrections, direction decisions).
   - **Blocked / open:** blocked stories with their reason and the question the user has to
     decide.
   - **Regression gate:** from `## Regression gate` in `sprint.md` — the commands, the
     result, and per failure the test, the story it was bisected to and what happened (fixed
     in which commit, blocker, pre-existing, flaky). A regression that is still red is listed
     under **Blocked / open** as well, and the review says plainly: do not merge before it is
     resolved.
   - **Acceptance:** one section listing, per story, the criteria and the test that proved
     each one (from the Done sections) — and separately every `manual residue` with its
     reason. That list is the sprint's acceptance record. It is also the honest place to say
     that a criterion was covered a level below the real surface because the `e2e` harness
     does not exist yet.
   - **Tier record:** one table from the `tiers:` lines the build agents returned — story ·
     Ds · hard Ds · review stages · review cycles · agents dispatched · build minutes (from the
     trail) — plus a totals row and one sentence: did the second-stage (hard) review find
     anything the default review had missed? That table is the sprint's cost signal: the hard
     tier is the bulk of the bill, and the next planning reads this table to decide whether the
     budget in `refine.md` holds or needs tightening. A hard review that found nothing new
     three sprints in a row is the cue to drop it to a final confirmation only.
2. **`<sprints>/$1/testplan.md`** — governed by `testplan` in the profile, and **it is not an
   acceptance gate**; the tests are. Default `optional`:
   - **`optional`:** collect every `manual residue` line from the sprint's stories. If there
     are none, **write no file** and say so in the review — nothing here needs a human. If
     there are some, write only those: per residue the reason it cannot be automated, the
     preparation, the steps and the expected result. Nothing else goes in — a criterion with
     a passing test is not walked again by hand.
   - **`required`:** delegate to ONE fresh `Agent` (`model: "sonnet"`,
     `run_in_background: false`) to write the full step-by-step plan for the sprint's use
     cases: read the story files (`## Acceptance Criteria`, `## Acceptance Tests`, legacy
     `## Test Plan (manual acceptance)`) and the surface actually built, in the code. Per use
     case **preparation** (how to start the app per the README, test content), **steps**
     (where to click, what to type), **expected result**. Only use cases from stories actually
     implemented in this sprint, no invented features.
   - **`off`:** skip the file entirely.
3. **Update the roadmap** (`roadmap-path`) — it is a one-screen map, and this step touches
   exactly three places in it, never more:
   - **The milestone's table row:** sprint link (to `review.md`), status from the real state —
     all its stories done means **`done <date>`**, not "built, acceptance pending"; there is no
     user acceptance step gating this, the criteria were proven by their tests, and what a
     later walk-through finds becomes a new story in a new sprint. The row's note is at most
     one sentence (a blocked story, a deliberate omission) or empty. Gaps, manual residue and
     criteria covered below the real surface stay in `review.md` — the roadmap **never** gets a
     "Gaps/notes" paragraph.
   - **"Follow-ups worth doing":** one line per finding that is worth doing, needs no decision
     and is not a story yet, with `[SNN review](…/review.md)` as its source. Remove lines this
     sprint has made obsolete. Anything bigger is a story proposal for the review's findings
     section, not a roadmap line.
   - **"Where we stand"** and "As of": rewrite the block (max. five lines) — what was just
     finished, what is next, what is waiting on the user (the merge).
   If a concept is thereby fully implemented (all stories done): `git mv` it to
   `systems-path` and update its status line.
4. **If `changelog-path` is set in the profile:** check that every story done in this sprint
   with a user-facing change has its entry there, under `# Features` / `# Fixes` of the current
   version section. `/build` writes them per story; this is the sweep that catches the ones it
   missed. A missing entry is a finding in the review, not something you fix silently — add it,
   and say in the review that it was added late. When `changelog-path` is `none`, skip this.
5. `sprint.md`: `status: done` as soon as every story is `done` or visibly marked blocked,
   and the regression gate (phase 2b) is recorded — green, or its red result named as a
   blocker in the review.
   Nothing is held open for an acceptance round — a sprint is finished when its work is
   finished, and a story stays open only for a blocker that makes it genuinely
   uncompletable (normally caught in refinement, not here).
6. Final commit: `$1: sprint review + roadmap` — it carries the `## Regression gate` record
   in `sprint.md` too (add `+ testplan` only if a `testplan.md` was
   actually written).

## Closing the run — before the final report

1. **Nothing of yours is still running.** Every `Agent` call you issued has returned — a
   result reading `[Request interrupted by user for tool use]` is a *detached* agent, not a
   stopped one: it may still be editing the tree and will hand back later; say so, and never
   start a second build agent for the same story on top of it. Every background task you
   started has returned or been stopped with `TaskStop`. `<sprints>/$1/gate-*.log` is deleted.
2. **Nothing is pending.** The gate is recorded, `review.md` and the roadmap are committed. If
   one of them is not, you are not at the final report yet.
3. **The final report is written once, and it ends the run.** Whatever arrives afterwards — a
   task notification for a launch you forgot to stop, a late agent result, a stray Monitor
   event — gets exactly one line (`Late result of <task>: <one-line outcome> — the sprint is
   reported, nothing changes`) plus a `TaskStop` if the task is still alive, and no other tool
   call: no run, no fix, no attribution, no worktree, no "one clean run to be sure". The single
   exception is a late result that contradicts the recorded gate verdict (a suite recorded
   green now red, or the reverse): one line saying exactly that, then `AskUserQuestion` whether
   to reopen the gate — reopening is the user's decision. After "done" the user wants to know
   one thing: whether they can walk away. Twenty silent minutes of re-runs after the final
   report is what they experience as a hang.

## Final report to the user

Short and complete: branch name, stories done/blocked, path to `review.md` (and to
`testplan.md`, if one was written — otherwise say plainly that nothing needs walking by hand),
the regression gate in one line (green, or which story broke what and whether it was fixed — a
red gate first and loudly, because it decides the merge), the acceptance record in one line
(criteria proven by tests / manual residues / criteria covered below the real surface), one
line of measured minutes (refine, each story, each gate command — from the trail and the gate
record; the next sprint's estimates come from there), one line of tiers (the totals row of the
tier record: `tiers: D 22 / hard 3 · hard reviews 1 of 4 · agents 41`), that nothing is still running
(`background tasks: none`, or the list and why), and that merging into `branch-base` is the
user's decision. A `protected-branches` entry is never the target of a sprint branch merge you
make.

## Rules

- **Never push. Never commit on a protected branch. No merge** — that is the user's job. The
  single exception is the `$1: sprint started` commit of phase 0 on `branch-base`: one file,
  once, never pushed.
- **Acceptance is the test suite.** A sprint does not hand the user a list of things to click.
  Every criterion was mapped to a test in refine and proven by it in build; `review.md` records
  which test proved what. A sprint that ends with "please walk these 40 items" has failed at
  refine, not at review.
- **Narrow per story, broad per sprint.** Each story runs only its own tests and flows; the full
  suites run once, in phase 2b, on the finished branch. Never skip that phase to save time and
  never widen a story's gate to compensate — the one is cheap because the other exists.
- **The real surface (P1)**, if `ui-acceptance-required: true`: criteria about user actions are
  proven through the profile's `e2e` command. Where a story could only cover one a level below
  that — a missing harness, a missing trigger — it is named as a gap in `review.md` (and, if
  closing it is worth doing, as one follow-up line in the roadmap), never quietly converted
  into a manual step.
- **Manual residue is the exception and it is bounded.** Only criteria that cannot be automated
  for a real reason (an OS dialog, specific hardware, a paid external service) land on a human,
  each with that reason. They are listed in the review and, per the `testplan` setting, in
  `testplan.md`. They do not hold a story or the sprint open.
- Auto-commits apply only to `/sprint` on the sprint branch; elsewhere "never
  commit without being asked" still holds.
- **Never end a turn waiting for an agent.** A turn without a tool call ends your run — "I'll
  report back once the build agent returns" is not a pause, it is the end of the sprint, and
  the user finds out by noticing that the working tree stopped moving. Every `Agent` call is
  foreground, and the question never comes up. The **one** exception is the background `Bash`
  task of phase 2b step 1b, started by you at the top level: a background task's exit
  notification does reach this session — it never reaches a subagent, which is why the gate
  agent must not start one. End that turn only after the status line, with exactly that one
  task in flight and nothing else pending — not with an agent, not with two tasks, not "to see
  how it goes".
- **There is no watchdog you can build, so do not build one.** `ScheduleWakeup` belongs to
  `/loop`; outside it the call schedules nothing and answers "no pending wakeup to cancel" — a
  sprint that calls it has armed nothing. `TaskOutput` cannot resolve a subagent id, a
  standalone `sleep` is refused, a `Monitor` dies with the turn that started it, and a dummy
  "noop" agent wakes you with the wrong result. Foreground delegation plus the one background
  task above is the whole mechanism; polling loops (`until … sleep`), heartbeat agents and
  `echo waiting` turns are not substitutes and must not be improvised — measured: a polling
  loop against a wrong path ran orphaned for two hours and forty minutes.
- **Do not switch the session model while a sprint runs**, and say so to the user if they ask
  mid-run. Every agent started without an explicit `model` inherits the session model and
  passes it down its whole subtree — flipping to Opus mid-sprint therefore re-tiers everything
  that follows, at roughly five times the price, with no visible change in behaviour.
- Context discipline: keep agent returns short; read story files only where needed — the
  state lives in `sprint.md` + story status, not in your memory. You are the orchestrator:
  reading source files yourself is an agent's job, and whatever you read is re-read on every
  turn you have left.
- If ALL stories are blocked or phase 0 fails: stop cleanly and report the state honestly.
- **Older story files** may use the previous German headings (`## Offene Fragen`,
  `## Entscheidungen (Sprint)`, `## Akzeptanzkriterien`, `## Modell-Hinweise`) — treat them
  as equivalent and keep each file's existing language.
