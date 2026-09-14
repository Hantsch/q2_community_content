// @vitest-environment jsdom
/**
 * Story 016 D4: proves the hook's contract against the `news` descriptor built the same way
 * `createContentTypeRegistry` builds it (`createContentTypeDescriptors(source)`), with a fixture
 * `ContentTypeSource` standing in for the bridge — loading first, then a resolved model without
 * ever throwing, plus `thumbnailUrlFor`'s two outcomes.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ContentRepoDocument, ContentRepoRead } from '../content-repo/read-content-repo'
import type { ContentTypeDescriptor, ContentTypeSource } from '../content-types/descriptor'
import { createContentTypeDescriptors } from '../content-types/descriptors'
import { buildNewsTreeFixture } from '../report/__fixtures__/news-tree'
import type { LibraryRow } from './library-types'
import { useNewsLibrary } from './use-news-library'

const NOW = () => new Date('2026-09-14T00:00:00.000Z')

/** Wraps an in-memory news tree in the `ContentRepoRead` shape story 010's reader would return
 * for it, mirroring `library-model.test.ts`'s own `readFromTree`. */
function readFromTree(fixture: ReturnType<typeof buildNewsTreeFixture>): ContentRepoRead {
  const documents: Record<string, ContentRepoDocument> = {}
  for (const [file, text] of Object.entries(fixture.documents)) documents[file] = { text }

  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents,
    drafts: [],
    images: [],
    findings: [],
  }
}

const UNREADABLE_READ: ContentRepoRead = {
  repoRoot: '/fixture',
  index: { text: '', value: undefined, parsed: false },
  documents: {},
  drafts: [],
  images: [],
  findings: [
    { code: 'index-missing', severity: 'error', message: 'news/index.json is missing.', path: 'news/index.json' },
  ],
}

/** Builds the `news` descriptor the same way `createContentTypeRegistry` does, bound to a fixture
 * source that always resolves to `read` — the hook must take this descriptor, never a global. */
function newsDescriptorFor(read: ContentRepoRead): ContentTypeDescriptor {
  const source: ContentTypeSource = { read: () => Promise.resolve(read) }
  const descriptor = createContentTypeDescriptors(source).find((entry) => entry.id === 'news')
  if (!descriptor) throw new Error('news descriptor missing from createContentTypeDescriptors()')
  return descriptor
}

describe('useNewsLibrary', () => {
  it('starts loading, then resolves a populated model', async () => {
    const read = readFromTree(
      buildNewsTreeFixture([
        { id: 'welcome', template: 'text', title: 'Welcome', body: 'Body', order: '10', image: 'cover.png' },
      ]),
    )
    const descriptor = newsDescriptorFor(read)

    const { result } = renderHook(() => useNewsLibrary(descriptor, NOW))

    expect(result.current.loading).toBe(true)
    expect(result.current.model).toBeNull()

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.model?.state).toBe('ready')
    expect(result.current.model?.entries).toHaveLength(1)
    expect(result.current.model?.entries[0]?.title).toBe('Welcome')
  })

  it('resolves an unreadable read to the unreadable state without throwing', async () => {
    const descriptor = newsDescriptorFor(UNREADABLE_READ)

    const { result } = renderHook(() => useNewsLibrary(descriptor, NOW))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.model?.state).toBe('unreadable')
  })

  it('resolves a thumbnail URL for a row with an image and none for a row without one', async () => {
    const read = readFromTree(buildNewsTreeFixture([]))
    const descriptor = newsDescriptorFor(read)

    const { result } = renderHook(() => useNewsLibrary(descriptor, NOW))
    await waitFor(() => expect(result.current.loading).toBe(false))

    const withImage: LibraryRow = {
      id: 'welcome',
      file: 'news/welcome.md',
      status: 'published',
      templatesDiffer: false,
      image: 'img/cover-welcome.png',
    }
    const withoutImage: LibraryRow = {
      id: 'no-image',
      file: 'news/no-image.md',
      status: 'published',
      templatesDiffer: false,
    }

    expect(result.current.thumbnailUrlFor(withImage)).toBe('/news-img/cover-welcome.png')
    expect(result.current.thumbnailUrlFor(withoutImage)).toBeUndefined()
  })

  it('resolves a refused image name to undefined instead of throwing', async () => {
    const read = readFromTree(buildNewsTreeFixture([]))
    const descriptor = newsDescriptorFor(read)

    const { result } = renderHook(() => useNewsLibrary(descriptor, NOW))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // `newsImageUrl()` rejects a dot-prefixed bare name; a row declaring one must still resolve
    // (to `undefined`, i.e. a placeholder), not throw during render.
    const dotPrefixed: LibraryRow = {
      id: 'hidden',
      file: 'news/hidden.md',
      status: 'published',
      templatesDiffer: false,
      image: 'img/.cover.png',
    }

    expect(() => result.current.thumbnailUrlFor(dotPrefixed)).not.toThrow()
    expect(result.current.thumbnailUrlFor(dotPrefixed)).toBeUndefined()
  })
})
