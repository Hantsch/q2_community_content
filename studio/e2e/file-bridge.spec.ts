import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures/localhost-only'

/**
 * Story 015, D3 - live-browser proof that folding the image route into the file bridge
 * (`createFileBridge`, replacing the deleted `newsImgMiddleware.ts`) still serves the mirrored
 * renderer correctly. Deliberately the same assertions `mirrored-rendering.spec.ts`'s
 * `'a cover slide shows an image from news/img'` (story 008) already makes - this is a
 * duplicate-by-design proof for AC4, not new coverage; D4 will extend this file with the browser
 * client's own cases.
 */

test('an image under news/img/ is served to the mirrored renderer', async ({
  page,
  externalRequests,
}) => {
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

/**
 * Story 015, D4, AC1 / Story 016, D5 - the studio's default screen (`news` is `descriptors[0]`)
 * reads the real repository's `news/` tree through the bridge and shows it via the real
 * `LibraryView` (story 016), which replaced the interim `NewsBridgeSummary` this test used to
 * assert against. Titles, order and drafts are computed here from the repository's own
 * `news/index.json` and `news/*.md` files rather than hardcoded, so this test stays correct as the
 * repository's own news content changes, and this file keeps proving the unstubbed bridge path end
 * to end - `library-view.spec.ts` covers the fixture-driven states the real `news/` cannot trigger.
 */
test('the studio reads the news directory through the bridge', async ({ page }) => {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')
  const newsIndex = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ file: string }>
  }
  const entryFiles = new Set(newsIndex.entries.map((entry) => entry.file))

  // Every `.md` directly under `news/` (excluding `img/` and `_templates/`, which the reader never
  // walks — see `read-content-repo.ts`) is either a document the index names or a draft it does not.
  const newsDir = resolve(repoRoot, 'news')
  const mdFiles = readdirSync(newsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
  const draftFiles = mdFiles.filter((file) => !entryFiles.has(file))

  const titleOf = (file: string): string => {
    const text = readFileSync(resolve(newsDir, file), 'utf8')
    return text.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? file
  }

  await page.goto('/')

  const entriesRegion = page.getByRole('region', { name: 'Entries' })
  const rows = entriesRegion.getByRole('listitem')
  await expect(rows).toHaveCount(newsIndex.entries.length)

  // Delivered order for this repository's plain, unscheduled entries is the index's own order —
  // proven independently, against a fixture that also covers reordering, by `library-view.spec.ts`'s
  // "the library lists the published feed in delivered order..." test.
  for (const [index, entry] of newsIndex.entries.entries()) {
    await expect(rows.nth(index)).toContainText(titleOf(entry.file))
  }

  const draftsRegion = page.getByRole('region', { name: 'Drafts' })
  await expect(draftsRegion.getByRole('listitem')).toHaveCount(draftFiles.length)
  for (const file of draftFiles) {
    await expect(draftsRegion.getByText(titleOf(file))).toBeVisible()
  }
})
