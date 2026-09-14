// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { SlideBanner } from '../launcher-core/src/renderer/src/modules/home/components/SlideBanner'
import { SlideCover } from '../launcher-core/src/renderer/src/modules/home/components/SlideCover'
import { SlideSplit } from '../launcher-core/src/renderer/src/modules/home/components/SlideSplit'
import { SlideText } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'
import { resolveSlideTemplate } from '../launcher-core/src/renderer/src/modules/home/components/resolveSlideTemplate'
import type { SlideTemplateProps } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'
import {
  bannerSlideFixture,
  coverSlideFixture,
  splitSlideFixture,
  textSlideFixture,
} from './slideFixtures'
import { newsImageUrl } from './newsImageUrl'

/**
 * D3 (docs/requirements/008-mirrored-rendering-runs.md, AC1/AC2): every template component
 * imported here is read directly from `../launcher-core/...` - never copied, never edited. AC1's
 * "the mirrored slide rendering runs unmodified in the studio" is therefore true by construction:
 * this file only ever imports the mirrored sources, so there is nothing to be an unmodified copy
 * of but the real thing.
 */

const componentsDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../launcher-core/src/renderer/src/modules/home/components',
)

/** Every literal `className="..."` / ternary `className={hasImage ? 'a' : 'a b'}` string a
 * mirrored component file declares, read from its own source text - not hand-copied. */
function classNamesDeclaredBy(fileName: string): string[] {
  const source = readFileSync(resolve(componentsDirectory, fileName), 'utf8')
  const found = new Set<string>()

  for (const match of source.matchAll(/className="([^"]*)"/g)) {
    for (const token of match[1].split(/\s+/).filter(Boolean)) found.add(token)
  }
  // Ternary form: className={hasImage ? 'a' : 'a b'} - both branches are quoted string literals.
  for (const match of source.matchAll(/className=\{[^}]*?\?\s*'([^']*)'\s*:\s*'([^']*)'[^}]*\}/g)) {
    for (const branch of [match[1], match[2]]) {
      for (const token of branch.split(/\s+/).filter(Boolean)) found.add(token)
    }
  }

  return [...found]
}

/** Every `home-hero-*` class name actually present in the rendered container's DOM. */
function renderedHomeHeroClasses(container: HTMLElement): string[] {
  const found = new Set<string>()
  for (const element of container.querySelectorAll('[class]')) {
    for (const token of element.className.split(/\s+/).filter(Boolean)) {
      if (token.startsWith('home-hero-')) found.add(token)
    }
  }
  return [...found]
}

/**
 * AC2: the rendered DOM's class names must match what the mirrored source itself declares -
 * asserted against the components' own markup, not a hand-written expectation. `sourceFiles`
 * covers the rendered template plus `SlideButtons.tsx` (rendered as a child of every template).
 *
 * Some declared classes come from mutually-exclusive branches of the same render (a ternary's two
 * arms, e.g. `SlideBanner`'s `home-hero-content` vs. `home-hero-content-full`, or `SlideButtons`
 * rendering `null` for a slide with no buttons) - no single render can show both. `containers`
 * therefore accepts one or more renders of the *same* component under different fixtures (e.g.
 * with/without an image, with/without buttons) so every declared branch gets exercised somewhere;
 * each individual container is still checked on its own for "no undeclared class snuck in", and
 * the union across containers is checked against the full declared set.
 */
function expectRenderedClassesMatchSource(containers: HTMLElement[], sourceFiles: string[]): void {
  const declared = new Set(sourceFiles.flatMap((file) => classNamesDeclaredBy(file)))
  const declaredHomeHero = [...declared].filter((className) => className.startsWith('home-hero-'))

  const pooled = new Set<string>()
  for (const container of containers) {
    const rendered = renderedHomeHeroClasses(container)
    for (const className of rendered) {
      expect(
        declared.has(className),
        `${className} was rendered but not found in ${sourceFiles.join(', ')}`,
      ).toBe(true)
      pooled.add(className)
    }
  }

  for (const className of declaredHomeHero) {
    expect([...pooled]).toContain(className)
  }
}

function renderTemplate(
  Component: (props: SlideTemplateProps) => React.JSX.Element,
  slide: SlideTemplateProps['slide'],
): HTMLElement {
  const { container } = render(<Component slide={slide} onOpenUrl={() => {}} />)
  return container
}

afterEach(() => {
  cleanup()
})

describe('mirrored slide rendering (D3, AC1/AC2)', () => {
  it('renders the text template from a slide object with zero changes under launcher-core/', () => {
    expect(resolveSlideTemplate(textSlideFixture)).toBe('text')
    const el = renderTemplate(SlideText, textSlideFixture)

    expect(el.querySelector('.home-hero-title')?.textContent).toBe(textSlideFixture.title)

    const bodyEl = el.querySelector('.home-hero-body')
    expect(bodyEl).not.toBeNull()
    expect(bodyEl!.children.length).toBe(0)

    // textSlideFixture has 0 buttons (proves SlideButtons returns null cleanly); a second render
    // with buttons exercises the `home-hero-buttons` branch for the completeness check below.
    const withButtons = renderTemplate(SlideText, {
      ...textSlideFixture,
      buttons: [{ label: 'Learn more', url: 'https://github.com/example/q2-community-content' }],
    })
    expectRenderedClassesMatchSource([el, withButtons], ['SlideText.tsx', 'SlideButtons.tsx'])
  })

  it('renders the split template from a slide object with zero changes under launcher-core/', () => {
    expect(resolveSlideTemplate(splitSlideFixture)).toBe('split')
    const el = renderTemplate(SlideSplit, splitSlideFixture)

    expect(el.querySelector('.home-hero-title')?.textContent).toBe(splitSlideFixture.title)

    // splitSlideFixture has an image; a second, imageless render exercises the
    // `home-hero-content-full` branch for the completeness check below.
    const withoutImage = renderTemplate(SlideSplit, { ...splitSlideFixture, imageUrl: undefined })
    expectRenderedClassesMatchSource([el, withoutImage], ['SlideSplit.tsx', 'SlideButtons.tsx'])
  })

  it('renders the banner template from a slide object with zero changes under launcher-core/', () => {
    expect(resolveSlideTemplate(bannerSlideFixture)).toBe('banner')
    const el = renderTemplate(SlideBanner, bannerSlideFixture)

    expect(el.querySelector('.home-hero-title')?.textContent).toBe(bannerSlideFixture.title)

    // bannerSlideFixture has no image; a second, image-carrying render exercises the plain
    // `home-hero-content`/`home-hero-media` branch for the completeness check below.
    const withImage = renderTemplate(SlideBanner, {
      ...bannerSlideFixture,
      imageUrl: newsImageUrl('banner-repository.png'),
    })
    expectRenderedClassesMatchSource([el, withImage], ['SlideBanner.tsx', 'SlideButtons.tsx'])
  })

  it('renders the cover template from a slide object with zero changes under launcher-core/', () => {
    expect(resolveSlideTemplate(coverSlideFixture)).toBe('cover')
    const el = renderTemplate(SlideCover, coverSlideFixture)

    expect(el.querySelector('.home-hero-title')?.textContent).toBe(coverSlideFixture.title)
    expect(el.querySelector('img.home-hero-cover-image')?.getAttribute('src')).toBe(
      coverSlideFixture.imageUrl,
    )
    expectRenderedClassesMatchSource([el], ['SlideCover.tsx', 'SlideButtons.tsx'])

    const bodyEl = el.querySelector('.home-hero-body')
    expect(bodyEl).not.toBeNull()
    expect(bodyEl!.children.length).toBe(0)
  })
})
