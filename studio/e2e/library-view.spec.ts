import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures/localhost-only'
import {
  DRAFT_ONE_TITLE,
  DRAFT_TWO_TITLE,
  EXPIRED_TITLE,
  MISMATCH_TITLE,
  SCHEDULED_TITLE,
  stubEmptyLibraryFeed,
  stubLibraryFeed,
  stubUnreadableLibraryFeed,
} from './fixtures/library-feed'

/**
 * Story 016 D5 — the library view wired into the real shell. `news` is `descriptors[0]`, the
 * default tab, so every test just `goto('/')` (same convention `file-bridge.spec.ts` and
 * `studio-shell.spec.ts` already use). AC1 and AC6 run unstubbed, against the repository's own
 * `news/`; every other test stubs the bridge's `GET /__studio/fs/read` response with
 * `library-feed.ts`'s fixture, because the real `news/` cannot trigger scheduled, expired, dropped,
 * mismatched or empty states (see that fixture's header comment).
 */

interface RealEntry {
  readonly id: string
  readonly title: string
  readonly template: string
  readonly order: string
}

/** Minimal frontmatter reader for the repository's own `.md` files — enough to read `title`,
 * `template` and `order`, the same fields `file-bridge.spec.ts` already reads off this repository
 * without hardcoding them. */
function readFrontmatterField(text: string, key: string): string | undefined {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
  return match?.[1]?.trim()
}

function readRealEntries(): RealEntry[] {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')
  const newsIndex = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ id: string; file: string }>
  }

  return newsIndex.entries.map(({ id, file }) => {
    const text = readFileSync(resolve(repoRoot, 'news', file), 'utf8')
    return {
      id,
      title: readFrontmatterField(text, 'title') ?? '',
      template: readFrontmatterField(text, 'template') ?? '',
      order: readFrontmatterField(text, 'order') ?? '',
    }
  })
}

test('the library lists the published feed in delivered order with title, template, order and status', async ({
  page,
}) => {
  const realEntries = readRealEntries()
  expect(realEntries.length).toBeGreaterThan(0)

  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const rows = region.getByRole('listitem')
  await expect(rows).toHaveCount(realEntries.length)

  for (const [index, entry] of realEntries.entries()) {
    const row = rows.nth(index)
    await expect(row).toContainText(entry.title)
    await expect(row).toContainText(entry.template)
    await expect(row).toContainText(`Order: ${entry.order}`)
    await expect(row).toContainText('Published')
  }
})

test('drafts are listed in their own section and marked invisible to the launcher', async ({
  page,
}) => {
  await stubLibraryFeed(page)
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Drafts — not visible to the launcher' }),
  ).toBeVisible()

  const draftsRegion = page.getByRole('region', { name: 'Drafts' })
  await expect(draftsRegion.getByText(DRAFT_ONE_TITLE)).toBeVisible()
  await expect(draftsRegion.getByText(DRAFT_TWO_TITLE)).toBeVisible()
  await expect(draftsRegion.getByRole('listitem')).toHaveCount(2)
  for (const text of await draftsRegion.getByRole('listitem').allTextContents()) {
    expect(text).toContain('Draft')
  }

  // Drafts never appear in the published section, which is what "separately from published
  // entries" (AC2) means.
  const entriesRegion = page.getByRole('region', { name: 'Entries' })
  await expect(entriesRegion.getByText(DRAFT_ONE_TITLE)).toHaveCount(0)
  await expect(entriesRegion.getByText(DRAFT_TWO_TITLE)).toHaveCount(0)
})

test('a scheduled entry shows its visible-from date and an expired entry its visible-until date', async ({
  page,
}) => {
  await stubLibraryFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const scheduledRow = region.getByRole('listitem').filter({ hasText: SCHEDULED_TITLE })
  await expect(scheduledRow).toContainText('Scheduled')
  await expect(scheduledRow).toContainText('Visible from: 2099-01-01T00:00:00Z')

  const expiredRow = region.getByRole('listitem').filter({ hasText: EXPIRED_TITLE })
  await expect(expiredRow).toContainText('Expired')
  await expect(expiredRow).toContainText('Visible until: 2000-01-01T00:00:00Z')
})

test('a dropped entry is marked dropped and its reason is readable in the list', async ({
  page,
}) => {
  await stubLibraryFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  // The dropped fixture document declares no title, so the row falls back to its file name.
  const droppedRow = region.getByRole('listitem').filter({ hasText: 'dropped-entry.md' })
  await expect(droppedRow).toContainText('Dropped')
  await expect(droppedRow).toContainText(/Reason: dropped: /)
})

test('an entry whose delivered template differs from the declared one shows both', async ({
  page,
}) => {
  await stubLibraryFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const mismatchRow = region.getByRole('listitem').filter({ hasText: MISMATCH_TITLE })
  await expect(mismatchRow).toContainText('declared: split')
  await expect(mismatchRow).toContainText('delivered: text')
})

test('selecting an entry marks it as the current entry', async ({ page }) => {
  const realEntries = readRealEntries()

  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const firstRow = region.getByRole('listitem').first()
  const firstButton = firstRow.getByRole('button')

  await expect(firstButton).not.toHaveAttribute('aria-current', 'true')
  await firstButton.click()
  await expect(firstButton).toHaveAttribute('aria-current', 'true')
  await expect(firstButton).toContainText(realEntries[0].title)
})

test('an empty news directory explains itself', async ({ page }) => {
  await stubEmptyLibraryFeed(page)
  await page.goto('/')

  const notice = page.getByLabel('Library content')
  await expect(notice.getByText('news/ has no entries or drafts.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Entries' })).toHaveCount(0)
})

test('an unreadable news directory explains itself, not as an empty list', async ({ page }) => {
  await stubUnreadableLibraryFeed(page)
  await page.goto('/')

  const notice = page.getByLabel('Library content')
  await expect(notice.getByText('news/ could not be read.')).toBeVisible()
  await expect(notice.getByText('news/ has no entries or drafts.')).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Entries' })).toHaveCount(0)
})
