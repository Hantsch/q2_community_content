import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Story 008 D4 (AC3 static part, AC4 packaging part): the mirrored `home-hero.css` must only ever
 * read tokens the mirrored `index.css` actually defines, and the mirror runtime must bundle (and
 * this repository must attribute) the font families those tokens name.
 */

// `studio/` is one level up from `studio/tests/`.
const studioRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(join(studioRoot, relativePath), 'utf8')
}

const HOME_HERO_CSS = 'src/launcher-core/src/renderer/src/styles/home-hero.css'
const INDEX_CSS = 'src/launcher-core/src/renderer/src/styles/index.css'
const MIRROR_STYLES_TS = 'src/mirror-runtime/mirrorStyles.ts'
const README = 'README.md'

/** Custom properties `home-hero.css` defines itself, so a `var(...)` read of them is not expected
 * to resolve inside `index.css`. */
const SELF_DEFINED = new Set(['--home-hero-controls-h'])

function customPropertyReads(cssText: string): Set<string> {
  const names = new Set<string>()
  for (const match of cssText.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) {
    names.add(match[1])
  }
  return names
}

function customPropertyDeclarations(cssText: string): Set<string> {
  const names = new Set<string>()
  for (const match of cssText.matchAll(/(--[a-zA-Z0-9-]+)\s*:/g)) {
    names.add(match[1])
  }
  return names
}

describe('mirrored slide styling (story 008 D4)', () => {
  it('every var(--x) read by the mirrored home-hero.css is defined in the mirrored token sheet', () => {
    const homeHeroText = read(HOME_HERO_CSS)
    const indexText = read(INDEX_CSS)

    const reads = customPropertyReads(homeHeroText)
    const declarations = customPropertyDeclarations(indexText)

    const missing = [...reads].filter((name) => !SELF_DEFINED.has(name) && !declarations.has(name))

    expect(missing, 'home-hero.css reads a token index.css never declares').toEqual([])
  })

  it('the studio chrome stylesheet redefines none of the mirrored tokens', () => {
    const studioChromeText = read('src/styles/index.css')
    const indexText = read(INDEX_CSS)

    const mirroredTokens = customPropertyDeclarations(indexText)
    const redeclared = [...mirroredTokens].filter((name) =>
      new RegExp(`(^|[^-\\w])${name}\\s*:`).test(studioChromeText),
    )

    expect(redeclared, 'studio/src/styles/index.css must not redefine a launcher token').toEqual([])
  })

  it('both hero font families are bundled and attributed', () => {
    const indexText = read(INDEX_CSS)
    const mirrorStylesText = read(MIRROR_STYLES_TS)

    // Derived from the mirrored `index.css` `@theme` block itself (review finding F5), not
    // hand-listed: each `--font-*` token's first quoted family name maps to the Fontsource
    // package slug that ships it, so a re-synced sheet naming a fourth family fails this test
    // instead of the check silently staying green against a stale hardcoded list.
    const FAMILY_TO_PACKAGE_SLUG: Record<string, string> = {
      'oswald variable': 'oswald',
      'inter variable': 'inter',
      'jetbrains mono variable': 'jetbrains-mono',
    }

    const requiredSlugs = new Set<string>()
    for (const match of indexText.matchAll(/--font-[a-z-]+:\s*'([^']+)'/g)) {
      const slug = FAMILY_TO_PACKAGE_SLUG[match[1].toLowerCase()]
      if (slug === undefined) {
        expect.fail(`no known Fontsource package for font family "${match[1]}"`)
      }
      requiredSlugs.add(slug)
    }
    expect(
      requiredSlugs.size,
      'expected to find at least one --font-* declaration',
    ).toBeGreaterThan(0)

    for (const slug of requiredSlugs) {
      expect(mirrorStylesText).toMatch(new RegExp(`@fontsource-variable/${slug}\\b`))
    }

    const readmeText = read(README)
    const thirdPartySection = readmeText.slice(readmeText.indexOf('## Third-party'))

    expect(thirdPartySection.length).toBeGreaterThan(0)
    expect(thirdPartySection).toMatch(/OFL[ -]1\.1|Open Font License 1\.1/)
    expect(thirdPartySection).toMatch(/Copyright 2016 The Inter Project Authors/)
    expect(thirdPartySection).toMatch(/Copyright 2016 The Oswald Project Authors/)
    expect(thirdPartySection).toMatch(/Copyright 2020 The JetBrains Mono Project Authors/)
  })
})
