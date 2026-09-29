import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import {
  BOUNDARY_TITLE,
  LONG_TITLE,
  SENTENCE,
  SHORT_TITLE,
  stubBodyEditorFeed,
} from './fixtures/body-editor-feed'

/**
 * Story 023 D4 - the overflow indicator next to the preview, against the stubbed feed in
 * `body-editor-feed.ts`. Every width is set through the width switcher, so each verdict is taken
 * from the frame's real layout at that viewport. The indicator lives in studio chrome, never in
 * the frame.
 */

const WIDTHS = [
  { px: 940, name: '940 px — launcher minimum' },
  { px: 1280, name: '1280 px — launcher default' },
  { px: 1920, name: '1920 px' },
] as const

type Width = (typeof WIDTHS)[number]

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

function indicator(page: Page) {
  return page.getByTestId('body-overflow')
}

function message(px: number): string {
  return `Body is cut off at ${px}px — the launcher shows only what fits`
}

async function openEntry(page: Page, title: string) {
  await stubBodyEditorFeed(page)
  await page.goto('/')
  await page.getByRole('region', { name: 'Entries' }).getByRole('button', { name: title }).click()
  await expect(frameOf(page).locator('.home-hero-body')).toBeVisible()
  return page.getByTestId('body-editor').getByLabel('Body')
}

/**
 * Switches the width and waits until the frame is really that wide, its fonts are loaded and two
 * frames have been painted - the point after which every measurement trigger has resolved. Only
 * then is the absence of the indicator evidence that the body fits.
 */
async function showAt(page: Page, width: Width): Promise<void> {
  await page
    .getByRole('group', { name: 'Preview width' })
    .getByRole('button', { name: width.name })
    .click()
  const iframe = page.locator('iframe[title="Slide preview"]')
  await expect
    .poll(() => iframe.evaluate((node) => Math.round(node.getBoundingClientRect().width)))
    .toBe(width.px)
  await frameOf(page)
    .locator('.home-hero-body')
    .evaluate(
      async (body) =>
        new Promise<void>((resolve) => {
          const view = body.ownerDocument.defaultView!
          void body.ownerDocument.fonts.ready.then(() =>
            view.requestAnimationFrame(() => view.requestAnimationFrame(() => resolve())),
          )
        }),
    )
}

/** The frame's own clamp state, so each expectation is checked against the real layout too. */
async function clampedInFrame(page: Page): Promise<boolean> {
  return frameOf(page)
    .locator('.home-hero-body')
    .evaluate((body) => body.scrollHeight > body.clientHeight + 1)
}

test('a body that overflows its template is flagged at 940, 1280 and 1920', async ({ page }) => {
  await openEntry(page, LONG_TITLE)
  for (const width of WIDTHS) {
    await showAt(page, width)
    expect(await clampedInFrame(page)).toBe(true)
    await expect(indicator(page)).toHaveText(message(width.px))
    await expect(frameOf(page).getByTestId('body-overflow')).toHaveCount(0)
  }
})

test('a body that fits is not flagged at any width', async ({ page }) => {
  await openEntry(page, SHORT_TITLE)
  for (const width of WIDTHS) {
    await showAt(page, width)
    expect(await clampedInFrame(page)).toBe(false)
    await expect(indicator(page)).toHaveCount(0)
  }
})

test('a cover body cut at 940 but not at 1920 is flagged only where it is cut', async ({
  page,
}) => {
  await openEntry(page, BOUNDARY_TITLE)
  const [at940, at1280, at1920] = WIDTHS

  await showAt(page, at940)
  expect(await clampedInFrame(page)).toBe(true)
  await expect(indicator(page)).toHaveText(message(940))

  await showAt(page, at1920)
  expect(await clampedInFrame(page)).toBe(false)
  await expect(indicator(page)).toHaveCount(0)

  await showAt(page, at1280)
  expect(await clampedInFrame(page)).toBe(false)
  await expect(indicator(page)).toHaveCount(0)

  // Back to the narrow width: the verdict is measured again, not remembered per entry.
  await showAt(page, at940)
  await expect(indicator(page)).toHaveText(message(940))
})

test('typing past the cut raises the indicator without a reload', async ({ page }) => {
  const body = await openEntry(page, BOUNDARY_TITLE)
  await showAt(page, WIDTHS[1])
  await page.evaluate(() => {
    ;(window as unknown as { marker: string }).marker = 'kept'
  })
  expect(await clampedInFrame(page)).toBe(false)
  await expect(indicator(page)).toHaveCount(0)

  await body.press('End')
  await body.pressSequentially(` ${SENTENCE.repeat(2)}`)
  await expect(indicator(page)).toHaveText(message(1280))
  expect(await clampedInFrame(page)).toBe(true)

  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('kept')
})
