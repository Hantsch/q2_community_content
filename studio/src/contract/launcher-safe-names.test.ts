import { describe, expect, it } from 'vitest'

import {
  SAFE_NEWS_IMAGE_EXTENSIONS,
  isSafeDeclaredImagePath,
  isSafeNewsDocumentName,
} from './launcher-safe-names'

describe('launcher-safe-names', () => {
  it('the safe-name door exposes the launcher’s own predicates', () => {
    expect(typeof isSafeNewsDocumentName).toBe('function')
    expect(typeof isSafeDeclaredImagePath).toBe('function')
    expect(Array.isArray(SAFE_NEWS_IMAGE_EXTENSIONS)).toBe(true)
    expect(SAFE_NEWS_IMAGE_EXTENSIONS.length).toBeGreaterThan(0)
  })

  it('classifies a known-good and a known-bad document name', () => {
    expect(isSafeNewsDocumentName('post.md')).toBe(true)
    // A `/` is refused outright, which rules out traversal in the same check.
    expect(isSafeNewsDocumentName('../secrets.md')).toBe(false)
  })

  it('classifies a known-good and a known-bad declared image path', () => {
    // How D3 writes a declared image: `image: img/<file>.png`, relative to `news/`.
    expect(isSafeDeclaredImagePath('img/example.png')).toBe(true)
    // A `..` segment climbs out of `news/`; a leading `/` makes it absolute. Both are refused.
    expect(isSafeDeclaredImagePath('../../etc/passwd')).toBe(false)
    expect(isSafeDeclaredImagePath('/img/example.png')).toBe(false)
  })
})
