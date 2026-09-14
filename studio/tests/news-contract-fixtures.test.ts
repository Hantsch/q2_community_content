import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFeed } from '../src/contract/launcher-contract'

/**
 * Story 007 D3: the drop rule and the text-fallback rule, read off `buildFeed`'s own return
 * value - not recomputed here. Fixtures live in `tests/fixtures/news-contract/`, outside the
 * published `news/` tree, since they exist only to exercise the mirrored pipeline.
 */

function readFixture(file: string): string {
  return readFileSync(new URL(`./fixtures/news-contract/${file}`, import.meta.url), 'utf8')
}

function buildFixtureFeed() {
  const now = new Date('2026-09-13T00:00:00Z')
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'no-title', file: 'no-title.md' },
      { id: 'cover-no-image', file: 'cover-no-image.md' },
    ],
  }
  const documents = {
    'no-title.md': readFixture('no-title.md'),
    'cover-no-image.md': readFixture('cover-no-image.md'),
  }

  return buildFeed({ index, documents, now })
}

describe('news contract fixtures', () => {
  it('a title-less entry is dropped', () => {
    const result = buildFixtureFeed()

    // Drop rule: the title-less entry never reaches `slides`.
    expect(result.slides.map((slide) => slide.id)).not.toContain('no-title')
    const dropWarning = result.warnings.find((warning) => warning.id === 'no-title')
    expect(dropWarning).toBeDefined()
    expect(dropWarning?.file).toBe('no-title.md')
    expect(dropWarning?.reason).toContain('title')
  })

  it('a cover without an image is delivered as text', () => {
    const result = buildFixtureFeed()

    // Fallback rule: `cover` without an image is delivered, but as `text`.
    const coverSlide = result.slides.find((slide) => slide.id === 'cover-no-image')
    expect(coverSlide).toBeDefined()
    expect(coverSlide?.template).toBe('text')
    const fallbackWarning = result.warnings.find((warning) => warning.id === 'cover-no-image')
    expect(fallbackWarning).toBeDefined()
    expect(fallbackWarning?.reason).toContain('text slide')
  })
})
