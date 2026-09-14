import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures/localhost-only'

/**
 * Story 008 D5 - live-browser proof for AC3, AC4 and AC6, against `/mirror-check.html`
 * (`mirrorCheck.tsx`), which mounts every `slideFixtures.ts` fixture through the real, unmodified
 * `SlideText`/`SlideSplit`/`SlideBanner`/`SlideCover` components. `mirroredSlides.test.tsx` (D3)
 * already proves the same components render correctly in jsdom; this spec proves the same thing
 * a browser actually needs: computed styles resolve, fonts load from the bundle, and an image
 * from `news/img/` decodes - all without a single request leaving `localhost`.
 */

const HOME_HERO_CSS = fileURLToPath(
  new URL('../src/launcher-core/src/renderer/src/styles/home-hero.css', import.meta.url),
)

/** Every `var(--x)` read by the mirrored `home-hero.css`, minus the one it defines itself - read
 * from source rather than hand-listed, so a re-synced sheet reading a new token cannot silently
 * drop out of this check (review finding F4). */
function homeHeroCustomPropertyReads(): string[] {
  const text = readFileSync(HOME_HERO_CSS, 'utf8')
  const names = new Set<string>()
  for (const match of text.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) names.add(match[1])
  names.delete('--home-hero-controls-h')
  return [...names]
}

test('every custom property resolves in the browser', async ({ page }) => {
  await page.goto('/mirror-check.html')

  const properties = homeHeroCustomPropertyReads()

  const values = await page.evaluate((names: string[]) => {
    const style = getComputedStyle(document.documentElement)
    return names.map((name) => [name, style.getPropertyValue(name)] as const)
  }, properties)

  for (const [name, value] of values) {
    expect(value.trim(), `${name} did not resolve to a non-empty value`).not.toBe('')
  }
})

test('the hero fonts load locally, with no external request', async ({
  page,
  externalRequests,
}) => {
  await page.goto('/mirror-check.html')

  // `status === 'loaded'` (not just declared) proves the bundled font file actually decoded,
  // not merely that an @font-face for it exists (review finding F6).
  const loadedFamilies = await page.evaluate(() =>
    document.fonts.ready.then(() =>
      [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family),
    ),
  )

  expect(loadedFamilies).toContain('Oswald Variable')
  expect(loadedFamilies).toContain('JetBrains Mono Variable')

  expect(externalRequests).toEqual([])
})

test('a cover slide shows an image from news/img', async ({ page, externalRequests }) => {
  await page.goto('/mirror-check.html')

  const image = page.locator('img.home-hero-cover-image')
  await expect(image).toBeVisible()

  const src = await image.getAttribute('src')
  expect(src).toMatch(/\/news-img\/cover-community-welcome\.png$/)

  await expect
    .poll(async () => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0)

  expect(externalRequests).toEqual([])
})
