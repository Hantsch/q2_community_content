import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'

/**
 * Story 019 D1 (the width switcher on the preview) and D2 (the cover entry's image area at
 * 1920 versus 940), unstubbed against the repository's own `news/`. Runs at Playwright's
 * default 1280x720 window.
 */

const WIDTHS = [
  { px: 940, name: '940 px — launcher minimum' },
  { px: 1280, name: '1280 px — launcher default' },
  { px: 1920, name: '1920 px' },
] as const

function readTitles(): string[] {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')
  const index = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ file: string }>
  }
  return index.entries.map(({ file }) => {
    const text = readFileSync(resolve(repoRoot, 'news', file), 'utf8')
    return text.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? ''
  })
}

const [FIRST_TITLE, SECOND_TITLE] = readTitles()

function iframeOf(page: Page) {
  return page.locator('iframe[title="Slide preview"]')
}

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

async function selectEntry(page: Page, title: string): Promise<void> {
  const region = page.getByRole('region', { name: 'Entries' })
  await region.getByRole('listitem').filter({ hasText: title }).getByRole('button').filter({ hasNotText: /^(Un)?publish$/i }).click()
}

async function openPreview(page: Page): Promise<void> {
  await page.goto('/')
  await selectEntry(page, FIRST_TITLE)
  await expect(frameOf(page).locator('.home-hero')).toBeVisible()
}

function widthButton(page: Page, name: string) {
  return page.getByRole('group', { name: 'Preview width' }).getByRole('button', { name })
}

test('the preview switches between 940, 1280 and 1920 pixels wide', async ({ page }) => {
  await openPreview(page)

  for (const { px, name } of WIDTHS) {
    await widthButton(page, name).click()
    await expect
      .poll(() => iframeOf(page).evaluate((node) => node.getBoundingClientRect().width))
      .toBe(px)
  }
})

test("switching the width changes the preview's real viewport, not its scale", async ({ page }) => {
  await openPreview(page)

  for (const { px, name } of WIDTHS) {
    await widthButton(page, name).click()
    const frame = frameOf(page)
    await expect.poll(() => frame.locator('html').evaluate((node) => node.clientWidth)).toBe(px)
    const slideWidth = await frame
      .locator('.home-hero')
      .first()
      .evaluate((node) => node.getBoundingClientRect().width)
    expect(slideWidth).toBe(px)
    expect(await iframeOf(page).evaluate((node) => getComputedStyle(node).transform)).toBe('none')
  }
})

test("the width control names the launcher's minimum and default and shows the current width", async ({
  page,
}) => {
  await openPreview(page)

  const group = page.getByRole('group', { name: 'Preview width' })
  for (const { name } of WIDTHS) {
    await expect(widthButton(page, name)).toBeVisible()
  }
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1)
  await expect(widthButton(page, WIDTHS[1].name)).toHaveAttribute('aria-pressed', 'true')

  const current = page.getByTestId('preview-width-current')
  await expect(current).toHaveText('1280 px (launcher default)')

  await widthButton(page, WIDTHS[0].name).click()
  await expect(current).toHaveText('940 px (launcher minimum)')

  await widthButton(page, WIDTHS[2].name).click()
  await expect(current).toHaveText('1920 px')
  await expect(group.locator('button[aria-pressed="true"]')).toHaveCount(1)
})

test('a preview wider than the studio window can be scrolled into full view', async ({ page }) => {
  await openPreview(page)
  await widthButton(page, WIDTHS[2].name).click()

  const scroll = page.getByTestId('preview-scroll')
  const iframe = iframeOf(page)
  const sizes = await scroll.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  }))
  expect(sizes.scrollWidth).toBeGreaterThanOrEqual(1920)
  expect(sizes.clientWidth).toBeLessThan(1920)

  const edges = () =>
    Promise.all([
      scroll.evaluate((node) => node.getBoundingClientRect()),
      iframe.evaluate((node) => node.getBoundingClientRect()),
    ])

  await scroll.evaluate((node) => {
    node.scrollLeft = node.scrollWidth
  })
  const [endBox, endFrame] = await edges()
  expect(endFrame.right).toBeLessThanOrEqual(endBox.right + 1)

  await scroll.evaluate((node) => {
    node.scrollLeft = 0
  })
  const [startBox, startFrame] = await edges()
  expect(startFrame.left).toBeGreaterThanOrEqual(startBox.left - 1)
})

test('the selected width persists while switching entries', async ({ page }) => {
  expect(SECOND_TITLE).toBeTruthy()
  await openPreview(page)
  await widthButton(page, WIDTHS[0].name).click()

  await selectEntry(page, SECOND_TITLE)

  await expect(widthButton(page, WIDTHS[0].name)).toHaveAttribute('aria-pressed', 'true')
  await expect
    .poll(() => iframeOf(page).evaluate((node) => node.getBoundingClientRect().width))
    .toBe(940)
})

function readCoverTitle(): string {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')
  const index = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ file: string }>
  }
  for (const { file } of index.entries) {
    const text = readFileSync(resolve(repoRoot, 'news', file), 'utf8')
    if (text.match(/^template:\s*(.+)$/m)?.[1]?.trim() === 'cover') {
      return text.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? ''
    }
  }
  return ''
}

test('a cover entry loses image area on its left between 1920 and 940', async ({ page }) => {
  const coverTitle = readCoverTitle()
  expect(coverTitle).toBeTruthy()
  await page.goto('/')
  await selectEntry(page, coverTitle)
  const image = frameOf(page).locator('img.home-hero-cover-image')

  const measure = async (px: number, name: string) => {
    await widthButton(page, name).click()
    await expect
      .poll(() => iframeOf(page).evaluate((node) => node.getBoundingClientRect().width))
      .toBe(px)
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete)).toBe(true)
    return image.evaluate((img: HTMLImageElement) => {
      const box = img.getBoundingClientRect()
      const style = getComputedStyle(img)
      return {
        w: box.width,
        h: box.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        objectFit: style.objectFit,
        objectPosition: style.objectPosition,
      }
    })
  }

  const visibleFraction = (m: Awaited<ReturnType<typeof measure>>) =>
    Math.min(1, m.w / m.h / (m.naturalWidth / m.naturalHeight))

  const wide = await measure(1920, WIDTHS[2].name)
  const narrow = await measure(940, WIDTHS[0].name)

  for (const m of [wide, narrow]) {
    expect(m.naturalWidth).toBeGreaterThan(0)
    expect(m.objectFit).toBe('cover')
    expect(m.objectPosition.split(' ')[0]).toBe('100%')
  }
  expect(visibleFraction(narrow)).toBeLessThan(visibleFraction(wide))
  expect(visibleFraction(narrow)).toBeLessThan(1)
})
