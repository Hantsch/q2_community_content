import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'

/**
 * Story 026 D4: the text safe zone overlay on a cover preview, unstubbed against the repository's
 * own `news/` (read-only).
 */

const COVER_TITLE = 'Welcome to the Quake II community'
const SPLIT_TITLE = 'r1q2 now installs from the bootstrap wizard'

function iframeOf(page: Page) {
  return page.locator('iframe[title="Slide preview"]')
}

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

async function selectEntry(page: Page, title: string): Promise<void> {
  const region = page.getByRole('region', { name: 'Entries' })
  await region.getByRole('listitem').filter({ hasText: title }).getByRole('button').click()
}

function widthButton(page: Page, name: string) {
  return page.getByRole('group', { name: 'Preview width' }).getByRole('button', { name })
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

async function pageBox(page: Page, selector: 'overlay' | 'content'): Promise<Rect> {
  if (selector === 'overlay') {
    return page.getByTestId('cover-safe-zone').evaluate((node): Rect => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    })
  }
  const frame = await iframeOf(page).evaluate((node): Rect => {
    const { x, y, width, height } = node.getBoundingClientRect()
    return { x, y, width, height }
  })
  const inner = await frameOf(page)
    .locator('.home-hero-slide-cover .home-hero-content')
    .evaluate((node): Rect => {
      const { x, y, width, height } = node.getBoundingClientRect()
      return { x, y, width, height }
    })
  return {
    x: frame.x + inner.x,
    y: frame.y + inner.y,
    width: inner.width,
    height: inner.height,
  }
}

test('the cover preview outlines the text safe zone at the measured text column', async ({
  page,
}) => {
  await page.goto('/')
  await selectEntry(page, COVER_TITLE)
  await expect(page.getByTestId('cover-safe-zone')).toBeVisible()
  await expect(page.getByRole('img', { name: 'Text safe zone' })).toBeVisible()

  for (const [px, name] of [
    [940, '940 px — launcher minimum'],
    [1920, '1920 px'],
  ] as const) {
    await widthButton(page, name).click()
    await expect
      .poll(() => iframeOf(page).evaluate((node) => node.getBoundingClientRect().width))
      .toBe(px)
    await expect
      .poll(async () => {
        const [overlay, content] = await Promise.all([
          pageBox(page, 'overlay'),
          pageBox(page, 'content'),
        ])
        return (['x', 'y', 'width', 'height'] as const).every(
          (key) => Math.abs(overlay[key] - content[key]) <= 1,
        )
      })
      .toBe(true)
    const content = await pageBox(page, 'content')
    expect(content.width).toBeGreaterThan(0)
  }
})

test('no safe-zone overlay for a non-cover preview', async ({ page }) => {
  await page.goto('/')
  await selectEntry(page, SPLIT_TITLE)
  await expect(frameOf(page).locator('.home-hero')).toBeVisible()
  await expect(page.getByTestId('cover-safe-zone')).toHaveCount(0)
  await expect(page.getByRole('switch', { name: 'Show text safe zone' })).toHaveCount(0)
})

test('the safe-zone overlay adds nothing inside the preview frame', async ({ page }) => {
  await page.goto('/')
  await selectEntry(page, COVER_TITLE)
  const overlay = page.getByTestId('cover-safe-zone')
  await expect(overlay).toBeVisible()

  const inspect = () =>
    iframeOf(page).evaluate((node) => {
      const doc = (node as HTMLIFrameElement).contentDocument!
      return {
        overlays: doc.querySelectorAll('[data-testid="cover-safe-zone"]').length,
        sheets: doc.styleSheets.length,
        styles: doc.querySelectorAll('style, link[rel="stylesheet"]').length,
        nodes: doc.querySelectorAll('*').length,
      }
    })

  const before = await inspect()
  expect(before.overlays).toBe(0)
  await page.getByRole('switch', { name: 'Show text safe zone' }).uncheck()
  await expect(overlay).toHaveCount(0)
  const off = await inspect()
  await page.getByRole('switch', { name: 'Show text safe zone' }).check()
  await expect(overlay).toBeVisible()
  const on = await inspect()
  expect(off).toEqual(before)
  expect(on).toEqual(before)
})
