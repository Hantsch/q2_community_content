# `banner` template

A full-width title/body strip, optionally backed by an image. Copy `template.md`, fill it in, drop
your image under `news/img/` if you want one, add one row to `news/index.json`, and you are done.

## Field set

This is the complete list of fields the launcher reads for `banner`. Do not add fields that are not
listed here — an unsupported field is simply not read, it does not cause an error.

| Field | Required? | Notes |
| --- | --- | --- |
| `template` | required | must be `banner` |
| `title` | required | the slide's headline |
| body text (after the closing `---`) | required | becomes the slide's body copy |
| `image` | optional | see "Missing fields" below — `banner` works with or without one |
| `order` | optional | sort key; see the top-level README's "Order" section |
| `visibleFrom` | optional | ISO date/time; omit to show from the moment it is published |
| `visibleUntil` | optional | ISO date/time; omit so the entry never expires on its own |
| `buttons` | optional, max 3 | each item is a `label` + `url` pair; see the top-level README's "Buttons" section |

## Missing fields

- Missing `title` or an empty body → the entry is **dropped entirely** from the feed.
- Missing `image` → `banner` is a full banner with or without an image, so omitting it is a
  **normal, supported choice**, not a fallback trigger — the slide still shows as `banner`, just
  without an image.
- Missing `order` → the entry still shows, sorted after every entry that has a usable `order`
  value.
- Missing `visibleFrom` / `visibleUntil` → no restriction on that side (shows immediately / never
  expires on its own).
- More than 3 buttons → the extra ones are dropped silently; the first 3 still show.

## Image requirements

- **Accepted formats:** `png`, `jpeg`, `webp`.
- **Maximum file size:** 5 MB.
- **Maximum pixel dimension:** 4000 px on either side.
- **Recommended source size:** a wide strip, e.g. **1600×480 px** (10:3) — the size this
  repository's own `banner` example (`news/img/banner-repository.png`) uses. The image fills a
  45%-tall, full-width strip and is `object-fit: cover`, so a wide source crops most predictably; a
  narrow/tall image will have its top and bottom cut off.

### Safe zone — what stays visible, and at what width

`banner`'s image sits in a full-width, 45%-tall strip and is `object-fit: cover` with **no explicit
`object-position`** (`home-hero.css`'s `.home-hero-media img` rule), which resolves to the CSS
default of `center`. The strip's **height is a fixed fraction of the hero while its width scales
with the window** — measured at roughly 822×109 px at the launcher's minimum window width
(`WINDOW_MIN_WIDTH` = 940 px), widening to roughly 1802×109 px at 1920 px. That makes the strip
very wide relative to its height, and **wider still, relatively, as the window widens**.

Against the recommended wide (1600×480 px) source, `object-fit: cover` always has to scale to the
strip's **width** to fill it (the strip is always far wider, relative to its height, than the
source), so **the full width of the source always survives** — nothing is ever cropped from the
left or right. What gets cropped is **top and bottom**: the safe zone is a horizontal band through
the vertical middle of the source, and that band gets *narrower* as the window widens.

Reasoned from that object-fit math (there is no `banner`-specific `ui:flow` probe the way `cover`
has one, so these are not flow-measured numbers, just approximate): at the launcher's minimum
window width (940 px) roughly the **middle ~44%** of the source's height survives; at a wide
1920 px window that shrinks to roughly the **middle ~20%**. Keep your subject centred vertically
and keep anything you need to always show inside the middle fifth of the frame's height — the top
and bottom margins are what get cropped away first, and they grow as the window widens.

## Note on schema versions

Adding a template (like `cover`, introduced after `split`/`banner`/`text`) does not bump
`news/index.json`'s `schemaVersion` — it stays `1`. A backwards-compatible addition never forces
every older launcher build to show a "feed is ahead of this version" note.

## Worked example

This repository's own `news/2026-09-10-the-community-content-repository.md` is a real, published
`banner` entry — read it alongside `news/index.json` for a complete example.
