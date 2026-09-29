/**
 * Story 023 D4: whether the slide body in the preview frame is cut off. Measurement only - it reads
 * the frame's real layout and never counts characters or assumes a per-template limit, so the same
 * body can fit at one preview width and be cut at another.
 *
 * A body counts as cut when either
 * - the launcher's line clamp on `.home-hero-body` is hiding lines (`scrollHeight` beyond
 *   `clientHeight`), or
 * - its bottom edge lies below the bottom of its nearest `overflow: hidden` ancestor inside
 *   `.home-hero` (the hero itself included), which clips it without any clamp being involved.
 *
 * The 1px tolerance absorbs sub-pixel rounding between the integer `scrollHeight`/`clientHeight`
 * and the fractional `getBoundingClientRect` values.
 */

const TOLERANCE_PX = 1

function clipsOverflow(style: CSSStyleDeclaration): boolean {
  return [style.overflow, style.overflowY].some((value) => value === 'hidden' || value === 'clip')
}

function nearestClippingAncestor(body: Element, hero: Element, view: Window): Element | null {
  for (let node = body.parentElement; node; node = node.parentElement) {
    if (clipsOverflow(view.getComputedStyle(node))) return node
    if (node === hero) return null
  }
  return null
}

export function measureBodyOverflow(doc: Document): boolean {
  const view = doc.defaultView
  const hero = doc.querySelector('.home-hero')
  const body = hero?.querySelector('.home-hero-body')
  if (!view || !hero || !body) return false

  if (body.scrollHeight > body.clientHeight + TOLERANCE_PX) return true

  const clip = nearestClippingAncestor(body, hero, view)
  if (!clip) return false
  return body.getBoundingClientRect().bottom > clip.getBoundingClientRect().bottom + TOLERANCE_PX
}
