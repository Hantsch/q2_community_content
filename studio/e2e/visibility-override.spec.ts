import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import {
  EXPIRED_TITLE,
  EXPIRED_VISIBLE_UNTIL,
  FALLBACK_TITLE,
  PUBLISHED_TITLE,
  SCHEDULED_TITLE,
  SCHEDULED_VISIBLE_FROM,
  stubVisibilityOverrideFeed,
} from './fixtures/visibility-override-feed'

/**
 * Story 021 D2 — the "preview as if visible" override in the real shell, against the stubbed
 * `visibility-override-feed.ts` (the repository's own `news/` has no scheduled or expired entry).
 */

const NEWS_DIR = resolve(fileURLToPath(import.meta.url), '../../../news')

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

async function selectEntry(page: Page, title: string): Promise<void> {
  const region = page.getByRole('region', { name: 'Entries' })
  await region.getByRole('listitem').filter({ hasText: title }).getByRole('button').click()
}

function overrideSwitch(page: Page) {
  return page.getByRole('switch', { name: 'Preview as if visible' })
}

/** One digest over every tracked file under `news/`. */
function newsDigest(): string {
  const hash = createHash('sha256')
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else hash.update(path).update(readFileSync(path))
    }
  }
  walk(NEWS_DIR)
  return hash.digest('hex')
}

test.beforeEach(async ({ page }) => {
  await stubVisibilityOverrideFeed(page)
  await page.goto('/')
})

test('a scheduled entry previews as if visible with the override on', async ({ page }) => {
  await selectEntry(page, SCHEDULED_TITLE)
  await overrideSwitch(page).check()

  await expect(frameOf(page).locator('.home-hero-slide-text')).toContainText(SCHEDULED_TITLE)

  await selectEntry(page, FALLBACK_TITLE)
  await overrideSwitch(page).check()
  const frame = frameOf(page)
  await expect(frame.locator('.home-hero-slide-text')).toContainText(FALLBACK_TITLE)
  await expect(frame.locator('.home-hero-slide-split')).toHaveCount(0)
})

test('an expired entry previews as if visible with the override on', async ({ page }) => {
  await selectEntry(page, EXPIRED_TITLE)
  await overrideSwitch(page).check()

  await expect(frameOf(page).locator('.home-hero-slide-text')).toContainText(EXPIRED_TITLE)
})

test('the override is marked on the preview and names the real state', async ({ page }) => {
  await selectEntry(page, SCHEDULED_TITLE)
  await overrideSwitch(page).check()

  const marker = page.getByRole('status')
  await expect(marker).toBeVisible()
  await expect(marker).toContainText('Override — previewing as if visible.')
  await expect(marker).toContainText('Real state:')
  await expect(marker).toContainText(SCHEDULED_VISIBLE_FROM)

  const markerText = (await marker.textContent()) ?? ''
  const frameText = (await frameOf(page).locator('body').textContent()) ?? ''
  expect(frameText).not.toContain('Override')
  expect(frameText).not.toContain(markerText)
})

test('toggling the override writes nothing to the repository', async ({ page }) => {
  const before = newsDigest()
  const requests: Array<{ method: string; url: string }> = []
  page.on('request', (request) => {
    requests.push({ method: request.method(), url: request.url() })
  })

  await selectEntry(page, SCHEDULED_TITLE)
  await overrideSwitch(page).check()
  await expect(page.getByRole('status')).toContainText('Override')
  await overrideSwitch(page).uncheck()
  await selectEntry(page, EXPIRED_TITLE)
  await overrideSwitch(page).check()
  await selectEntry(page, PUBLISHED_TITLE)
  await expect(overrideSwitch(page)).toHaveCount(0)
  await selectEntry(page, SCHEDULED_TITLE)
  await expect(overrideSwitch(page)).not.toBeChecked()

  expect(requests.length).toBeGreaterThan(0)
  expect(requests.filter((request) => request.method !== 'GET')).toEqual([])
  expect(newsDigest()).toBe(before)
})

test('the validation panel and library keep the real visibility while the override is on', async ({
  page,
}) => {
  await selectEntry(page, SCHEDULED_TITLE)
  await overrideSwitch(page).check()
  await expect(page.getByRole('status')).toContainText('Override')

  const row = page
    .getByRole('region', { name: 'Entries' })
    .getByRole('listitem')
    .filter({ hasText: SCHEDULED_TITLE })
  await expect(row).toContainText('Scheduled')
  await expect(row).not.toContainText('Published')

  const findings = page.getByRole('region', { name: 'Entry findings' })
  await expect(findings).toContainText(SCHEDULED_VISIBLE_FROM)
  await expect(findings).toContainText(/scheduled/i)
})

test('with the override off a scheduled or expired entry previews as nothing with the reason', async ({
  page,
}) => {
  const frame = page.locator('iframe[title="Slide preview"]')

  await selectEntry(page, SCHEDULED_TITLE)
  const notice = page.getByRole('status')
  await expect(notice.getByText('Nothing would be shown')).toBeVisible()
  await expect(notice).toContainText(SCHEDULED_VISIBLE_FROM)
  await expect(frame).toBeHidden()

  await selectEntry(page, EXPIRED_TITLE)
  await expect(notice.getByText('Nothing would be shown')).toBeVisible()
  await expect(notice).toContainText(EXPIRED_VISIBLE_UNTIL)
  await expect(frame).toBeHidden()
})
