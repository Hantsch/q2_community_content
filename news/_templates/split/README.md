# `split` template

A two-pane layout: your body text on one side, an image on the other. Copy `template.md`, fill it
in, drop your image under `news/img/`, add one row to `news/index.json`, and you are done.

## Field set

This is the complete list of fields the launcher reads for `split`. Do not add fields that are not
listed here — an unsupported field is simply not read, it does not cause an error.

| Field | Required? | Notes |
| --- | --- | --- |
| `template` | required | must be `split` |
| `title` | required | the slide's headline |
| body text (after the closing `---`) | required | becomes the slide's body copy |
| `image` | required in practice | see "Missing fields" below |
| `order` | optional | sort key; see the top-level README's "Order" section |
| `visibleFrom` | optional | ISO date/time; omit to show from the moment it is published |
| `visibleUntil` | optional | ISO date/time; omit so the entry never expires on its own |
| `buttons` | optional, max 3 | each item is a `label` + `url` pair; see the top-level README's "Buttons" section |

## Missing fields

- Missing `title` or an empty body → the entry is **dropped entirely** from the feed.
- Missing `image` → `split` has nothing to put in its second pane without one, so the entry is
  **delivered as a plain `text` slide** instead of being dropped. It is not rejected, just
  downgraded.
- Missing `order` → the entry still shows, sorted after every entry that has a usable `order`
  value.
- Missing `visibleFrom` / `visibleUntil` → no restriction on that side (shows immediately / never
  expires on its own).
- More than 3 buttons → the extra ones are dropped silently; the first 3 still show.

## Image requirements

- **Accepted formats:** `png`, `jpeg`, `webp`.
- **Maximum file size:** 5 MB.
- **Maximum pixel dimension:** 4000 px on either side.
- **Recommended source size:** roughly square, e.g. **900×900 px** — the size this repository's own
  `split` example (`news/img/split-bootstrap.png`) uses. The image fills a 45%-wide column and is
  `object-fit: cover`, so a square (or portrait) source crops most predictably; a very wide image
  will have its sides cut off.

### Safe zone — what stays visible, and at what width

`split`'s image sits in a 45%-wide, `align-items: stretch` column and is `object-fit: cover` with
**no explicit `object-position`** (`home-hero.css`'s `.home-hero-media img` rule), which resolves
to the CSS default of `center`. Unlike a typical image box, this column's **width scales with the
window while its height stays roughly fixed** — measured at roughly 370×243 px at the launcher's
minimum window width (`WINDOW_MIN_WIDTH` = 940 px), widening to roughly 811×243 px at 1920 px. That
makes the column landscape (wider than tall), and **more landscape as the window widens**, not
less.

Against the recommended square (900×900 px) source, `object-fit: cover` always has to scale to the
column's **width** to fill it (the column is always wider, relative to its height, than the square
source), so **the full width of the source always survives** — nothing is ever cropped from the
left or right. What gets cropped is **top and bottom**: the safe zone is a horizontal band through
the vertical middle of the source, and that band gets *narrower* as the window widens, since a
wider column is relatively even shorter against the source's height.

Reasoned from that object-fit math (there is no `split`-specific `ui:flow` probe the way `cover`
has one, so these are not flow-measured numbers, just approximate): at the launcher's minimum
window width (940 px) roughly the **middle ~66%** of the source's height survives; at a wide
1920 px window that shrinks to roughly the **middle ~30%**. Keep your subject centred vertically
and keep anything you need to always show inside the middle third of the frame's height — the top
and bottom margins (at least ~17% each, more at wide windows) are what get cropped away first.

## Note on schema versions

Adding a template (like `cover`, introduced after `split`/`banner`/`text`) does not bump
`news/index.json`'s `schemaVersion` — it stays `1`. A backwards-compatible addition never forces
every older launcher build to show a "feed is ahead of this version" note.

## Worked example

This repository's own `news/2026-09-10-r1q2-in-the-bootstrap-wizard.md` is a real, published
`split` entry — read it alongside `news/index.json` for a complete example.
