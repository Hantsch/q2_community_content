# AI Scrum — Project Profile

<!--
  Written by `/ai-scrum:setup` (ai-scrum plugin). Safe to edit by hand — setup only
  rewrites values you confirm, and never touches your `## Notes`.

  This file holds FACTS the workflow commands need verbatim (verify commands, paths,
  branch strategy). Project RULES and architecture guardrails stay in CLAUDE.md —
  the commands read both.

  The workflow itself lives in this repository: `.claude/commands/{refine,build,sprint,
  roadmap,concept}.md` plus `.claude/agents/{deliverable-hard,story-review-hard}.md`.
  Everyone who clones the repo can use it; the plugin is only needed to install or
  update those files (`/ai-scrum:setup`). Hashes of the managed copies: .claude/ai-scrum.lock
-->

ai-scrum-version: 4.0.0
project: q2_community_content

## Verify

Commands the build step runs before a story may be called done. Use `none` when a
step does not exist in this project.

build: none
test: none
lint: none
typecheck: none
e2e: none
<!--
  `e2e` is the acceptance gate for user-facing stories: an acceptance criterion that
  describes something the user does is proven here, through the real surface. It is a
  separate entry because it is usually slower than `test` and lives in its own suite.
  `none` means the project has no such harness yet — see `ui-acceptance-required` below
  for what the workflow then does instead.
-->

<!-- This is a content-only repository (news/engine/gamedata packages for q2-launcher) —
     no build/test/lint tooling exists yet. Rerun /ai-scrum:setup once code and a
     verification harness are added. -->

## Conventions

doc-language: en <!-- language for generated artifacts: stories, sprint reviews, concepts -->
requirements-path: docs/requirements
sprints-path: docs/sprints
roadmap-path: docs/ROADMAP.md
concepts-path: docs/concepts
systems-path: docs/systems
story-id-format: NNN <!-- three digits + slug, e.g. 042-npc-haggling.md -->
sprint-id-format: SNN <!-- e.g. S07 -->

changelog-path: none
<!--
  Optional. Path to a USER-FACING changelog (e.g. version.md, CHANGELOG.md) — not the
  git history. When set, /build and /sprint require an entry for every user-facing
  change; when `none`, the rule is dormant and nothing asks for it.

  The house style for such a file, if you set one:
    - one entry per user-facing feature or fix, under `# Features` / `# Fixes`
    - tests, refactors and internal changes do not appear — they change nothing for the user
    - append to the current version section only; never restructure earlier ones
    - short, punchy, a little funny. Not a paragraph explaining the implementation.
    - the language is `doc-language`
-->


## Branching

branch-base: main <!-- branch a sprint is cut from -->
sprint-branch-pattern: sprint/{id}
auto-commit-per-story: true <!-- /sprint commits once per story ON THE SPRINT BRANCH only -->
protected-branches: main <!-- never commit here, never push, never merge -->

## Acceptance

**Acceptance is the test suite, not a person with a click list.** Every acceptance
criterion is proven by an automated test that the workflow writes as part of the story.
A story is done when its criteria's tests pass and the clean-agent review is through —
there is no separate manual gate, no "built, acceptance pending", no user tick.
What a walk-through afterwards finds becomes a new story.

ac-tests-required: true
<!--
  true  = P1 applies: every acceptance criterion needs a named automated test before
          `status: ready` (`/refine` writes the AC → test mapping) and a passing one
          before `status: done` (`/build` re-checks it). A criterion that genuinely
          cannot be automated is declared as `manual residue` with a reason and does
          not block anything — see below.
  false = the mapping is advisory; the workflow only asks for tests where the story
          itself does. Use this for throwaway or spike projects.
-->

ui-acceptance-required: false
<!--
  true  = a criterion that describes something the USER does is proven through the
          real surface — the `e2e` command from `## Verify`. A console command, a
          direct call into an internal module, or a renderer test with a faked
          backend does not count as a substitute for the real path. Criteria without
          a surface (core logic, IPC, parsing) are covered by `test`.
          If `e2e` is `none`, the harness does not exist yet: `/refine` then plans it
          as the story's first deliverable, or, when that is out of scope, covers the
          criterion at the next level down AND names the gap in the story and the
          sprint review. It never quietly becomes a manual step.
  false = for a library, CLI, mod or service without a user-facing surface.
-->

<!-- No user-facing surface lives in this repository yet (the q2-launcher UI is a
     separate repo). Revisit once a preview/validation surface is set up here. -->

manual-residue-allowed: true
<!--
  true  = a criterion that cannot be automated for a real reason (an OS signature
          dialog, a specific piece of hardware, an external paid service) is marked
          in the story as `manual residue: <reason>`. It is listed in the sprint
          review and, if the project generates one, in `testplan.md` — the only
          things left that anyone walks by hand. It does NOT hold the story or the
          sprint open.
  false = such a criterion has to be reformulated or dropped in refine.
-->

testplan: optional
<!--
  optional = `/sprint` writes `testplan.md` only for the criteria marked
             `manual residue`, and skips the file entirely when there are none.
  required = always write the full step-by-step plan (the old behaviour).
  off      = never write it.
  In no case is `testplan.md` an acceptance gate — the tests are.
-->

## Context to read before coding

Files every implementation and review agent must read before touching code.
Keep this short — it is pasted into every subagent prompt.

- AGENTS.md

## Notes

<!-- Free text. Never overwritten by setup/update. Project quirks worth knowing. -->
