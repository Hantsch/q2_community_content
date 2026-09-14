import { describe, expect, it } from 'vitest'
import { buildFeed } from '../src/contract/launcher-contract'
import { readNewsTree } from '../src/contract/read-news-tree'

describe('news contract', () => {
  it("the repository's own news feed yields four slides in order 10/20/30/40", () => {
    const { index, documents } = readNewsTree()
    const now = new Date('2026-09-13T00:00:00Z')

    const result = buildFeed({ index, documents, now })

    expect(result.slides).toHaveLength(4)
    expect(result.slides.map((slide) => slide.id)).toEqual([
      'r1q2-in-the-bootstrap-wizard',
      'the-community-content-repository',
      'how-news-reaches-the-launcher',
      'welcome-to-the-community',
    ])
    expect(result.slides.map((slide) => slide.template)).toEqual([
      'split',
      'banner',
      'text',
      'cover',
    ])
    expect(result.slides.map((slide) => slide.order)).toEqual([10, 20, 30, 40])
  })
})
