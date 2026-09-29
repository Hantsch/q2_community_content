// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, render as renderBare, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { HERO_HEIGHT_PX, SlidePreview } from './SlidePreview'
import { PreviewWidthProvider } from '../../context/preview-width-context'
import { DEFAULT_PREVIEW_WIDTH } from '../../preview/preview-widths'
import type { NewsSlide } from '../../contract/launcher-contract'
import type { SlidePreviewModel } from '../../preview/preview-model'
import { PREVIEW_FRAME_PATH } from '../../preview/preview-protocol'

function render(ui: React.ReactElement) {
  return renderBare(ui, { wrapper: PreviewWidthProvider })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function slide(id: string, title: string): NewsSlide {
  return { id, template: 'text', order: 1, title, body: `${title} body.`, buttons: [] }
}

const welcome = slide('welcome', 'Welcome')
const update = slide('update', 'Patch notes')

function slideModel(value: NewsSlide): SlidePreviewModel {
  return { state: 'slide', slide: value }
}

function frame(): HTMLIFrameElement {
  return screen.getByTitle<HTMLIFrameElement>('Slide preview')
}

function frameWindow(): Window {
  const contentWindow = frame().contentWindow
  if (!contentWindow) throw new Error('The preview frame has no window.')
  return contentWindow
}

function spyOnFramePosts() {
  return vi.spyOn(frameWindow(), 'postMessage').mockImplementation(() => undefined)
}

function sendReady(
  source: Window = frameWindow(),
  origin: string = window.location.origin,
  data: unknown = { type: 'q2-preview:ready' },
): void {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, source, origin }))
  })
}

function renderMessage(value: NewsSlide) {
  return [{ type: 'q2-preview:render', slide: value }, window.location.origin] as const
}

test('the frame is the launcher-sized preview document', () => {
  render(<SlidePreview model={slideModel(welcome)} />)

  expect(frame().getAttribute('src')).toBe(PREVIEW_FRAME_PATH)
  expect(frame().getAttribute('width')).toBe(String(DEFAULT_PREVIEW_WIDTH))
  expect(frame().getAttribute('height')).toBe(String(HERO_HEIGHT_PX))
  expect(frame().hidden).toBe(false)
})

test('nothing is posted before the frame is ready', () => {
  const { rerender } = render(<SlidePreview model={slideModel(welcome)} />)
  const post = spyOnFramePosts()

  rerender(<SlidePreview model={slideModel(update)} />)

  expect(post).not.toHaveBeenCalled()
})

test('the current slide is posted on ready', () => {
  render(<SlidePreview model={slideModel(welcome)} />)
  const post = spyOnFramePosts()

  sendReady()

  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(welcome))
})

test('a ready after a model change gets the latest slide', () => {
  const { rerender } = render(<SlidePreview model={slideModel(welcome)} />)
  const post = spyOnFramePosts()
  rerender(<SlidePreview model={slideModel(update)} />)

  sendReady()

  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(update))
})

test('a new model is posted without remounting the iframe', () => {
  const { rerender } = render(<SlidePreview model={slideModel(welcome)} />)
  const before = frame()
  const post = spyOnFramePosts()
  sendReady()

  rerender(<SlidePreview model={slideModel(update)} />)
  expect(frame()).toBe(before)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(update))

  rerender(<SlidePreview model={{ state: 'nothing', reason: 'Expired.' }} />)
  rerender(<SlidePreview model={{ state: 'idle' }} />)
  rerender(<SlidePreview model={slideModel(welcome)} />)
  expect(frame()).toBe(before)
  expect(frame().hidden).toBe(false)
  expect(post).toHaveBeenCalledTimes(3)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(welcome))
})

test('a ready from another source is ignored', () => {
  render(<SlidePreview model={slideModel(welcome)} />)
  const post = spyOnFramePosts()

  sendReady(window)
  sendReady(frameWindow(), 'https://elsewhere.example')
  sendReady(frameWindow(), window.location.origin, { type: 'something-else' })

  expect(post).not.toHaveBeenCalled()
})

test('the nothing state shows its reason and hides the frame', () => {
  render(<SlidePreview model={{ state: 'nothing', reason: 'Scheduled — shown from May 1.' }} />)

  const notice = screen.getByRole('status')
  expect(within(notice).getByRole('heading', { name: 'Nothing would be shown' })).toBeTruthy()
  expect(within(notice).getByText('Scheduled — shown from May 1.')).toBeTruthy()
  expect(frame().hidden).toBe(true)
})

test('the idle state asks for a selection', () => {
  render(<SlidePreview model={{ state: 'idle' }} />)

  expect(screen.getByText('Select an entry to preview it.')).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  expect(frame().hidden).toBe(true)
})

test('under StrictMode one ready posts exactly once and the frame is not remounted', () => {
  const { rerender } = render(
    <StrictMode>
      <SlidePreview model={slideModel(welcome)} />
    </StrictMode>,
  )
  const before = frame()
  const post = spyOnFramePosts()

  sendReady()
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(welcome))

  rerender(
    <StrictMode>
      <SlidePreview model={slideModel(update)} />
    </StrictMode>,
  )
  expect(frame()).toBe(before)
  expect(post).toHaveBeenLastCalledWith(...renderMessage(update))
})

test('nothing is posted after unmount', () => {
  const { unmount } = render(<SlidePreview model={slideModel(welcome)} />)
  const frameWindowBeforeUnmount = frameWindow()
  const post = spyOnFramePosts()
  unmount()

  sendReady(frameWindowBeforeUnmount)

  expect(post).not.toHaveBeenCalled()
})
