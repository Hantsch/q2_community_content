import type { NewsButton } from '@shared/modules/home'
import { Button } from '../../../components/ui/Button'
import { openSlideUrl } from '../client'

export interface SlideButtonsProps {
  buttons: NewsButton[]
  /**
   * Called with one button's URL when it is clicked (kept from D2, still exercised by
   * `slides.test.tsx`). D5 adds the real IPC call alongside it: this component's own `onClick`
   * also calls the home client's `openSlideUrl`, which is the only place that actually opens
   * anything - main re-checks the scheme and the host allowlist there before ever touching
   * `shell.openExternal` (`main/modules/home/open-slide-url.ts`).
   */
  onOpenUrl: (url: string) => void
}

/**
 * The button row shared by every slide template (story 083 D2). Renders at most 3 of a slide's
 * buttons (concept §6.2's "max 3 buttons" - a caller's array may carry more, this is where the
 * cap is actually enforced) as real `<button>` elements, never `<a>`: a slide button cannot
 * navigate on its own, per this deliverable's acceptance criteria - there is no `href` anywhere
 * in the row and clicking one never calls `window.open`.
 */
export function SlideButtons({ buttons, onOpenUrl }: SlideButtonsProps) {
  const capped = buttons.slice(0, 3)
  if (capped.length === 0) return null

  return (
    <div className="home-hero-buttons">
      {capped.map((button, index) => (
        <Button
          key={`${button.url}-${index}`}
          variant="neutral"
          size="sm"
          onClick={() => {
            onOpenUrl(button.url)
            void openSlideUrl(button.url)
          }}
        >
          {button.label}
        </Button>
      ))}
    </div>
  )
}
