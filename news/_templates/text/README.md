# `text` template

Title and body only — no image. This is also the shape every other template falls back to when it
cannot be delivered as declared (a `split`/`cover` entry missing its image, or an unrecognised
`template` value, as long as a title and body exist). Copy `template.md`, fill it in, add one row to
`news/index.json`, and you are done.

## Field set

This is the complete list of fields the launcher reads for `text`. Do not add fields that are not
listed here — an unsupported field is simply not read, it does not cause an error. There is no
`image` field for this template at all.

| Field | Required? | Notes |
| --- | --- | --- |
| `template` | required | must be `text` |
| `title` | required | the slide's headline |
| body text (after the closing `---`) | required | becomes the slide's body copy |
| `order` | optional | sort key; see the top-level README's "Order" section |
| `visibleFrom` | optional | ISO date/time; omit to show from the moment it is published |
| `visibleUntil` | optional | ISO date/time; omit so the entry never expires on its own |
| `buttons` | optional, max 3 | each item is a `label` + `url` pair; see the top-level README's "Buttons" section |

## Missing fields

- Missing `title` or an empty body → the entry is **dropped entirely** from the feed. There is no
  further fallback below `text` — it is the fallback.
- Missing `order` → the entry still shows, sorted after every entry that has a usable `order`
  value.
- Missing `visibleFrom` / `visibleUntil` → no restriction on that side (shows immediately / never
  expires on its own).
- More than 3 buttons → the extra ones are dropped silently; the first 3 still show.

## Note on schema versions

Adding a template (like `cover`, introduced after `split`/`banner`/`text`) does not bump
`news/index.json`'s `schemaVersion` — it stays `1`. A backwards-compatible addition never forces
every older launcher build to show a "feed is ahead of this version" note.

## Worked example

This repository's own `news/2026-09-10-how-news-reaches-the-launcher.md` is a real, published
`text` entry — read it alongside `news/index.json` for a complete example.
