// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { measureBodyOverflow } from './measure-body-overflow'

/**
 * jsdom has no layout, so the geometry the launcher's CSS would produce is stubbed per element:
 * `scrollHeight`/`clientHeight` for the line clamp, `getBoundingClientRect().bottom` for clipping.
 */

interface Geometry {
  readonly scrollHeight?: number
  readonly clientHeight?: number
  readonly bottom?: number
}

function stub(element: Element, { scrollHeight = 0, clientHeight = 0, bottom = 0 }: Geometry) {
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ bottom }) as DOMRect,
  })
}

function mountHero(): { hero: HTMLElement; column: HTMLElement; body: HTMLElement } {
  document.body.innerHTML = `
    <section class="home-hero" style="overflow: hidden">
      <div class="home-hero-stage">
        <div class="home-hero-content"><p class="home-hero-body">Body</p></div>
      </div>
    </section>`
  const hero = document.querySelector<HTMLElement>('.home-hero')!
  const column = document.querySelector<HTMLElement>('.home-hero-content')!
  const body = document.querySelector<HTMLElement>('.home-hero-body')!
  stub(hero, { bottom: 320 })
  stub(column, { bottom: 276 })
  return { hero, column, body }
}

afterEach(() => {
  document.body.innerHTML = ''
})

test('a clamped or hero-clipped body counts as overflow, a fitting one does not', () => {
  const { column, body } = mountHero()

  // Fits: nothing hidden by the clamp, bottom inside the hero (sub-pixel rounding tolerated).
  stub(body, { scrollHeight: 90, clientHeight: 90, bottom: 200 })
  expect(measureBodyOverflow(document)).toBe(false)
  stub(body, { scrollHeight: 91, clientHeight: 90, bottom: 320.5 })
  expect(measureBodyOverflow(document)).toBe(false)

  // Clamped: the line clamp hides lines, wherever the box itself ends.
  stub(body, { scrollHeight: 180, clientHeight: 90, bottom: 200 })
  expect(measureBodyOverflow(document)).toBe(true)

  // Hero-clipped: no clamp involved, but the box runs past the hero's clipping edge.
  stub(body, { scrollHeight: 90, clientHeight: 90, bottom: 340 })
  expect(measureBodyOverflow(document)).toBe(true)

  // The nearest clipping ancestor wins over the hero: a hidden-overflow column clips earlier.
  column.style.overflow = 'hidden'
  stub(body, { scrollHeight: 90, clientHeight: 90, bottom: 300 })
  expect(measureBodyOverflow(document)).toBe(true)
  stub(body, { scrollHeight: 90, clientHeight: 90, bottom: 270 })
  expect(measureBodyOverflow(document)).toBe(false)

  // No slide body in the frame (nothing rendered, or the entry is dropped): nothing is cut.
  document.body.innerHTML = '<section class="home-hero"></section>'
  expect(measureBodyOverflow(document)).toBe(false)
})
