# Hantsch/q2_community_content

Community content for [Q2 Launcher](https://github.com/Hantsch/q2-launcher): the news feed shown
on the launcher's home screen, plus engine and gamedata packages the launcher's download module
fetches. This repository splits into two groups. The published surface — `news/`, `engines/`,
`gamedata/`, and the reserved `packs/`, `mods/`, `config_templates/` — is content only: it is
fetched over the network by installed copies of the launcher, it is never a code dependency, and
it carries no presentation of its own (see "Content only" below). `studio/` is local tooling: it
runs on the contributor's machine to author and validate content, and it is never fetched by the
launcher.

Nothing here is fetched by push — pushing to this repository does not reach every launcher
instantly. The launcher polls on its own schedule and caches what it last saw.

## Top-level layout

```
news/               the home-screen news feed (documented in full below)
  index.json
  <slug>.md          one file per entry, referenced by index.json
  img/               images referenced by entries
  _templates/        copy-and-fill starter kit, one folder per template (see below)
packs/               reserved for future content types — not read by the launcher yet
mods/                reserved for future content types — not read by the launcher yet
config_templates/    reserved for future content types — not read by the launcher yet
engines/             engine packages the launcher's download module can install
  manifest.json
gamedata/            game-data packages (demo, point-release, ...) the download module can install
  manifest.json
studio/              local authoring and validation tool — never fetched by the launcher
```

`news/`, `engines/`, `gamedata/`, `packs/`, `mods/` and `config_templates/` are the published
surface the launcher fetches; `studio/` is local tooling for contributors and is never fetched.

`engines/manifest.json` and `gamedata/manifest.json` each list downloadable packages (id, version,
size, checksum, source URL and mirrors) that the launcher's download module reads to offer engine
and game-data installs. Their exact shape is out of scope for this document — this README's full
contract is for `news/` only, described below.

`packs/`, `mods/` and `config_templates/` exist as directories from day one so the top-level layout
does not need to change shape when those content types arrive. Each currently contains only a
placeholder `README.md` stating it is reserved; the launcher does not read any of them yet, and
`config_templates/`'s eventual `index.json` shape (if it gets one) is intentionally not sketched
here.

## The news feed (`news/`)

The launcher's home screen shows a small carousel of slides built from this directory. A
contributor only ever needs to touch `news/index.json`, one `.md` file per entry, and (for image
templates) a file under `news/img/` — the launcher owns everything about how a slide looks.

### `news/index.json`

A JSON object with two top-level fields:

- **`schemaVersion`** (number) — the version of this contract the feed is written against.
  Currently always `1`. A launcher that understands an older version than the feed's still shows
  whatever it can read; it does not reject the whole feed over a version bump.
- **`entries`** (array) — one object per slide, in any order (see "Order" below for how display
  order is actually decided). Each entry has:
  - **`id`** (string, required) — a stable, unique identifier for the entry. If two entries share
    an `id`, the first one (in file order) is kept and the rest are dropped.
  - **`file`** (string, required) — the `.md` file in this same directory that holds the entry's
    frontmatter and body, e.g. `"2026-09-10-example.md"`.
  - **`order`** (number, required) — the sort key used to place this slide among the others. See
    "Order" below.
  - **`visibleFrom`** (string, optional) — an ISO 8601 date/time string. The entry is not shown
    before this instant. Omit it entirely if the entry should be visible from the moment it is
    published.
  - **`visibleUntil`** (string, optional) — an ISO 8601 date/time string. The entry stops being
    shown after this instant. Omit it entirely if the entry should never expire on its own.

Example:

```json
{
  "schemaVersion": 1,
  "entries": [
    { "id": "example-entry", "file": "2026-09-10-example.md", "order": 10 }
  ]
}
```

### The `.md` files

Each entry's `.md` file is a YAML frontmatter block, followed by `---` on its own line, followed by
the markdown body text that becomes the slide's body copy.

There are four templates, selected by the frontmatter's `template` field. Every field below is
the complete field set the launcher understands for that template — do not add fields that are
not listed here (no `imageSide`, no `tag`, no anything else); an unsupported field is simply not
read.

A copy-and-fill starter kit exists for every template under `news/_templates/<template>/`
(`template.md` to copy plus a `README.md` with the full field set, image requirements and a worked
example). Start at `news/_templates/README.md` for the one-screen "which template do I want"
overview.

Common to all templates:

- **`template`** (string, required) — one of `split`, `banner`, `text`, `cover`.
- **`title`** (string, required) — the slide's headline.
- **`order`** (number) — see "Order" below. In practice this matches the `order` given for the
  same entry in `index.json`.
- **`visibleFrom`** / **`visibleUntil`** (string, optional) — ISO date strings, same meaning as in
  `index.json`.
- **`buttons`** (list, optional) — see "Buttons" below.
- The markdown body **after** the closing `---` — everything from there to the end of the file —
  becomes the slide's body text.

Per-template fields, on top of the common ones:

- **`split`** — a two-pane layout: text on one side, an image on the other.
  - **`image`** (string) — a path to an image file, relative to this `.md` file's own directory
    (in practice `img/<file>.png`). `split` is built around having an image; an entry declared as
    `split` with no usable image falls back to being shown as a plain `text` slide instead of being
    dropped, since a two-pane layout has nothing to put in its second pane without one.
- **`banner`** — a full-width strip, optionally backed by an image.
  - **`image`** (string, optional) — same path rule as `split`. Unlike `split`, `banner` is a full
    banner with or without an image, so omitting it is a normal, supported choice, not a fallback
    trigger.
- **`text`** — title and body only. No `image` field. This is also the shape every other template
  falls back to when it cannot be delivered as declared (see "Dropped entries" below).
- **`cover`** — a full-bleed, image-led hero: the image fills the whole slide, anchored to its
  right edge, with title/body/buttons over its quieter left side inside a scrim the launcher
  renders itself.
  - **`image`** (string) — same path rule as `split`. `cover` is built around having an image; an
    entry declared as `cover` with no usable image falls back to being shown as a plain `text`
    slide instead of being dropped, the same as `split`.

Minimal `split` example:

```markdown
---
template: split
title: r1q2 now installs from the bootstrap wizard
image: img/split-bootstrap.png
order: 10
visibleFrom: 2026-08-01T00:00:00Z
buttons:
  - label: View r1q2 on GitHub
    url: https://github.com/r1q2/r1q2
---
The bootstrap wizard can now fetch and install r1q2 directly as part of
setting up a new Quake II installation.
```

This repository's own `news/` directory carries a real, published example for `split`
(`2026-09-10-r1q2-in-the-bootstrap-wizard.md`), `banner`
(`2026-09-10-the-community-content-repository.md`), `text`
(`2026-09-10-how-news-reaches-the-launcher.md`) and `cover`
(`2026-09-12-welcome-to-the-community.md`) — read those alongside `index.json` for a complete
worked example. The starter kit at `news/_templates/cover/` (`template.md` plus a `README.md`
covering its image requirements and safe zone) is still the right place to start a new `cover`
entry from.

### Buttons

`buttons` is an optional list under the frontmatter, each item shaped as:

```yaml
buttons:
  - label: View the content repository
    url: https://github.com/Hantsch/q2_community_content
```

Rules, strictly enforced by the launcher:

- **Maximum 3 buttons per entry.** A 4th button (and beyond) is silently dropped; the entry itself
  still shows with its first 3.
- **`url` must be an `https://` link whose host is exactly `github.com` or
  `raw.githubusercontent.com`.** No subdomains (`gist.github.com` does not qualify), no other host
  of any kind. A button that fails this check is dropped — it does not cause an error or drop the
  rest of the entry, it is simply left off the slide.
- A button missing a usable `label` or `url` is dropped the same way.

### Visibility (`visibleFrom` / `visibleUntil`) and order

- An entry with **no `visibleFrom`** is visible from the very start (as soon as the launcher sees
  it) — there is no need to set `visibleFrom` to "now" or to a past date just to make an entry show
  up immediately.
- An entry with **no `visibleUntil`** never expires on its own.
- **`order`** sorts entries ascending (lower numbers first). Two entries with the same `order`
  value keep their original order from `index.json` (a stable sort) rather than being reordered
  arbitrarily. An entry with a missing or unparseable `order` sorts after every entry that has a
  usable one.

Leave gaps between `order` values (this repository uses 10/20/30/40) so a future entry can be inserted
between two existing ones without renumbering everything else.

### Content only

A contributor supplies **content only**: title, body text, an image file, button labels and URLs,
and the visibility/order fields above. Nothing under the published surface (`news/`, `engines/`,
`gamedata/`, `packs/`, `mods/`, `config_templates/`) may contain CSS, HTML, colours, fonts or any
other layout or presentation value — the launcher owns all of that. If a slide looks wrong, that
is a launcher change, not a content change.

### Dropped entries

The feed is defensive by design, but "unrecognised" and "broken" are handled differently:

- **An unknown `template` value is not dropped.** It falls back to a plain `text` slide, the same
  fallback `split`/`cover` use when their image is missing — as long as the entry still has a usable
  `title` and body, it stays in the feed. This is what lets an older launcher build read a feed
  written for a template it does not know about yet.
- **An entry that is actually broken — missing `title` or an empty body, frontmatter that fails to
  parse, an index entry missing `id` or `file`, and so on — is dropped on its own.** The rest of the
  feed is still shown; a single bad entry can never take down or blank out the whole news feed, at
  worst it is simply absent from the carousel.

## Reserved directories

`packs/`, `mods/` and `config_templates/` are placeholders for content types the launcher does not
support yet. Each contains only a short README saying so. Do not add real content there until a
future story defines its contract — this repository's job today is to document and carry exactly
what is described above.
