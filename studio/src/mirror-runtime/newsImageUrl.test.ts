import { describe, expect, it } from 'vitest'
import { NEWS_IMAGE_URL_PREFIX, newsImageUrl } from './newsImageUrl'

describe('newsImageUrl', () => {
  it('prefixes a bare file name with the middleware prefix', () => {
    expect(newsImageUrl('cover-community-welcome.png')).toBe(
      `${NEWS_IMAGE_URL_PREFIX}cover-community-welcome.png`,
    )
  })

  it('rejects a name carrying a path separator, an empty string, or a leading dot', () => {
    expect(() => newsImageUrl('')).toThrow()
    expect(() => newsImageUrl('sub/dir.png')).toThrow()
    expect(() => newsImageUrl('sub\\dir.png')).toThrow()
    expect(() => newsImageUrl('.hidden.png')).toThrow()
  })
})
