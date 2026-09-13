# q2_community_content

Community content for the Q2 Launcher, plus `studio/` — the local authoring and validation
tool for this repository. The published surface (`news/`, `engines/`, `gamedata/`, and the
reserved `packs/`, `mods/`, `config_templates/`) is content only; see `README.md` for the
contract the launcher reads.

<!-- tech-rules:managed:start 2.0.0 -->
## House rules

These rules live in this repository as project skills, so they apply to everyone who works here —
no plugin needed. Installed and updated with `/tech-rules:setup` (plugin `tech-rules@hantsch`).

| Read before | Skill |
| --- | --- |
| any code change | `/karpathy` |
| touching `studio/` | `/frontend-guidelines`, `/design-tokens` |

Do not edit a skill to make it fit this project. A deviation is recorded **here**, with its
reason, and wins over the skill; a deviation without a reason is a violation that has been
written down.
<!-- tech-rules:managed:end -->

## Project rules

- **Repository language is English** for everything authored here — docs, code comments,
  manifest descriptions, commit messages. See `AGENTS.md`.
- **The published surface carries no presentation.** Nothing under `news/`, `engines/`,
  `gamedata/`, `packs/`, `mods/` or `config_templates/` may contain CSS, HTML, colours, fonts
  or layout values — the launcher owns all of that. `studio/` is the one exception in this
  repository, and it is local tooling that the launcher never fetches.
- **`studio/src/launcher-core/` is mirrored, never hand-edited.** It is a verbatim copy of
  contract and render source from the `q2-launcher` repository, tracked by
  `studio/launcher-core.lock.json`. A change there belongs in the launcher, followed by a
  re-sync.
