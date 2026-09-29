/**
 * Story 018 D3: the slide preview organism. Renders `SlidePreviewModel` (D1) as-is and drives the
 * isolated preview frame (`PREVIEW_FRAME_PATH`) over the `q2-preview:*` protocol (D2).
 *
 * The handshake, and why it is shaped this way:
 * - The frame document says `ready` once its listener exists. Nothing is posted before that, since
 *   a render posted earlier would be lost silently.
 * - The latest slide lives in a ref, so a `ready` that arrives after a model change still gets the
 *   current slide, and a reloaded frame (which says `ready` again) is re-rendered too.
 * - The iframe is always mounted and never keyed: switching entries or states must not reload its
 *   document. Non-slide states only set the `hidden` attribute. No display utility goes on the
 *   iframe, because one would override `[hidden]`.
 * - The frame is `width` px wide at a real viewport (no scaling); the wrapper scrolls when that is
 *   wider than the window.
 * - Only a `ready` from this component's own frame window, on this origin, is accepted.
 */
import { useEffect, useRef, useState } from 'react'
import { usePreviewWidth } from '../../context/preview-width-context'
import { PreviewWidthSwitcher } from '../../molecules/preview/PreviewWidthSwitcher'
import type { SlidePreviewModel } from '../../preview/preview-model'
import { decidePreviewVisibility } from '../../preview/visibility-override'
import {
  PREVIEW_FRAME_PATH,
  isReadyMessage,
  type PreviewRenderMessage,
} from '../../preview/preview-protocol'
import { VisibilityOverrideMarker, VisibilityOverrideSwitch } from './VisibilityOverrideControl'

/** The launcher's hero slot height. */
export const HERO_HEIGHT_PX = 320

export interface SlidePreviewProps {
  readonly model: SlidePreviewModel
}

type PreviewedSlide = PreviewRenderMessage['slide']

function postRender(frame: HTMLIFrameElement, slide: PreviewedSlide): void {
  const message: PreviewRenderMessage = { type: 'q2-preview:render', slide }
  frame.contentWindow?.postMessage(message, window.location.origin)
}

export function SlidePreview({ model }: SlidePreviewProps): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const slideRef = useRef<PreviewedSlide | null>(null)
  const frameReadyRef = useRef(false)
  const { width, setWidth } = usePreviewWidth()

  // Story 021: the override is local to this preview and lasts for one held entry only. It is
  // never stored, put in the URL or handed to anything the library or validation panel reads.
  const held = model.state === 'nothing' ? model.held : undefined
  const heldId = held?.verdict.id ?? null
  const [override, setOverride] = useState(false)
  const [overrideFor, setOverrideFor] = useState<string | null>(null)
  if (overrideFor !== heldId) {
    setOverrideFor(heldId)
    setOverride(false)
  }
  const decision = held ? decidePreviewVisibility(held.verdict, override) : undefined
  const overridden = decision?.kind === 'render' && decision.override ? decision : undefined

  const slide = model.state === 'slide' ? model.slide : (overridden && held?.slide) || null

  useEffect(() => {
    slideRef.current = slide
    const frame = frameRef.current
    if (frameReadyRef.current && frame && slide) postRender(frame, slide)
  }, [slide])

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      const frame = frameRef.current
      if (!frame || event.source !== frame.contentWindow) return
      if (event.origin !== window.location.origin || !isReadyMessage(event.data)) return
      frameReadyRef.current = true
      if (slideRef.current) postRender(frame, slideRef.current)
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      // A remounted component gets a fresh frame document, which announces itself again.
      frameReadyRef.current = false
    }
  }, [])

  return (
    <section aria-label="Slide preview" className="flex min-w-0 flex-col gap-2">
      <PreviewWidthSwitcher width={width} onChange={setWidth} />
      {model.state === 'idle' && <p className="text-text-muted">Select an entry to preview it.</p>}
      {model.state === 'nothing' && !overridden && (
        <div role="status" className="flex flex-col gap-1">
          <h2 className="font-medium">Nothing would be shown</h2>
          <p className="text-text-muted">
            {decision?.kind === 'hidden' ? decision.reason : model.reason}
          </p>
        </div>
      )}
      {decision?.overrideAvailable && (
        <VisibilityOverrideSwitch checked={override} onChange={setOverride} />
      )}
      {overridden && <VisibilityOverrideMarker realState={overridden.realState} />}
      <div data-testid="preview-scroll" className="max-w-full overflow-x-auto">
        <iframe
          ref={frameRef}
          title="Slide preview"
          src={PREVIEW_FRAME_PATH}
          width={width}
          height={HERO_HEIGHT_PX}
          hidden={slide === null}
          className="block shrink-0 border-0"
          // Dynamic value: no utility class can carry a runtime px, and min-width is what stops a
          // flex/grid ancestor shrinking the frame below its real viewport width.
          style={{ minWidth: width }}
        />
      </div>
    </section>
  )
}
