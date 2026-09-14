import { SlideButtons } from './SlideButtons'
import type { SlideTemplateProps } from './SlideText'

/**
 * `split` template (story 083 D2, concept §6.3; story 084 D5): title/body pane beside an image.
 *
 * `slide.imageUrl` is the only image field this template ever reads - story 084 D4's
 * `resolve-feed-images.ts` is the sole place that produces it, already a same-origin
 * `q2launcher://` URL, so there is nothing left for the renderer to validate the way the raw
 * feed-supplied `image` path once needed (story 083 finding 4). A slide with no `imageUrl` -
 * missing, failed to download, rejected or not yet resolved - keeps this template's own frame
 * (so the hero's height never depends on whether an image happened to resolve) but drops the
 * media column entirely: the text column takes the full width instead of leaving an empty or
 * broken-image box behind (AC3).
 *
 * Only `title`, `body`, `imageUrl` and `buttons` are read from the slide - never spread - so
 * nothing else a slide object carries (a feed-supplied `style` or `className` included) can reach
 * the DOM.
 */
export function SlideSplit({ slide, onOpenUrl }: SlideTemplateProps) {
  const hasImage = Boolean(slide.imageUrl)

  return (
    <div className="home-hero-slide home-hero-slide-split">
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
