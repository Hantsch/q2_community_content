import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { SlideBanner } from '../launcher-core/src/renderer/src/modules/home/components/SlideBanner'
import { SlideCover } from '../launcher-core/src/renderer/src/modules/home/components/SlideCover'
import { SlideSplit } from '../launcher-core/src/renderer/src/modules/home/components/SlideSplit'
import { SlideText } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'
import { resolveSlideTemplate } from '../launcher-core/src/renderer/src/modules/home/components/resolveSlideTemplate'
import type { SlideTemplateProps } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'
import { slideFixtures } from './slideFixtures'
// Side-effect only: pulls in the mirrored stylesheet graph and fonts. Deliberately not imported
// by the studio shell (`main.tsx`) - only this standalone diagnostic root uses it (D4/D5).
import './mirrorStyles'

/**
 * `mirror-check.html`'s mount script (story 008 D5, AC3/AC4/AC6 - live-browser proof that the
 * mirrored rendering set actually works outside of jsdom): renders every fixture in
 * `slideFixtures.ts` through the same, unmodified `SlideText`/`SlideSplit`/`SlideBanner`/
 * `SlideCover` components `mirroredSlides.test.tsx` (D3) already exercises in jsdom, one per DOM
 * node, so `e2e/mirrored-rendering.spec.ts` has something to inspect with a real browser: real
 * computed styles, real font loading, a real decoded image.
 *
 * A diagnostic page, not product UI - no chrome, no routing, just every slide stacked in fixture
 * order with a stable `data-testid` per slide for the e2e spec to target.
 */

const TEMPLATE_COMPONENTS = {
  text: SlideText,
  split: SlideSplit,
  banner: SlideBanner,
  cover: SlideCover,
} as const satisfies Record<
  ReturnType<typeof resolveSlideTemplate>,
  (props: SlideTemplateProps) => React.JSX.Element
>

function noopOpenUrl(): void {
  // The mirror-check page never actually navigates - see `SlideButtons.tsx`'s `onOpenUrl` prop.
}

const container = document.getElementById('mirror-check-root')
if (!container) throw new Error('#mirror-check-root is missing from mirror-check.html')

createRoot(container).render(
  <StrictMode>
    <>
      {slideFixtures.map((slide) => {
        const Component = TEMPLATE_COMPONENTS[resolveSlideTemplate(slide)]
        return (
          <div key={slide.id} data-testid={`mirror-slide-${slide.id}`}>
            <Component slide={slide} onOpenUrl={noopOpenUrl} />
          </div>
        )
      })}
      {/* `home-hero-counter` (home-hero.css) is the only rule reading `--font-mono` - it belongs
          to the hero's carousel chrome, which this story does not mirror, so none of the four
          slide templates above ever render text in it. Without this probe, the browser has no
          reason to actually load JetBrains Mono Variable, and e2e/mirrored-rendering.spec.ts's
          "fonts load locally" check would have nothing true to assert for that family. */}
      <span className="home-hero-counter" data-testid="mirror-font-mono-probe">
        1/1
      </span>
    </>
  </StrictMode>,
)
