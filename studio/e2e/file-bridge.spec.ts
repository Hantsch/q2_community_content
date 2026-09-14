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
 * Story 015, D4, AC1 - the studio's default screen (`news` is `descriptors[0]`) reads the real
 * repository's `news/` tree through the bridge and shows the index path plus the counts
 * `NewsBridgeSummary` derives from that read. Counts are computed here from the repository's own
 * `news/index.json` and `news/*.md` files rather than hardcoded, so this test stays correct as the
 * repository's own news content changes.
 */
test('the studio reads the news directory through the bridge', async ({ page }) => {
  const repoRoot = resolve(fileURLToPath(import.meta.url), '../../..')
  const newsIndex = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ file: string }>
  }
  const entryFiles = new Set(newsIndex.entries.map((entry) => entry.file))
  const entriesCount = entryFiles.size

  // Every `.md` directly under `news/` (excluding `img/` and `_templates/`, which the reader never
  // walks — see `read-content-repo.ts`) is either a document the index names or a draft it does not.
  const newsDir = resolve(repoRoot, 'news')
  const mdFiles = readdirSync(newsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name)
  const documentsCount = mdFiles.filter((file) => entryFiles.has(file)).length
  const draftsCount = mdFiles.filter((file) => !entryFiles.has(file)).length

  await page.goto('/')

  const region = page.getByLabel('News content')
  await expect(region.getByText('Index: news/index.json')).toBeVisible()
  await expect(region.getByText(`Entries: ${entriesCount}`)).toBeVisible()
  await expect(region.getByText(`Documents: ${documentsCount}`)).toBeVisible()
  await expect(region.getByText(`Drafts: ${draftsCount}`)).toBeVisible()
})
