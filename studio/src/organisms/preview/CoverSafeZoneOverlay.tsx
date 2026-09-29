/**
 * Story 026 D4: the text safe zone of a delivered `cover`, drawn in the studio document over the
 * preview frame. The box is MEASURED from `.home-hero-slide-cover .home-hero-content` in the frame
 * document (same origin), never derived from the launcher's 45 % / max-width / margin rules.
 * Nothing is injected into the frame: this overlay is a sibling of the iframe, `pointer-events: none`.
 *
 * Re-measured on: frame `load`, a new slide or width, a frame resize, a change inside the frame
 * document (the frame renders asynchronously after a `render` message), and a ResizeObserver on
 * both the iframe and the measured element.
 */
import { useEffect, useRef, useState } from 'react'

const CONTENT_SELECTOR = '.home-hero-slide-cover .home-hero-content'

interface Box {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface CoverSafeZoneOverlayProps {
  /** The iframe; the overlay's containing block is its offset parent (a `relative` wrapper). */
  readonly frame: HTMLIFrameElement | null
  readonly frameDoc: Document | null
  /** Changes whenever the previewed slide changes (entry or image). */
  readonly slide: unknown
  readonly width: number
}

export function CoverSafeZoneOverlay({
  frame,
  frameDoc,
  slide,
  width,
}: CoverSafeZoneOverlayProps): React.JSX.Element | null {
  const [box, setBox] = useState<Box | null>(null)
  const measureRef = useRef<() => void>(() => undefined)

  useEffect(() => {
    const view = frameDoc?.defaultView
    if (!frame || !frameDoc || !view) return
    function measure(): void {
      const host = frame?.parentElement
      const target = frameDoc?.querySelector(CONTENT_SELECTOR)
      if (!frame || !host || !target) {
        setBox(null)
        return
      }
      const hostRect = host.getBoundingClientRect()
      const frameRect = frame.getBoundingClientRect()
      const rect = target.getBoundingClientRect()
      const scale = frame.clientWidth > 0 ? frameRect.width / frame.clientWidth : 1
      setBox({
        left: frameRect.left - hostRect.left + rect.left * scale,
        top: frameRect.top - hostRect.top + rect.top * scale,
        width: rect.width * scale,
        height: rect.height * scale,
      })
    }
    measureRef.current = measure
    const resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(frame)
    const observeTarget = (): void => {
      resizeObserver.disconnect()
      resizeObserver.observe(frame)
      const target = frameDoc.querySelector(CONTENT_SELECTOR)
      if (target) resizeObserver.observe(target)
      measure()
    }
    const mutationObserver = new view.MutationObserver(observeTarget)
    mutationObserver.observe(frameDoc, { childList: true, subtree: true, characterData: true })
    frame.addEventListener('load', observeTarget)
    view.addEventListener('resize', measure)
    observeTarget()
    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      frame.removeEventListener('load', observeTarget)
      view.removeEventListener('resize', measure)
      measureRef.current = () => undefined
    }
  }, [frame, frameDoc])

  useEffect(() => {
    measureRef.current()
  }, [frame, frameDoc, slide, width])

  if (!box) return null
  return (
    <div
      data-testid="cover-safe-zone"
      role="img"
      aria-label="Text safe zone"
      className="pointer-events-none absolute rounded-md border-2 border-dashed border-selected bg-selected-soft/40"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
    />
  )
}
