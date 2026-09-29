import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import {
  DRAFT_BROKEN_LABEL,
  DRAFT_COVER_TITLE,
  DRAFT_UNORDERED_TITLE,
  PUBLISHED_ONE_TITLE,
  stubDraftPreviewFeed,
} from './fixtures/draft-preview-feed'

/**
 * Story 020 D2 — a selected draft is previewed through story 018's slide preview, from a stubbed
 * feed that holds drafts (the repository's own `news/` has none).
 */

const REAL_NEWS_DIR = resolve(fileURLToPath(import.meta.url), '../../../news')

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

async function selectEntry(page: Page, title: string): Promise<void> {
  const region = page.getByRole('region', { name: 'Drafts' })
  await region.getByRole('listitem').filter({ hasText: title }).getByRole('button').filter({ hasNotText: /^(Un)?publish$/i }).click()
}

function hashTree(dir: string, prefix = ''): Record<string, string> {
  const hashes: Record<string, string> = {}
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    const key = `${prefix}${entry.name}`
    if (entry.isDirectory()) Object.assign(hashes, hashTree(path, `${key}/`))
    else hashes[key] = createHash('sha256').update(readFileSync(path)).digest('hex')
  }
  return hashes
}

test('a draft selected in the library is previewed in the slide frame', async ({ page }) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DRAFT_UNORDERED_TITLE)

  const slide = frameOf(page).locator('.home-hero-slide-text')
  await expect(slide).toBeVisible()
  await expect(slide).toContainText(DRAFT_UNORDERED_TITLE)
})

test('previewing a draft sends only reads and leaves news/ byte-identical', async ({ page }) => {
  const requests: { method: string; url: string }[] = []
  page.on('request', (request) => {
    requests.push({ method: request.method(), url: request.url() })
  })

  const before = hashTree(REAL_NEWS_DIR)
  expect(Object.keys(before).length).toBeGreaterThan(0)

  await stubDraftPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DRAFT_COVER_TITLE)
  await expect(frameOf(page).locator('.home-hero-slide-text')).toBeVisible()
  await selectEntry(page, DRAFT_UNORDERED_TITLE)
  await expect(frameOf(page).locator('.home-hero-slide-text')).toContainText(DRAFT_UNORDERED_TITLE)
  await selectEntry(page, DRAFT_BROKEN_LABEL)
  await expect(page.getByRole('status').getByText('Nothing would be shown')).toBeVisible()

  const bridge = requests.filter(
    ({ url }) => url.includes('/__studio/') || url.includes('/news-img/'),
  )
  expect(bridge.length).toBeGreaterThan(0)
  for (const { method } of bridge) expect(['GET', 'HEAD']).toContain(method)

  expect(hashTree(REAL_NEWS_DIR)).toEqual(before)
})

test('a draft cover with a missing image previews as text', async ({ page }) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DRAFT_COVER_TITLE)

  const frame = frameOf(page)
  await expect(frame.locator('.home-hero-slide-text')).toBeVisible()
  await expect(frame.locator('.home-hero-slide-cover')).toHaveCount(0)
})

test("a draft with unreadable frontmatter shows the launcher's drop reason", async ({ page }) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DRAFT_BROKEN_LABEL)

  const notice = page.getByRole('status')
  await expect(notice.getByText('Nothing would be shown')).toBeVisible()
  await expect(notice).toContainText('frontmatter could not be read')
  await expect(page.locator('iframe[title="Slide preview"]')).toBeHidden()
})

test('a draft preview carries a draft marker outside the slide frame and a published one does not', async ({
  page,
}) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  const marker = page.getByRole('region', { name: 'Draft preview' })

  await selectEntry(page, DRAFT_UNORDERED_TITLE)
  await expect(marker).toBeVisible()
  await expect(marker).toContainText('Not in news/index.json')
  await expect(frameOf(page).locator('.home-hero-slide-text')).toBeVisible()
  await expect(frameOf(page).locator('body')).not.toContainText('Not in news/index.json')

  const published = page.getByRole('region', { name: 'Entries' })
  await published
    .getByRole('listitem')
    .filter({ hasText: PUBLISHED_ONE_TITLE })
    .getByRole('button').filter({ hasNotText: /^(Un)?publish$/i })
    .click()
  await expect(frameOf(page).locator('.home-hero-slide-text')).toContainText(PUBLISHED_ONE_TITLE)
  await expect(marker).toHaveCount(0)
})

test('a draft cover with a missing image says it falls back to text', async ({ page }) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  await selectEntry(page, DRAFT_COVER_TITLE)

  const marker = page.getByRole('region', { name: 'Draft preview' })
  await expect(marker).toContainText('delivered as text')
  await expect(marker).toContainText('declared cover')
})

test('a draft preview states where it would sit in the delivered feed', async ({ page }) => {
  await stubDraftPreviewFeed(page)
  await page.goto('/')
  const marker = page.getByRole('region', { name: 'Draft preview' })

  await selectEntry(page, DRAFT_COVER_TITLE)
  await expect(marker).toContainText('Position 2 of 3')

  await selectEntry(page, DRAFT_UNORDERED_TITLE)
  await expect(marker).toContainText('no usable order value')
})
