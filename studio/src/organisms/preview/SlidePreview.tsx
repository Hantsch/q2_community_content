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
 *
 * Story 026 D4: a delivered `cover` gets a measured text safe zone overlay (`CoverSafeZoneOverlay`)
 * as a sibling of the frame, inside a relative box; the frame itself stays untouched.
 *
 * Story 023 D4: whether the body is cut off is measured in the frame document itself (same
 * origin), see `useBodyOverflow`. The notice sits in studio chrome, outside the frame.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePreviewWidth } from '../../context/preview-width-context'
import { measureBodyOverflow } from '../../editor/measure-body-overflow'
import { PreviewWidthSwitcher } from '../../molecules/preview/PreviewWidthSwitcher'
import type { SlidePreviewModel } from '../../preview/preview-model'
import { decidePreviewVisibility } from '../../preview/visibility-override'
import {
  PREVIEW_FRAME_PATH,
  isReadyMessage,
  type PreviewRenderMessage,
} from '../../preview/preview-protocol'
import { CoverSafeZoneOverlay } from './CoverSafeZoneOverlay'
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

interface OverflowVerdict {
  readonly width: number
  readonly cut: boolean
}

/**
 * Re-measures the frame's body after each of three independent triggers, because any one of them
 * can change the verdict on its own:
 * - a render inside the frame (the body changed) - a MutationObserver on the frame document, since
 *   the frame renders asynchronously after the `render` message and the parent cannot know when;
 * - a width change - the frame window's `resize`, plus the `width` dependency itself;
 * - a font load - every measurement first waits for `document.fonts.ready` of the frame, and a
 *   later `loadingdone` measures again, since swapping in the launcher font re-wraps the text.
 * Every trigger takes a new token; a measurement whose token is no longer the latest (for example
 * a font promise resolving after a newer render or width) is discarded. The verdict records the
 * width it was measured at, and is only shown while that is still the current width.
 */
function useBodyOverflow(
  frameDoc: Document | null,
  slide: PreviewedSlide | null,
  width: number,
): OverflowVerdict | null {
  const [verdict, setVerdict] = useState<OverflowVerdict | null>(null)
  const widthRef = useRef(width)
  const tokenRef = useRef(0)
  const scheduleRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const view = frameDoc?.defaultView
    if (!frameDoc || !view) return
    const fonts = frameDoc.fonts as FontFaceSet | undefined // jsdom has no FontFaceSet
    let active = true
    function schedule(): void {
      const token = ++tokenRef.current
      void (fonts?.ready ?? Promise.resolve()).then(() => {
        if (!active || token !== tokenRef.current || !frameDoc) return
        setVerdict({ width: widthRef.current, cut: measureBodyOverflow(frameDoc) })
      })
    }
    scheduleRef.current = schedule

    // The frame realm's own constructor: a node of another document is observed from its realm.
    const observer = new view.MutationObserver(schedule)
    observer.observe(frameDoc, {
      childList: true,
      subtree: true,
      characterData: true,
    })
    view.addEventListener('resize', schedule)
    fonts?.addEventListener('loadingdone', schedule)
    schedule()
    return () => {
      observer.disconnect()
      view.removeEventListener('resize', schedule)
      fonts?.removeEventListener('loadingdone', schedule)
      scheduleRef.current = () => undefined
      active = false
    }
  }, [frameDoc])

  useEffect(() => {
    widthRef.current = width
    scheduleRef.current()
  }, [slide, width])

  return verdict && verdict.width === width ? verdict : null
}

export function SlidePreview({ model }: SlidePreviewProps): React.JSX.Element {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const [frameEl, setFrameEl] = useState<HTMLIFrameElement | null>(null)
  const attachFrame = useCallback((element: HTMLIFrameElement | null) => {
    frameRef.current = element
    setFrameEl(element)
  }, [])
  const slideRef = useRef<PreviewedSlide | null>(null)
  const frameReadyRef = useRef(false)
  const [frameDoc, setFrameDoc] = useState<Document | null>(null)
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
  const overflow = useBodyOverflow(frameDoc, slide, width)
  const [showSafeZone, setShowSafeZone] = useState(true)
  const isCover = slide?.template === 'cover'

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
      setFrameDoc(frame.contentDocument)
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
      {slide !== null && overflow?.cut && (
        <p
          data-testid="body-overflow"
          aria-live="polite"
          className="rounded-md border border-severity-warning-border bg-severity-warning-soft px-3 py-2 text-severity-warning"
        >
          Body is cut off at {width}px — the launcher shows only what fits
        </p>
      )}
      {isCover && (
        <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 rounded-md border border-muted-border px-3 text-text focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-selected">
          <input
            type="checkbox"
            role="switch"
            checked={showSafeZone}
            onChange={(event) => setShowSafeZone(event.target.checked)}
            className="size-5 shrink-0"
          />
          <span>Show text safe zone</span>
        </label>
      )}
      <div data-testid="preview-scroll" className="max-w-full overflow-x-auto">
        <div className="relative w-fit">
          <iframe
            ref={attachFrame}
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
          {isCover && showSafeZone && (
            <CoverSafeZoneOverlay frame={frameEl} frameDoc={frameDoc} slide={slide} width={width} />
          )}
        </div>
      </div>
    </section>
  )
}
