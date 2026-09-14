import { describe, expect, it } from 'vitest'

import type { ContentSourceRead, ContentTypeSource } from './descriptor'
import { createContentTypeRegistry, unavailableFileBridgeSource } from './registry'

const EMPTY_READ: ContentSourceRead = {
  repoRoot: '/nowhere',
  index: { text: '', value: undefined, parsed: false },
  documents: {},
  drafts: [],
  images: [],
  findings: [],
}

/** A source that records which directories it was asked for, so a leak between two registries shows. */
function recordingSource(): ContentTypeSource & { readonly calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    read: (directory) => {
      calls.push(directory)
      return Promise.resolve(EMPTY_READ)
    },
  }
}

describe('createContentTypeRegistry', () => {
  it('returns the six content types in their fixed order', () => {
    const registry = createContentTypeRegistry({ source: recordingSource() })

    expect(registry.map((descriptor) => descriptor.id)).toEqual([
      'news',
      'engines',
      'gamedata',
      'packs',
      'mods',
      'config_templates',
    ])
  })

  it('binds each call to its own source, with no leak between calls', async () => {
    const first = recordingSource()
    const second = recordingSource()

    const firstRegistry = createContentTypeRegistry({ source: first })
    const secondRegistry = createContentTypeRegistry({ source: second })

    // Descriptors are built per call, never shared out of a module-level array.
    expect(secondRegistry[0]).not.toBe(firstRegistry[0])

    await firstRegistry[0].reader?.()
    expect(first.calls).toEqual(['news'])
    expect(second.calls).toEqual([])

    await secondRegistry[0].reader?.()
    expect(first.calls).toEqual(['news'])
    expect(second.calls).toEqual(['news'])
  })

  it('falls back to the unavailable file bridge, which reports instead of throwing', async () => {
    const registry = createContentTypeRegistry()

    const read = await registry[0].reader?.()

    expect(read?.index.parsed).toBe(false)
    expect(read?.documents).toEqual({})
    expect(read?.findings.map((finding) => finding.code)).toEqual(['file-bridge-unavailable'])
  })

  it('never throws when the unavailable file bridge is asked to read', async () => {
    await expect(unavailableFileBridgeSource.read('news')).resolves.toBeDefined()
  })
})
