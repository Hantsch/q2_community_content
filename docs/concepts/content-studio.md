# Q2 Content Studio — Concept

Status: **Draft** (vision + requirements, no stories yet — see [ROADMAP.md](../ROADMAP.md) for
status). This document fixes what the Content Studio is: a local authoring and validation tool
that lives inside this repository and lets a contributor write, preview, validate and manage
content **before** publishing it, instead of discovering how it looks after the launcher has
fetched it. It covers the news feed in v1 and is built so the other content types slot in later.

This document follows the architecture rules in [CLAUDE.md](../../CLAUDE.md): the published
surface stays content-only, and `studio/src/launcher-core/` is mirrored from the launcher rather
than reimplemented. It builds on the news contract in [README.md](../../README.md), section "The
news feed", which remains the single source of truth for what a contributor may write.

---

## TL;DR

- **Vision:** one command in this repository opens a studio where you see a news post exactly as
  the launcher will render it, are told plainly what the launcher will do with it, and can fix it
  before anyone else sees it.
- **Standalone:** no `q2-launcher` checkout, no Electron build. Node and a browser are enough.
- **Mirrored, not rebuilt:** the launcher's contract code (schemas, feed pipeline, frontmatter)
  and its slide rendering (components, hero CSS, tokens) are copied verbatim into
  `studio/src/launcher-core/` with a hash lock, so the preview is provably identical or provably
  stale — never vaguely "about right".
- **Content studio, not news studio:** every content type is a descriptor in a registry. News is
  the first; `packs/`, `mods/`, `config_templates/`, `engines/`, `gamedata/` are listed from day
  one, so adding one later is a descriptor, not a rewrite.
- **The report is the point:** the studio names the launcher's silent behaviour — a `cover` that
  falls back to `text` because its image is missing, a button dropped for its host, an entry
  hidden by `visibleFrom`, an entry dropped entirely.
- **Drafts without publishing:** a `.md` file that is not in `index.json` is previewable without
  touching the repository.
- **Open:** the zero-install browser variant, and how far the studio may write to `index.json`
  unattended.

---

## 1. Vision

Writing a news post today is a blind act. The templates exist and the contract is documented, but
the only way to see the result is to publish and wait for a launcher to poll. Worse, the contract
is deliberately forgiving: an entry with a missing image is not rejected, it is quietly downgraded
to a plain `text` slide; a button pointing at the wrong host is not an error, it is simply gone.
Every one of those rules protects the feed at runtime and hides a mistake from the author.

The studio turns that around. It is a local surface where the content of this repository is
visible as content — a library of what exists, what is published, what is scheduled, what is still
a draft — and where the launcher's own judgement about each entry is stated out loud before
publishing. It should feel less like a build tool and more like a small editorial desk: open it,
see the feed, write, see it, ship it.

It is also the place where the repository's other content types will become manageable. Today they
are reserved directories with placeholder READMEs. The studio is designed so that giving `packs/`
a contract later means writing a descriptor, not building a second tool.

## 2. Scope

### In scope (v1)

- A local application in `studio/`, started from this repository, that needs no `q2-launcher`
  checkout to run.
- A mirror of the launcher's news contract and slide rendering, with a sync command, a hash lock
  and a drift check.
- A library view of `news/`: published entries, scheduled entries, expired entries and drafts.
- A pixel-faithful preview of a single entry at the three widths the launcher itself tests
  against (940 / 1280 / 1920).
- A validation report per entry (delivered template, fallback reason, dropped reason, rejected
  buttons, visibility state) and per repository (duplicate ids, order collisions, orphan drafts,
  unreferenced images).
- A headless `validate` command with the same verdicts, for use before publishing.
- An editor for a news entry: frontmatter fields, body, image drop, save back to `.md` and
  `index.json`, new entry from the `_templates/` kit, reorder, publish/unpublish a draft.
- A content-type registry with `news` implemented and the remaining types listed as reserved.

### Deliberately not in v1

- **Contracts for `packs/`, `mods/`, `config_templates/`.** They have no format yet; the studio
  only has to be shaped so they fit.

  > Rationale: designing a content format is its own concept, not a side effect of tooling.

- **Editing `engines/manifest.json` and `gamedata/manifest.json`.** They are listed and may be
  validated later; the studio does not write them in v1.

  > Rationale: a wrong checksum or URL there breaks installs for every user, a much higher blast
  > radius than a badly formatted news post. It deserves its own story set.

- **A zero-install browser variant** (File System Access API, no Node).

  > Rationale: it costs Firefox and Safari support and a second file-access path to maintain.
  > Worth revisiting once there is evidence contributors are blocked by `npm install`.

- **Publishing from the studio** (any git or network action).

  > Rationale: see the non-goals.

- **Multi-repository support.** The studio operates on the repository it lives in.

  > Rationale: nothing needs it, and a repo-path argument invites writing into the wrong tree.

### Non-goals (permanent)

- **The studio never becomes the renderer.** If a slide looks wrong in the preview and wrong in
  the launcher, that is a launcher change. The studio must never gain its own layout for launcher
  content, because the moment it does, the preview stops being evidence.
- **The studio never ships to end users.** It is authoring tooling; it is not fetched by the
  launcher and is not part of the content contract.
- **The studio never commits, pushes or publishes.** It writes files in the working tree. What
  leaves this machine stays a deliberate human act.
- **The published surface never gains presentation.** `studio/` is the single exception in this
  repository, and it is not part of the published surface.

## 3. Design decisions taken (from the requirements interview)

| Topic | Decision | Rationale |
| --- | --- | --- |
| Shape of the tool | A standalone studio, not a mode of the launcher | The user wants one place to manage and validate the content repository, independent of launcher development |
| Naming and scope | "Content Studio", not "News Studio" | It should be extensible to the other content types later, so the name must not narrow it on day one |
| Audience | Contributors without a `q2-launcher` checkout must be able to use it | News should be writable by the community, not only by whoever builds the launcher |
| Location | Inside this repository, under `studio/` | One clone gets a contributor everything they need to write and check a post |
| Preview fidelity | Mirror the launcher's rendering rather than approximate it | An approximate preview is worse than none: it teaches the author a layout that is not the real one |

## 4. Tech decisions

| Area | Choice | Rationale |
| --- | --- | --- |
| Runtime | Node 22 | Matches the launcher's `engines` field; nothing here needs a second runtime |
| Language | TypeScript | The mirrored launcher sources are TypeScript and must compile unchanged |
| UI | React 19 | The mirrored slide components are React; a second framework would mean rewriting them |
| Build / dev server | Vite | Shortest path from `npm run studio` to a working page; also what the launcher's renderer uses |
| Preview isolation | The preview renders inside an iframe | It gives the mirrored CSS a document of its own (no bleed in either direction) and makes the 940/1280/1920 switch a real viewport, so media queries and container widths behave as they do in the launcher |
| Contract source | Mirrored verbatim from `q2-launcher` into `studio/src/launcher-core/`, hash-locked | A reimplementation drifts silently and would make the report lie; a mirror can be proven in sync |
| Validation engine | The mirrored feed pipeline itself, not a second rule set | The report then states what the launcher actually does, by construction |
| File access | A Vite dev-server plugin confined to the repository root | Keeps the browser UI while writing real files; the confinement is what keeps that safe |
| Tests | Vitest (unit), Playwright (e2e) | Unit for the contract and report logic, e2e for the authoring flow through the real surface |
| Lint / format | ESLint + Prettier | Matches the launcher's setup, so a contributor moving between repos sees one style |

## 5. Core terms & model

- **Published surface** — everything the launcher fetches: `news/`, `engines/`, `gamedata/`, and
  the reserved directories. Content only, no presentation.
- **Entry** — one news post: a row in `news/index.json` plus its `.md` file, plus any image.
- **Draft** — a `.md` file in `news/` with no row in `index.json`. Invisible to the launcher,
  previewable in the studio.
- **Declared** — what the author wrote (`template: cover`, three buttons, an image path).
- **Delivered** — what the launcher will actually show after its own pipeline has run (maybe
  `text`, maybe two buttons, maybe nothing at all).
- **Mirror** — the verbatim copy of launcher sources under `studio/src/launcher-core/`.
- **Drift** — the mirror no longer matching the launcher checkout it came from.
- **Descriptor** — one content type's registration in the studio: its directory, index file,
  schema, validators, editor fields and preview component.

```
news/ (working tree)
   |
   |  read
   v
[ repo reader ] --raw index + documents--> [ mirrored feed pipeline ] --slides-->
   |                                              |
   |                                              +--> [ report: declared vs delivered ]
   |                                                        |
   +--> [ library view ] <----------------------------------+
   |                                                        |
   +--> [ editor ] --write--> news/*.md, news/index.json     |
                                                             v
                                        [ preview iframe: mirrored slide components ]
```

## 6. The mirror, and why it is the load-bearing idea

The studio's entire claim — "this is what it will look like, and this is what the launcher will do
with it" — rests on the preview and the report coming from the launcher's own code. So the mirror
is not a convenience, it is the correctness argument.

- **Sync** (`npm run sync:launcher -- --launcher <path>`) copies a fixed list of files from a
  `q2-launcher` checkout into `studio/src/launcher-core/` and writes
  `studio/launcher-core.lock.json`: per file a SHA-256, plus the launcher commit the copy came
  from.
- **Drift check** (`npm run check:drift`) recomputes those hashes. Against a present launcher
  checkout it compares with the launcher's current sources and fails on any difference. With no
  checkout on the machine — the normal case for a community contributor — it verifies only the
  mirror's internal integrity and exits 0 with a skip line, the same convention the launcher's own
  `scripts/check-content-repo.mjs` uses.
- **Provenance is shown, not buried.** The studio names the launcher commit its rendering came
  from, so a preview from a months-old mirror is visibly that.
- **Never hand-edited.** A rendering bug found in the studio is fixed in the launcher and
  re-synced. This is recorded in `CLAUDE.md` because it is the rule most likely to be broken under
  time pressure.

The mirrored set is small enough for this to be practical: the contract is
`src/shared/modules/home.ts`, `feed-pipeline.ts` and `frontmatter.ts` (~860 lines, one dependency:
`zod`); the rendering is the four slide components plus `SlideButtons.tsx`,
`resolveSlideTemplate.ts`, `home-hero.css` and the design-token subset it reads.

## 7. What the report has to say

The report is per entry and states the launcher's verdict in the author's terms:

- **delivered as X** — and where that differs from what was declared, the reason (`cover` becomes
  `text` because the image `img/hero.png` was not found).
- **dropped** — with the rule that dropped it (no title, empty body, unparseable frontmatter, an
  index row without `id` or `file`, a duplicate `id`).
- **buttons** — which ones survive, and why one did not (host not `github.com` or
  `raw.githubusercontent.com`, missing label or url, more than three).
- **visibility** — published now, scheduled until a date, or expired since one.
- **order** — the position it will take, and a warning where two entries collide.

Repository-level findings sit next to it: images in `news/img/` nothing references, `.md` files
nothing indexes, ids used twice, names that violate the launcher's safe-name rule.

## 8. Extensibility: one registry, many content types

A content type registers a descriptor: its directory, its index file (if it has one), its schema,
its validators, the editor fields it offers and the component that previews it. The registry drives
the studio's navigation, so a reserved type appears with an honest state ("reserved — the launcher
does not read this yet") rather than being absent. v1 implements `news` and registers the rest as
reserved.

## 9. Integration with existing systems (architecture notes)

- **This repository:** a new top-level `studio/` directory. `README.md` gains a boundary statement
  — the published surface stays content-only, `studio/` is local tooling and is never fetched.
- **`q2-launcher`:** the source of the mirror. Its `scripts/check-content-repo.mjs` verifies this
  repository's top-level layout and pins a commit; it has to learn that `studio/` exists,
  otherwise it fails the moment the first story lands. That is a coordinated change in the
  launcher repository, not a side effect.
- **Verification harness:** this repository has none today (`.claude/ai-scrum.md` records
  `build`/`test`/`lint`/`typecheck`/`e2e` as `none`). The studio brings one, and the profile is
  updated to point at it — which is what lets every later story map its acceptance criteria to
  real tests.

## 10. Requirements

**Foundation**

- **CS-1** — `studio/` exists in this repository and is started with a single documented command.
- **CS-2** — The studio runs without a `q2-launcher` checkout.
- **CS-3** — `README.md` states the boundary: the published surface is content-only; `studio/` is
  local tooling and is never fetched by the launcher.
- **CS-4** — This repository has typecheck, lint, unit-test and e2e commands, recorded in
  `.claude/ai-scrum.md`.

**Mirror**

- **CS-5** — A sync command copies the fixed file list from a launcher checkout and writes a lock
  with a hash per file and the source commit.
- **CS-6** — A drift check fails on a mismatch against a present launcher checkout and skips
  cleanly when none exists.
- **CS-7** — The mirrored contract code runs unmodified in the studio.
- **CS-8** — The mirrored slide components render unmodified in the studio.
- **CS-9** — The launcher commit behind the mirror is visible in the studio and in the CLI.

**Validation**

- **CS-10** — The studio reads `news/` from the working tree without modifying it.
- **CS-11** — Every entry gets a declared-vs-delivered verdict, with a reason wherever the two
  differ.
- **CS-12** — A headless command produces the same verdicts and exits non-zero on an error.
- **CS-13** — Repository-level findings are reported: duplicate ids, order collisions, orphan
  drafts, unreferenced images, unsafe names.

**Surface**

- **CS-14** — A registry drives the studio's content types; `news` is implemented and the reserved
  types are listed with their state.
- **CS-15** — The library lists every entry and every draft with its status.
- **CS-16** — A selected entry is previewed with the mirrored renderer.
- **CS-17** — The preview can be switched between 940, 1280 and 1920 pixels wide.
- **CS-18** — A draft is previewable without being written into `index.json`.
- **CS-19** — An entry outside its visibility window can be previewed as if it were visible.

**Authoring**

- **CS-20** — Frontmatter is edited through fields, with validation shown while typing.
- **CS-21** — The body is edited with the preview updating.
- **CS-22** — Saving writes the `.md` file and, where the entry is published, its `index.json` row.
- **CS-23** — A new entry can be created from the `_templates/` kit.
- **CS-24** — An image can be added to `news/img/` through the studio, refusing names the launcher
  would reject.
- **CS-25** — Entries can be reordered, and a draft can be published or unpublished.

**v1 readiness**

- **CS-26** — A contributor quickstart exists.
- **CS-27** — Adding a new content type is documented.
- **CS-28** — The full authoring flow is proven end to end through the real surface.

## 11. Open points

1. **Zero-install variant.** Is `npm install` an acceptable barrier for community contributors, or
   should a File System Access API variant follow in v1.1? Deferred, not decided.
2. **How far the studio may write unattended.** Saving a `.md` is uncontroversial; rewriting
   `index.json` (ordering, adding rows) touches the file the launcher reads first. v1 assumes the
   studio writes it and the human reviews the diff before committing — to be confirmed.
3. **Formatting of written files.** Whether the writer must preserve byte-for-byte formatting of
   untouched entries in `index.json`, or may reformat the whole file, is unresolved; it decides how
   noisy a save looks in a diff.
4. **Where the launcher-side change lands.** `scripts/check-content-repo.mjs` has to accept
   `studio/`; whether that happens as a story here or in the launcher's own backlog needs a call.
5. **Validation of `engines/`/`gamedata/` manifests.** Read-only validation would be cheap and
   useful; it is out of v1 scope but may be worth pulling forward.
6. **Does the studio need to run fully offline?** Fonts are the only likely network dependency;
   bundling them locally is easy but has a licence check attached.
