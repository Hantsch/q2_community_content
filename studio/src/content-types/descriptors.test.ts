import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readContentRepo } from '../content-repo/read-content-repo'
import type { ContentTypeSource } from './descriptor'
import { createContentTypeRegistry } from './registry'

// `studio/src/content-types/` → `studio/tests/fixtures/content-repo/ok`.
const okFixtureRoot = fileURLToPath(
  new URL('../../tests/fixtures/content-repo/ok', import.meta.url),
)

// `studio/src/content-types/` → repository root.
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * The fixture stand-in for story 015's file bridge: story 010's Node reader (fine in Vitest, never
 * in the browser) wrapped in the source shape the registry injects.
 */
const fixtureSource: ContentTypeSource = {
  read: () => Promise.resolve(readContentRepo({ repoRoot: okFixtureRoot })),
}

describe('the six content-type descriptors', () => {
  it('news declares its directory, index file, reader and validators and reads the fixture repository through the registry', async () => {
    const news = createContentTypeRegistry({ source: fixtureSource })[0]

    expect(news.id).toBe('news')
    expect(news.state).toBe('implemented')
    expect(news.directory).toBe('news')
    expect(news.indexFile).toBe('index.json')
    expect(news.reader).toBeDefined()
    expect(news.validators).toBeDefined()

    const read = await news.reader!()
    expect(read.index.parsed).toBe(true)

    // The wiring, not the fixture's exact numbers: both validators run on the real fixture read.
    const report = news.validators!.buildReport(read, new Date('2026-01-02T00:00:00Z'))
    expect(report.entries.map((entry) => entry.id)).toEqual(['first-post', 'nested-post'])
    expect(report.findings.filter((finding) => finding.severity === 'error')).toEqual([])

    const findings = news.validators!.collectFindings(read)
    expect(Array.isArray(findings)).toBe(true)
    expect(findings.every((finding) => typeof finding.kind === 'string')).toBe(true)
  })

  it('the other five carry their declared state and no reader', () => {
    const registry = createContentTypeRegistry({ source: fixtureSource })
    const others = registry.slice(1)

    expect(
      others.map(({ id, state, directory, indexFile, conceptPath }) => ({
        id,
        state,
        directory,
        indexFile,
        conceptPath,
      })),
    ).toEqual([
      {
        id: 'engines',
        state: 'launcher-reads',
        directory: 'engines',
        indexFile: 'manifest.json',
        conceptPath: undefined,
      },
      {
        id: 'gamedata',
        state: 'launcher-reads',
        directory: 'gamedata',
        indexFile: 'manifest.json',
        conceptPath: undefined,
      },
      {
        id: 'packs',
        state: 'reserved',
        directory: 'packs',
        indexFile: undefined,
        conceptPath: 'docs/concepts/packs-content.md',
      },
      {
        id: 'mods',
        state: 'reserved',
        directory: 'mods',
        indexFile: undefined,
        conceptPath: 'docs/concepts/mods-content.md',
      },
      {
        id: 'config_templates',
        state: 'reserved',
        directory: 'config_templates',
        indexFile: undefined,
        conceptPath: 'docs/concepts/config-templates-content.md',
      },
    ])

    for (const descriptor of others) {
      expect(descriptor.reader).toBeUndefined()
      expect(descriptor.validators).toBeUndefined()
    }
  })

  it('every reserved descriptor links a concept document that exists', () => {
    const registry = createContentTypeRegistry({ source: fixtureSource })
    const reserved = registry.filter((descriptor) => descriptor.state === 'reserved')

    expect(reserved.length).toBeGreaterThan(0)

    for (const descriptor of reserved) {
      expect(descriptor.conceptPath).toBeDefined()
      const conceptFile = `${repoRoot}${descriptor.conceptPath}`
      expect(existsSync(conceptFile)).toBe(true)
    }
  })
})
