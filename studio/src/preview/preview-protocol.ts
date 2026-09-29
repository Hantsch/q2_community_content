import type { NewsSlide } from '../contract/launcher-contract'

/** Path of the standalone frame document that hosts the mirrored slide rendering. */
export const PREVIEW_FRAME_PATH = '/preview-frame.html'

/** Frame -> parent: the frame is mounted and listening for `render` messages. */
export type PreviewReadyMessage = { type: 'q2-preview:ready' }

/** Parent -> frame: render this slide. */
export type PreviewRenderMessage = { type: 'q2-preview:render'; slide: NewsSlide }

function hasType(data: unknown): data is { type: unknown } {
  return typeof data === 'object' && data !== null && 'type' in data
}

export function isReadyMessage(data: unknown): data is PreviewReadyMessage {
  return hasType(data) && data.type === 'q2-preview:ready'
}

export function isRenderMessage(data: unknown): data is PreviewRenderMessage {
  return (
    hasType(data) &&
    data.type === 'q2-preview:render' &&
    'slide' in data &&
    typeof data.slide === 'object' &&
    data.slide !== null
  )
}
