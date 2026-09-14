import { SlideButtons } from './SlideButtons'
import type { SlideTemplateProps } from './SlideText'

/**
 * `banner` template (story 083 D2, concept §6.3; story 084 D5): image strip across the top,
 * title/body/buttons below - full width, single column, no side-by-side pane like `SlideSplit`.
 *
 * Same `imageUrl`-only, full-width-fallback behaviour as `SlideSplit` (see its doc comment) - a
 * missing image drops the media strip and lets the text column take the banner's full width,
 * instead of leaving an empty or broken-image strip above it.
 */
export function SlideBanner({ slide, onOpenUrl }: SlideTemplateProps) {
  const hasImage = Boolean(slide.imageUrl)

  return (
    <div className="home-hero-slide home-hero-slide-banner">
      {hasImage ? (
        <div className="home-hero-media">
          <img src={slide.imageUrl} alt="" />
        </div>
      ) : null}
      <div className={hasImage ? 'home-hero-content' : 'home-hero-content home-hero-content-full'}>
        <h2 className="home-hero-title">{slide.title}</h2>
        <p className="home-hero-body">{slide.body}</p>
        <SlideButtons buttons={slide.buttons} onOpenUrl={onOpenUrl} />
      </div>
    </div>
  )
}
