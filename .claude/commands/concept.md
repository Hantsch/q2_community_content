---
description: Works out a concept through a requirements interview (vision, goals, decisions) and files it as a document under concepts/.
argument-hint: <topic>
model: opus
effort: high
---

<!-- ai-scrum:managed 4.0.0 - plugin-owned, written by /ai-scrum:setup. Do not edit:
     setup diffs this file on update and asks before replacing it. Project facts go in .claude/ai-scrum.md. -->

Work out a concept for **$1** — together with the user, by interview.

## Project profile

Read `.claude/ai-scrum.md` first — `concepts-path`, `systems-path`, `roadmap-path` and
`doc-language` come from there. If it is missing, stop and say: run `/ai-scrum:setup` (ai-scrum plugin) first.

## Core principle: NO assumptions

This is requirements engineering, not solo design. You make **no substantive design
decisions yourself** — everything the concept fixes was either **answered by the user in the
interview** or stands as an **open point** in the document. If you catch yourself writing
"they probably want X": stop and ask.

Allowed without asking is only what is **fact**: existing systems in the repo, architecture
rules from `CLAUDE.md`, content of concepts already decided.

## Steps

1. **Load context (before you ask):**
   - Read the existing concepts under `<concepts>/` (not yet implemented) and `<systems>/`
     (already implemented, as reference) — at least the project's overall vision document
     and the topically closest ones, which are also your **format reference**. The docs index
     tells you what lives where; the roadmap says what is planned or unprioritised.
   - For code/system research call `Agent` with `subagent_type: "Explore"`,
     `model: "sonnet"` and `run_in_background: false` — never grep broadly through the repo
     yourself, and never leave those two parameters unset (unset `model` inherits the session
     tier, unset `run_in_background` means background, i.e. an answer you never get). Goal: know what already exists, so your questions are
     precise and the concept builds on what is there.

2. **Run the interview (iteratively, in rounds):**
   - Start big: **vision** (why does this system exist, how should it feel?) and **goals**
     (what should be possible in the end, what explicitly not?).
   - Then drill into the mechanics topic by topic: one block per round, concrete decision
     questions. Use `AskUserQuestion` for real either/or decisions (with sensible options
     including trade-offs); open "tell me about it" questions go as plain text.
   - **Keep asking until it is decidable:** vague answers ("something like in game X") get
     follow-up questions instead of you filling the gap.
   - **Pushback is wanted:** if an answer contradicts existing decisions, the architecture
     (`CLAUDE.md`) or an earlier concept, say so immediately and let the user decide.
   - You do not have to settle everything: what the user deliberately leaves open, or what is
     balancing/detail work, goes into **open points** — as a documented gap, not a silent
     assumption.
   - In between: summarise the state briefly ("decided so far: …") so the user can correct
     course before it goes into the document.

3. **Write the document:** `<concepts>/<topic-kebab-case>.md` (follow the naming pattern of
   the existing files). Use the profile's `doc-language`. **Uniform format:**

   ```markdown
   # <Topic> — Concept

   Status: **Draft** (vision + requirements, no stories yet). <2–4 sentences: what this
   document fixes.>

   This document follows the architecture rules in [CLAUDE.md](../../CLAUDE.md): …
   <+ references to the systems/concepts it builds on.>

   ---

   ## TL;DR

   <Compact bullet overview: the vision in 1–2 sentences, the 5–10 most important
   decisions, the biggest open points. Whoever reads only this section knows the
   concept in outline.>

   ---

   ## 1. Vision
   <Why does the system exist, how does it feel — from the interview answers.>

   ## 2. Scope
   <Three lists, in this order — the distinction is the point:>

   ### In scope (v1)
   <What the first version does.>

   ### Deliberately not in v1
   <What is wanted but comes later — each with a rationale for the deferral,
   as a short "> Rationale: …" note under the list.>

   ### Non-goals (permanent)
   <What this will never do, and why. A permanent no is a decision worth keeping;
   without this section it gets re-proposed every few months.>

   ## 3. Design decisions taken (from the requirements interview)
   <Table | Topic | Decision | Rationale | — one row per resolved question. ONLY
   what the user answered; the rationale is the user's reason, not yours.>

   ## 4. Tech decisions
   <Only where this concept fixes technology. Table | Area | Choice | Rationale |
   with one row per area (runtime, language, UI, styling, build, packaging, state,
   tests, lint). Omit the section entirely when the concept adds nothing to the
   stack already in CLAUDE.md — an empty table is worse than none.>

   ## 5. Core terms & model
   <Terms, an ASCII flow diagram is welcome.>

   ## 6…n. <Topic sections>
   <The mechanics in detail, grouped by topic like the reference concepts.>

   ## n+1. Integration with existing systems (architecture notes)
   <Where it docks on: data, backend, client, tooling, persistence.>

   ## n+2. Requirements
   <Numbered, checkable requirements (e.g. XYZ-1, XYZ-2, …), grouped by topic.>

   ## n+3. Open points
   <Numbered list of everything still unresolved — every question not asked or
   deliberately deferred lands here.>
   ```

   **Open points get answered inline, not appended.** When the user resolves one during the
   review loop, write the answer into the section it belongs to, add the row to the decision
   table, and remove the item from the open-points list. A document where the body says "open"
   and a list at the end holds the answer has two truths; the list shrinking to nothing is what
   "this concept is decided" looks like.

4. **Review loop:** show the user the document (short summary + path), ask for corrections
   and work the feedback straight into the file. The command is done only once the user is
   satisfied.

5. **Close out:** add the new concept with one row to the roadmap's "Open / unprioritised"
   table: topic (linked to the concept), state as **one sentence** ("concept drafted
   <date>, N open points"), next step as one command (`/roadmap plan`). The open points, the
   rationale and the prototype references stay in the concept — the roadmap row points at it,
   it does not summarise it. Point out that prioritisation and story cutting happen later via
   `/roadmap plan` — **not** part of this command.

## Rules

- **No silent assumptions.** Every statement in the document is either an interview answer, a
  repo fact, or marked as an open point.
- **Do not invent balancing numbers.** Numbers are placeholders and marked as such unless the
  user explicitly decided them.
- **No stories/deliverables** in this command — only the concept document.
- Every concept must fit the guardrails in `CLAUDE.md`; raise conflicts during the interview.
- Do not commit, do not push. This command only writes the concept document (plus the one
  roadmap line).
