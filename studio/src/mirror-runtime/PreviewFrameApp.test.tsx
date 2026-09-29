// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PreviewFrameApp } from './PreviewFrameApp'
import { textSlideFixture } from './slideFixtures'

function post(data: unknown, init: { source?: MessageEventSource | null; origin?: string } = {}) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        source: init.source === undefined ? window.parent : init.source,
        origin: init.origin ?? window.location.origin,
      }),
    )
  })
}

const renderMessage = { type: 'q2-preview:render', slide: textSlideFixture }

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('PreviewFrameApp', () => {
  it('the frame posts ready to its parent on mount', () => {
    const spy = vi.spyOn(window.parent, 'postMessage')
    render(<PreviewFrameApp />)
    expect(spy).toHaveBeenCalledWith({ type: 'q2-preview:ready' }, window.location.origin)
  })

  it('a render message from the parent renders the mirrored template inside the hero shell', () => {
    const { container } = render(<PreviewFrameApp />)
    expect(container.firstChild).toBeNull()
    post(renderMessage)
    expect(
      container.querySelector(
        '.home-hero > .home-hero-stage > .home-hero-frame > .home-hero-slide-text',
      ),
    ).not.toBeNull()
  })

  it('a message from another origin or source is ignored', () => {
    const { container } = render(<PreviewFrameApp />)
    post(renderMessage, { origin: 'https://evil.example' })
    post(renderMessage, { source: null })
    expect(container.firstChild).toBeNull()
  })
})
