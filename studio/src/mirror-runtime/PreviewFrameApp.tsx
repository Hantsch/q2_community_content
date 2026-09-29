import { useEffect, useState } from 'react'

import { resolveSlideTemplate } from '../launcher-core/src/renderer/src/modules/home/components/resolveSlideTemplate'
import type { NewsSlide } from '../contract/launcher-contract'
import { isRenderMessage } from '../preview/preview-protocol'
import { TEMPLATE_COMPONENTS } from './slideTemplates'

function noopOpenUrl(): void {
  // The preview never navigates - see `SlideButtons.tsx`'s `onOpenUrl` prop.
}

/**
 * Content of `preview-frame.html`: waits for a `render` message from the embedding parent and
 * shows that slide in the launcher's hero shell. The shell's class lists are copied from the
 * launcher's `src/renderer/src/modules/home/NewsHero.tsx` (q2-launcher), minus
 * `home-hero-frame-enter`. Renders nothing until the first message.
 */
export function PreviewFrameApp(): React.JSX.Element | null {
  const [slide, setSlide] = useState<NewsSlide | null>(null)

  useEffect(() => {
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent || event.origin !== window.location.origin) return
      if (isRenderMessage(event.data)) setSlide(event.data.slide)
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'q2-preview:ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!slide) return null
  const Component = TEMPLATE_COMPONENTS[resolveSlideTemplate(slide)]
  return (
    <section className="home-hero h-80 shrink-0 border-b border-line bg-panel">
      <div className="home-hero-stage">
        <div className="home-hero-frame" data-testid="preview-frame-slide">
          <Component slide={slide} onOpenUrl={noopOpenUrl} />
        </div>
      </div>
    </section>
  )
}
