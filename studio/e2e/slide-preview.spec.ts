import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import {
  BUTTONS_TITLE,
  DROPPED_FILE,
  FALLBACK_TITLE,
  KEPT_BUTTON_LABELS,
  OFF_ALLOWLIST_LABEL,
  stubPreviewFeed,
} from './fixtures/preview-feed'

/**
 * Story 018 D4 — the slide preview wired into the real shell. Tests that need the repository's own
 * `news/` run unstubbed; the states it cannot produce use `preview-feed.ts`.
 */

const STUDIO_ROOT = resolve(fileURLToPath(import.meta.url), '../..')

const SPLIT_TITLE = 'r1q2 now installs from the bootstrap wizard'
const COVER_TITLE = 'Welcome to the Quake II community'
const TEXT_REAL_TITLE = 'How news reaches the launcher'

type MarkedWindow = { __marker?: string }

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

async function selectEntry(page: Page, title: string): Promise<void> {
  const region = page.getByRole('region', { name: 'Entries' })
  await region.getByRole('listitem').filter({ hasText: title }).getByRole('button').filter({ hasNotText: /^(Un)?publish$/i }).click()
}

test('the selected entry renders with the mirrored slide components inside an iframe', async ({
  page,
}) => {
  await page.goto('/')
  await selectEntry(page, SPLIT_TITLE)

  const slide = frameOf(page).locator('.home-hero-slide-split')
  await expect(slide).toBeVisible()
  await expect(slide).toContainText(SPLIT_TITLE)
})

test('an entry that falls back to text previews as text, not as its declared template', async ({
  page,
}) => {
  await stubPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, FALLBACK_TITLE)

  const frame = frameOf(page)
  await expect(frame.locator('.home-hero-slide-text')).toBeVisible()
  await expect(frame.locator('.home-hero-slide-cover')).toHaveCount(0)
})

test('no studio chrome style reaches the preview and no mirrored style reaches the studio chrome', async ({
  page,
}) => {
  await page.goto('/')
  await selectEntry(page, SPLIT_TITLE)

  const frame = frameOf(page)
  await expect(frame.locator('.home-hero-slide-split')).toBeVisible()

  const styleIds = (): string[] =>
    Array.from(document.querySelectorAll('style[data-vite-dev-id]')).map(
      (node) => node.getAttribute('data-vite-dev-id') ?? '',
    )

  const frameStyleIds = await frame.locator('html').evaluate(styleIds)
  expect(
    frameStyleIds.some(
      (id) => id.endsWith('/src/styles/index.css') && !id.includes('/launcher-core/'),
    ),
  ).toBe(false)
  expect(frameStyleIds.some((id) => id.includes('/launcher-core/'))).toBe(true)

  const parentStyleIds = await page.evaluate(styleIds)
  expect(parentStyleIds.some((id) => id.includes('/launcher-core/'))).toBe(false)

  const mirroredCss = readFileSync(
    resolve(STUDIO_ROOT, 'src/launcher-core/src/renderer/src/styles/index.css'),
    'utf8',
  )
  // Tailwind's own default theme also defines a few of the launcher's names (--font-sans,
  // --font-mono, --radius-*), so they legitimately compute on the parent. For those the proof is
  // that the parent's value is not the mirrored one; every other name must compute empty.
  const declared = new Map<string, string>()
  for (const [, name, value] of mirroredCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    declared.set(name, value.trim())
  }
  const customProperties = [...declared.keys()]
  const tailwindDefaults = customProperties.filter((name) =>
    /^--(font-sans|font-mono|radius-(xs|sm|md))$/.test(name),
  )
  expect(customProperties.length).toBeGreaterThan(0)

  const leaked = await page.evaluate(
    ({ names, defaults, values }) => {
      const style = getComputedStyle(document.documentElement)
      return names.filter((name) => {
        const computed = style.getPropertyValue(name).trim()
        if (computed === '') return false
        return !defaults.includes(name) || computed === values[name]
      })
    },
    { names: customProperties, defaults: tailwindDefaults, values: Object.fromEntries(declared) },
  )
  expect(leaked).toEqual([])

  const heroHeight = await frame
    .locator('.home-hero')
    .first()
    .evaluate((node) => getComputedStyle(node).height)
  expect(heroHeight).toBe('320px')
})

test("an entry's image loads from news/img through the file bridge", async ({ page }) => {
  await page.goto('/')
  await selectEntry(page, COVER_TITLE)

  const image = frameOf(page).locator('img').first()
  await expect(image).toHaveAttribute('src', /^\/news-img\//)
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0)
})

test('only the buttons the launcher would keep are rendered', async ({ page }) => {
  await stubPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, BUTTONS_TITLE)

  const frame = frameOf(page)
  for (const label of KEPT_BUTTON_LABELS) {
    await expect(frame.getByText(label)).toBeVisible()
  }
  await expect(frame.getByText(OFF_ALLOWLIST_LABEL)).toHaveCount(0)
})

test('an entry the launcher would drop shows why nothing would be shown', async ({ page }) => {
  await stubPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DROPPED_FILE)

  const notice = page.getByRole('status')
  await expect(notice.getByText('Nothing would be shown')).toBeVisible()
  await expect(notice.locator('p')).not.toBeEmpty()
  await expect(page.locator('iframe[title="Slide preview"]')).toBeHidden()
})

test('changing the selected entry updates the preview without a reload', async ({ page }) => {
  await page.goto('/')
  await selectEntry(page, SPLIT_TITLE)

  const frame = frameOf(page)
  await expect(frame.locator('.home-hero-slide-split')).toBeVisible()

  await page.evaluate(() => {
    ;(window as unknown as MarkedWindow).__marker = 'page'
  })
  await frame.locator('html').evaluate(() => {
    ;(window as unknown as MarkedWindow).__marker = 'frame'
  })

  await selectEntry(page, TEXT_REAL_TITLE)
  await expect(frame.locator('.home-hero-slide-text')).toContainText(TEXT_REAL_TITLE)

  expect(await page.evaluate(() => (window as unknown as MarkedWindow).__marker)).toBe('page')
  expect(
    await frame.locator('html').evaluate(() => (window as unknown as MarkedWindow).__marker),
  ).toBe('frame')
})
