import type { NewsSlide } from '@shared/modules/home'
import { SlideButtons } from './SlideButtons'

export interface SlideTemplateProps {
  slide: NewsSlide
  onOpenUrl: (url: string) => void
}

/**
 * `text` template (story 083 D2, concept §6.3): title, body and buttons only - no image slot at
 * all. Also the fallback layout `SlideSplit`/`SlideBanner` render through when their slide has no
 * usable image, and what an unrecognised template value resolves to (`resolveSlideTemplate.ts`).
 *
 * Renders exactly this field set and nothing a slide object might additionally carry - `title`,
 * `body`, `buttons` are read individually, never spread, so a feed-supplied `style` or `className`
 * can never reach the DOM.
 */
export function SlideText({ slide, onOpenUrl }: SlideTemplateProps) {
  return (
    <div className="home-hero-slide home-hero-slide-text">
      <div className="home-hero-content">
        <h2 className="home-hero-title">{slide.title}</h2>
        <p className="home-hero-body">{slide.body}</p>
        <SlideButtons buttons={slide.buttons} onOpenUrl={onOpenUrl} />
      </div>
    </div>
  )
}
