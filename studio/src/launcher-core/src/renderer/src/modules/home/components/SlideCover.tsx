import { SlideButtons } from './SlideButtons'
import type { SlideTemplateProps } from './SlideText'

/**
 * `cover` template (story 095 D2, concept follow-on to 083/084's `split`/`banner`): a full-bleed
 * image behind a scrim, with the title/body/buttons pane sitting on top of it instead of beside or
 * above it.
 *
 * Same `imageUrl`-only contract as `SlideSplit`/`SlideBanner`: only `title`, `body`, `imageUrl` and
 * `buttons` are read from the slide - never spread - so nothing else a slide object carries can
 * reach the DOM. Unlike those two templates, D1 already downgrades a `cover` slide with no
 * `imageUrl` to `text` before it ever reaches `TEMPLATES`, so this component is never actually
 * mounted without an image in practice - but it stays defensive (content-only, no `<img>`, no
 * scrim) rather than assuming `slide.imageUrl` is always set.
 */
export function SlideCover({ slide, onOpenUrl }: SlideTemplateProps) {
  const hasImage = Boolean(slide.imageUrl)

  return (
    <div className="home-hero-slide home-hero-slide-cover">
      {hasImage ? (
        <>
          <img className="home-hero-cover-image" src={slide.imageUrl} alt="" />
          <div className="home-hero-cover-scrim" />
        </>
      ) : null}
      <div className="home-hero-content">
        <h2 className="home-hero-title">{slide.title}</h2>
        <p className="home-hero-body">{slide.body}</p>
        <SlideButtons buttons={slide.buttons} onOpenUrl={onOpenUrl} />
      </div>
    </div>
  )
}
