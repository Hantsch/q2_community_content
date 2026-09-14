---
id: 009
title: Mirror provenance is reported, not buried
status: ready # draft -> ready -> in-progress -> done
created: 2026-09-13
---

## Requirement

A preview rendered from a six-month-old mirror looks exactly like a preview rendered from a current
one. That is the whole problem: the staleness has no visible symptom until someone publishes a post
that looks different in the real launcher.

The lock file from story 005 already knows the answer. This story makes it something a person is
told rather than something they could look up — in the command line output and as data the studio's
surface can display once it exists.

Concept: [Q2 Content Studio](../concepts/content-studio.md) — CS-9, section 6.

## Acceptance Criteria

- [ ] **AC1** — A provenance module reports the launcher commit, the sync date, the number of
      mirrored files and the drift verdict, derived from the lock file and the files on disk.
- [ ] **AC2** — The command-line output of the drift check names the launcher commit the mirror came
      from.
- [ ] **AC3** — The provenance is available to the studio surface as structured data, not only as
      printed text.
- [ ] **AC4** — A mirror whose hashes no longer match is reported as out of sync, with the same
      wording in every place provenance is shown.
- [ ] **AC5** — Provenance survives a fresh clone: it is read from the committed lock file and needs
      no launcher checkout and no git history to produce.
- [ ] **AC6** — A missing or unparseable lock file is reported as "provenance unknown" rather than
      crashing or silently reporting a clean mirror.

## Open Questions

- ~~Should the studio refuse to preview when out of sync, or warn?~~ answered → Decisions (Sprint).
- ~~Is the launcher commit alone enough, or should the lock also record a human-readable
  version/tag?~~ answered → Decisions (Sprint).
- ~~Does provenance need an age threshold to be useful?~~ answered → Decisions (Sprint).
- ~~Does CS-9's "visible in the studio" mean a rendered UI in this sprint?~~ answered → Decisions
  (Sprint); noted for the sprint review, because it is the one part of CS-9 that S02 does not close.

## Decisions (Sprint)

- **(User)** Out-of-sync behaviour: warn, don't block. The preview renders with a persistent
  warning; a contributor stays unblocked while someone else re-syncs.
- No version/tag in the lock: the launcher commit stays the single identity, displayed short
  (12 chars) next to the sync date — a tag need not exist in a checkout, and adding a field would
  change story 005's lock contract for a purely cosmetic gain.
- No age threshold: the module reports `ageInDays` derived from the sync date as a plain fact, but
  never turns it into a verdict — staleness is decided by hashes (story 006), and a clock-based
  warning would fire on a mirror that is simply still correct.
- One verdict vocabulary, owned here: `in-sync` / `out-of-sync` / `unknown` with their printable
  labels live in the provenance module, and story 006's drift CLI prints them from there — the same
  wording in every place (AC4) is only enforceable if there is exactly one place it is written.
- The module lives in `studio/src/mirror/`, not in `studio/src/launcher-core/`: the mirrored tree is
  a verbatim copy and must stay hand-edit-free (CLAUDE.md).
- Provenance reaches the studio surface as a build-time virtual module, not a runtime fetch: the
  surface is a browser bundle and cannot hash files on disk, so Vite computes it once at dev-server
  boot and at build.
- No provenance UI in this sprint: CS-9's "visible in the studio" half lands with the studio's first
  real surface (M4/S04); S02 delivers the structured data it will bind to, per the sprint note that
  nothing here is user-visible.

## Plan

Small story, three moving parts. It runs last in S02 and consumes what 005 (lock file) and 006
(drift CLI) built; it adds no npm script of its own.

1. **Core** — `studio/src/mirror/provenance.ts`: the `MirrorProvenance` type, the verdict
   vocabulary (`in-sync` / `out-of-sync` / `unknown`) with its printable labels, a pure
   `describeMirror(lock, diskHashes)` and a `formatProvenance(p): string[]` for CLI output. No
   `node:fs` in this file — it is imported by browser code too.
2. **Node reader** — `studio/src/mirror/read-provenance.ts`: reads `studio/launcher-core.lock.json`,
   hashes the mirrored files on disk (SHA-256, same normalisation as 005/006), hands both to
   `describeMirror`. A missing, unreadable or unparseable lock returns `unknown` with a reason;
   it never throws and never reports a clean mirror. Reads no git, no launcher checkout.
3. **CLI** — the drift check entry point from story 006 prints `formatProvenance(...)` as its
   header line before its own findings, so "which launcher commit" is stated on every run, and
   006's own in-sync/out-of-sync wording comes from the shared labels.
4. **Surface** — a Vite plugin in `studio/vite.config.ts` exposes `virtual:mirror-provenance`,
   resolved via `read-provenance.ts` at dev-server boot and at build, so browser code gets the
   same structured object without touching the filesystem.

Order: 1 → (2 with 1) → 3, 4 independent. Nothing outside `studio/` is written; the published
surface is untouched; `studio/src/launcher-core/` is only ever read.

Depends on 005 (lock shape) and 006 (drift CLI entry point). If 006 named its script differently
than `studio/scripts/check-drift.ts`, use the name that exists — do not add a second CLI.

## Deliverables

- **D1 — Provenance core (pure).** `studio/src/mirror/provenance.ts`: `MirrorVerdict`,
  `MirrorProvenance` (`verdict`, `launcherCommit`, `launcherCommitShort`, `syncedAt`, `ageInDays`,
  `fileCount`, `mismatchedFiles[]`, `reason`), `describeMirror()`, `VERDICT_LABELS` and
  `formatProvenance()`. Plus its tests in `studio/src/mirror/provenance.test.ts`.
  *Accepted when:* a lock whose hashes all match yields `in-sync`; one changed hash yields
  `out-of-sync` and names the file; `ageInDays` follows from `syncedAt` and gates nothing.
- **D2 — Node reader.** `studio/src/mirror/read-provenance.ts` plus
  `studio/src/mirror/read-provenance.test.ts` (fixtures under `studio/src/mirror/__fixtures__/`).
  *Accepted when:* a lock + mirror copied into a temp directory with no `.git` and no launcher
  checkout produces full provenance; a missing and a truncated-JSON lock each produce
  `unknown` with a reason and no throw.
- **D3 — Drift CLI header.** Touches only the drift entry point from 006 (expected
  `studio/scripts/check-drift.ts`) and adds `studio/tests/drift-provenance.test.ts`, which spawns
  the real `npm run check:drift`. *Accepted when:* the output names the launcher commit from the
  lock, and 006's out-of-sync wording is the label exported by D1 (no second string literal).
- **D4 — `virtual:mirror-provenance`.** Vite plugin in `studio/vite.config.ts` (or
  `studio/src/mirror/provenance-plugin.ts` imported there) plus
  `studio/tests/provenance-virtual-module.test.ts`, booting Vite the way
  `studio/tests/dev-server.test.ts` does and loading the module via `ssrLoadModule`.
  *Accepted when:* the module's default export is the same JSON-serialisable `MirrorProvenance`
  object the CLI printed.

## Model Hints

- D1, D2, D3, D4 → default tier. Each is one small, single-layer file plus its test, with no
  regression surface beyond itself.
- Review: → default. Three new files in a fresh directory and one header line in an existing CLI;
  no cross-module subtlety to unpick.

## Acceptance Tests

- AC1 → unit `studio/src/mirror/provenance.test.ts` › "reports launcher commit, sync date, file
  count and verdict from the lock and the files on disk" (D1)
- AC2 → cli `studio/tests/drift-provenance.test.ts` › "`npm run check:drift` names the launcher
  commit the mirror came from" — spawns the real command, asserts the commit from
  `studio/launcher-core.lock.json` appears in stdout (D3)
- AC3 → integration `studio/tests/provenance-virtual-module.test.ts` › "the studio surface imports
  mirror provenance as structured data" (D4)
- AC4 → unit `studio/src/mirror/provenance.test.ts` › "a mirrored file whose hash changed is
  reported as out of sync, naming the file" plus `studio/tests/drift-provenance.test.ts` › "the
  CLI prints the module's out-of-sync label, not its own wording" (D1, D3)
- AC5 → unit `studio/src/mirror/read-provenance.test.ts` › "produces provenance from a lock copy
  with no git history and no launcher checkout" (D2)
- AC6 → unit `studio/src/mirror/read-provenance.test.ts` › "a missing or unparseable lock file is
  provenance unknown, not a clean mirror" (D2)

No `manual residue`. No Playwright criterion: no AC here describes a user action in the studio UI —
AC2's real surface is the command itself, which the test invokes for real. **Gap for the sprint
review:** CS-9's "visible in the studio" half is data-only after S02; the rendered warning that the
(User) decision describes binds to `virtual:mirror-provenance` in M4/S04.

## Done

<Filled by `/build 009`.>
