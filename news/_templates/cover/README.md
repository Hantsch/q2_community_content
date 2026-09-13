# `cover` template

An image-led, full-bleed slide: your image fills the whole slide behind the text, anchored to the
slide's **right** edge, with title/body/buttons over its quieter left side inside a scrim the
launcher itself renders (you never need to darken the image yourself). Copy `template.md`, fill it
in, drop your image under `news/img/`, add one row to `news/index.json`, and you are done.

## Field set

This is the complete list of fields the launcher reads for `cover`. Do not add fields that are not
listed here — an unsupported field is simply not read, it does not cause an error.

| Field | Required? | Notes |
| --- | --- | --- |
| `template` | required | must be `cover` |
| `title` | required | the slide's headline |
| body text (after the closing `---`) | required | becomes the slide's body copy |
| `image` | required in practice | see "Missing fields" below |
| `order` | optional | sort key; see the top-level README's "Order" section |
| `visibleFrom` | optional | ISO date/time; omit to show from the moment it is published |
| `visibleUntil` | optional | ISO date/time; omit so the entry never expires on its own |
| `buttons` | optional, max 3 | each item is a `label` + `url` pair; see the top-level README's "Buttons" section |

## Missing fields

- Missing `title` or an empty body → the entry is **dropped entirely** from the feed.
- Missing `image` → `cover` has nothing to lead with without one, so the entry is **delivered as a
  plain `text` slide** instead of being dropped. It is not rejected, just downgraded.
- Missing `order` → the entry still shows, sorted after every entry that has a usable `order`
  value.
- Missing `visibleFrom` / `visibleUntil` → no restriction on that side (shows immediately / never
  expires on its own).
- More than 3 buttons → the extra ones are dropped silently; the first 3 still show.

## Image requirements

- **Accepted formats:** `png`, `jpeg`, `webp`.
- **Maximum file size:** 5 MB.
- **Maximum pixel dimension:** 4000 px on either side.
- **Recommended source size: 2560×640 px (4:1).** This matches the hero's own aspect ratio and
  covers the widest supported windows without needing to upscale much.

### Safe zone — what stays visible, and at what width

`cover` is right-anchored: **the image's right edge is always fully visible**, at every supported
window width, down to the launcher's minimum (`WINDOW_MIN_WIDTH` = 940 px). As the window narrows,
the image loses area from its **left** side, never the right.

There is a crossover, measured against the real rendered hero:

- **Below roughly 1100 px of slide width** (≈1187 px window width) — the image is scaled to the
  slide's height and is cropped horizontally from the left. The narrower the window, the more is
  cropped away on the left.
- **At or above roughly 1100 px of slide width** — the image is never cropped horizontally; it is
  scaled to the slide's width instead and only cropped vertically, centred top/bottom.

Measured guarantees, so you know what to keep inside the frame:

- The **rightmost ~78%** of the image's width (measured fraction 0.775) is what remains visible at
  the narrowest supported window. Keep your subject, logo or any text baked into the image inside
  that right-hand ~78% — the left ~22% is a "may be cropped away" margin at small widths.
- The **middle ~60%** of the image's height (measured fraction 0.601) is what remains visible across
  every tested width. Keep important detail out of the very top and bottom ~20% of the image.
- The launcher's own text column sits over the left side of the slide (`width: 45%; max-width:
  560px`) inside a gradient scrim — this is what carries contrast for the title/body/buttons, not
  the image. You do not need to darken your image or leave a plain area for the text; just avoid
  putting your most important visual content directly under the left ~45% if you want it to read
  clearly rather than sit under the scrim.

## Note on schema versions

Adding a template (like `cover`, introduced after `split`/`banner`/`text`) does not bump
`news/index.json`'s `schemaVersion` — it stays `1`. A backwards-compatible addition never forces
every older launcher build to show a "feed is ahead of this version" note. A launcher build that
predates `cover` still shows a `cover` entry, just as a plain `text` slide.
