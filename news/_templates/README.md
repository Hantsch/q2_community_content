# News templates — kit overview

Four templates, one folder each. Copy the `template.md` from the folder that matches what you are
posting, fill in its frontmatter, drop an image under `../img/` if the template needs one, add one
row to `../index.json`, and you are done. Each folder's own `README.md` has the complete field set,
image requirements and a worked example — this page is only the one-screen map to get you to the
right folder.

## Which template?

| You want to post... | Use | Needs an image? |
| --- | --- | --- |
| Text next to a supporting image, side by side | [`split`](./split/) | Required — falls back to `text` if omitted |
| A full-width strip, image optional | [`banner`](./banner/) | Optional |
| Title and body only, no image | [`text`](./text/) | No `image` field at all |
| A full-bleed hero image with text over its quieter side | [`cover`](./cover/) | Required — falls back to `text` if omitted |

`text` is also what every other template falls back to if it cannot be delivered as declared (for
example, a `split` or `cover` entry with no usable image) — as long as a title and body are still
present.

## What `index.json` needs per entry

One object in `entries`, alongside the `.md` file itself:

```json
{ "id": "example-entry", "file": "2026-09-10-example.md", "order": 10 }
```

- **`id`** (string, required) — stable and unique; a duplicate `id` keeps the first occurrence and
  drops the rest.
- **`file`** (string, required) — the `.md` file in `news/` that holds this entry's frontmatter and
  body.
- **`order`** (number, required) — sort key, ascending, lower first. Ties keep file order. Leave
  gaps (10/20/30) so a later entry can be inserted without renumbering.
- **`visibleFrom`** / **`visibleUntil`** (string, optional) — ISO 8601. Omit either one entirely
  instead of setting it to "now" or "never" — an entry with no `visibleFrom` is already visible
  immediately, and one with no `visibleUntil` already never expires on its own.

See the top-level `README.md` for the full contract (`schemaVersion`, dropped-entry rules, and the
"content only" constraint on what a `.md` file may contain).

## Buttons

Every template accepts the same optional `buttons` list, each item a `label` + `url` pair:

```yaml
buttons:
  - label: View the content repository
    url: https://github.com/Hantsch/q2_community_content
```

- **Maximum 3 buttons per entry** — a 4th and beyond is dropped silently; the entry still shows
  with its first 3.
- **`url` must be `https://` to `github.com` or `raw.githubusercontent.com` exactly** — no
  subdomains, no other host. A button that fails this is dropped, not the whole entry.
- A button missing a usable `label` or `url` is dropped the same way.

## The four kits

- [`split/`](./split/) — text and image side by side.
- [`banner/`](./banner/) — full-width strip, image optional.
- [`text/`](./text/) — title and body only.
- [`cover/`](./cover/) — full-bleed image-led hero.

Adding a template to this kit (as `cover` was, after `split`/`banner`/`text`) never bumps
`news/index.json`'s `schemaVersion` — it stays `1`.
