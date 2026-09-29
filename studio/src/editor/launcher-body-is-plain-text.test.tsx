// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  bannerSlideFixture,
  coverSlideFixture,
  splitSlideFixture,
  textSlideFixture,
} from '../mirror-runtime/slideFixtures'
import { TEMPLATE_COMPONENTS } from '../mirror-runtime/slideTemplates'

/**
 * Drift guard for the body lint: it warns because the launcher shows the body as plain text. If a
 * launcher re-sync ever starts rendering markdown or HTML, this fails and the lint must be revisited.
 */
const BODY = '**bold** [l](https://x) <b>h</b>'

afterEach(cleanup)

describe('launcher body rendering', () => {
  it('the mirrored slides render the body as plain text', () => {
    const slides = [
      [TEMPLATE_COMPONENTS.text, textSlideFixture],
      [TEMPLATE_COMPONENTS.split, splitSlideFixture],
      [TEMPLATE_COMPONENTS.cover, coverSlideFixture],
      [TEMPLATE_COMPONENTS.banner, bannerSlideFixture],
    ] as const
    for (const [Component, fixture] of slides) {
      const { container, unmount } = render(
        <Component slide={{ ...fixture, body: BODY }} onOpenUrl={() => {}} />,
      )
      const bodyEl = container.querySelector('.home-hero-body')
      expect(bodyEl, fixture.template).not.toBeNull()
      expect(bodyEl!.children.length, fixture.template).toBe(0)
      expect(bodyEl!.textContent, fixture.template).toBe(BODY)
      unmount()
    }
  })
})
