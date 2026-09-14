/**
 * Story 016 D1: proves the three rules `library-model.ts` encodes - delivered order off the
 * pipeline's own positions, the dropped > draft > visibility precedence with the data each status
 * carries, and `empty` never being confused with `unreadable`.
 *
 * The fixture-backed cases run the real reader over `studio/tests/fixtures/content-repo`, so the
 * model is exercised against the shapes story 010 actually produces; the state cases the fixture
 * tree cannot trigger (scheduled, expired, dropped, template mismatch) are built in-code from
 * story 011's own `buildNewsTreeFixture`, wrapped in the same `ContentRepoRead` shape.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type {
  ContentRepoDocument,
  ContentRepoDraft,
  ContentRepoRead,
} from '../content-repo/read-content-repo'
import { readContentRepo } from '../content-repo/read-content-repo'
import { buildNewsReport } from '../report/build-news-report'
import { collectRepositoryFindings, toRepositoryScan } from '../report/repository-findings'
import type { RepositoryFinding } from '../report/repository-findings'
import {
  buildNewsTreeFixture,
  type EntryDescription,
  type NewsTreeFixture,
} from '../report/__fixtures__/news-tree'
import { buildLibraryModel } from './library-model'
import type { LibraryModel } from './library-types'

const NOW = new Date('2026-09-14T00:00:00.000Z')

// `studio/src/library/` → `studio/tests/fixtures/content-repo/`.
const fixturesRoot = fileURLToPath(new URL('../../tests/fixtures/content-repo/', import.meta.url))

/** Wraps an in-memory news tree in the `ContentRepoRead` shape story 010's reader would return for
 * it: index parsed, every named document present, no findings. */
function readFromTree(
  fixture: NewsTreeFixture,
  drafts: readonly ContentRepoDraft[] = [],
): ContentRepoRead {
  const documents: Record<string, ContentRepoDocument> = {}
  for (const [file, text] of Object.entries(fixture.documents)) documents[file] = { text }

  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents,
    drafts,
    images: [],
    findings: [],
  }
}

/** The full chain a caller runs: report over the read, then the model over both. */
function modelFrom(
  read: ContentRepoRead,
  repositoryFindings: readonly RepositoryFinding[] = [],
): LibraryModel {
  const documents: Record<string, string> = {}
  for (const [file, document] of Object.entries(read.documents)) documents[file] = document.text

  const report = buildNewsReport({ index: read.index.value, documents, now: NOW })
  return buildLibraryModel({ read, report, repositoryFindings })
}

function modelFromEntries(entries: readonly EntryDescription[]): LibraryModel {
  return modelFrom(readFromTree(buildNewsTreeFixture(entries)))
}

describe('buildLibraryModel', () => {
  it('published rows come back in delivered order', () => {
    // Declared in the index as last, first, middle - so any row order that merely echoes the index
    // (or the report's own entry array) fails this.
    const model = modelFromEntries([
      { id: 'last', template: 'text', title: 'Last', body: 'Body', order: '30' },
      { id: 'first', template: 'text', title: 'First', body: 'Body', order: '10' },
      { id: 'middle', template: 'banner', title: 'Middle', body: 'Body', order: '20' },
    ])

    expect(model.state).toBe('ready')
    expect(model.entries.map((row) => row.id)).toEqual(['first', 'middle', 'last'])
    expect(model.entries.map((row) => row.order)).toEqual([10, 20, 30])
    expect(model.entries.map((row) => row.title)).toEqual(['First', 'Middle', 'Last'])
    expect(model.entries.map((row) => row.status)).toEqual(['published', 'published', 'published'])
    expect(model.entries.map((row) => row.declaredTemplate)).toEqual(['text', 'banner', 'text'])
    expect(model.entries.map((row) => row.deliveredTemplate)).toEqual(['text', 'banner', 'text'])
    expect(model.entries.every((row) => !row.templatesDiffer)).toBe(true)
  })

  it('a scheduled row carries the date it becomes visible', () => {
    const model = modelFromEntries([
      { id: 'later', template: 'text', title: 'Later', body: 'Body', visibleFrom: '2026-12-01' },
    ])

    expect(model.entries).toHaveLength(1)
    expect(model.entries[0].status).toBe('scheduled')
    expect(model.entries[0].visibilityDate).toBe('2026-12-01')
    expect(model.entries[0].dropReason).toBeUndefined()
  })

  it('an expired row carries the date it stopped being visible', () => {
    const model = modelFromEntries([
      { id: 'gone', template: 'text', title: 'Gone', body: 'Body', visibleUntil: '2026-01-01' },
    ])

    expect(model.entries).toHaveLength(1)
    expect(model.entries[0].status).toBe('expired')
    expect(model.entries[0].visibilityDate).toBe('2026-01-01')
  })

  it('a dropped row carries the reason the report already classified', () => {
    // No title at all: the fallback template shape needs one, so the pipeline drops the entry and
    // the report classifies it as `template-unresolvable`.
    const model = modelFromEntries([{ id: 'broken', body: 'Body without a title' }])

    expect(model.entries).toHaveLength(1)
    const row = model.entries[0]
    expect(row.status).toBe('dropped')
    expect(row.dropReason).toBe(
      row.verdict?.findings.find((finding) => finding.severity === 'error')?.message,
    )
    expect(row.dropReason).toMatch(/^dropped: /)
    expect(row.order).toBeUndefined()
    expect(row.deliveredTemplate).toBeUndefined()
  })

  it('dropped wins over the visibility state for the same entry', () => {
    // Scheduled *and* unresolvable: the precedence decides which of the two an author sees first.
    const model = modelFromEntries([
      { id: 'broken', body: 'Body without a title', visibleFrom: '2026-12-01' },
    ])

    expect(model.entries[0].status).toBe('dropped')
    expect(model.entries[0].visibilityDate).toBeUndefined()
  })

  it('a delivered template that differs from the declared one keeps both', () => {
    // `split` needs an image; without one the pipeline falls back to `text`.
    const model = modelFromEntries([
      { id: 'fallback', template: 'split', title: 'Fallback', body: 'Body' },
    ])

    const row = model.entries[0]
    expect(row.declaredTemplate).toBe('split')
    expect(row.deliveredTemplate).toBe('text')
    expect(row.templatesDiffer).toBe(true)
  })

  it('drafts come back as their own list, with no order and no delivered template', () => {
    const read = readContentRepo({ repoRoot: `${fixturesRoot}ok` })
    const repositoryFindings = collectRepositoryFindings(toRepositoryScan(read))

    const model = modelFrom(read, repositoryFindings)

    expect(model.state).toBe('ready')
    expect(model.entries.map((row) => row.id)).toEqual(['first-post', 'nested-post'])
    expect(model.entries.every((row) => row.status === 'published')).toBe(true)

    expect(model.drafts.map((row) => row.id)).toEqual([
      'news/2026-01-03-unnamed-draft.md',
      'news/nested/2026-01-04-nested-draft.md',
    ])
    expect(model.drafts.map((row) => row.title)).toEqual(['Unnamed draft', 'Nested draft'])
    for (const draft of model.drafts) {
      expect(draft.status).toBe('draft')
      expect(draft.order).toBeUndefined()
      expect(draft.deliveredTemplate).toBeUndefined()
      expect(draft.templatesDiffer).toBe(false)
    }

    // Repository-level findings are passed through untouched - they explain the tree, they never
    // decide the state.
    expect(model.repositoryFindings).toBe(repositoryFindings)
  })

  it('a readable but wholly empty news directory is empty, not unreadable', () => {
    const model = modelFrom(readFromTree(buildNewsTreeFixture([])))

    expect(model.state).toBe('empty')
    expect(model.entries).toEqual([])
    expect(model.drafts).toEqual([])
    expect(model.unreadableFindings).toEqual([])
  })

  it('an index that did not parse is unreadable, and names the reader finding that says so', () => {
    const read = readContentRepo({ repoRoot: `${fixturesRoot}broken-index` })

    const model = modelFrom(read)

    expect(model.state).toBe('unreadable')
    expect(model.entries).toEqual([])
    // The fixture tree does hold `.md` files; an unreadable index must not leak them as a list
    // that looks complete.
    expect(model.drafts).toEqual([])
    expect(model.unreadableFindings.map((finding) => finding.code)).toContain('index-unparseable')
  })

  it('missing input is unreadable rather than a throw', () => {
    const model = buildLibraryModel({
      read: undefined,
      report: undefined,
      repositoryFindings: undefined,
    })

    expect(model.state).toBe('unreadable')
    expect(model.entries).toEqual([])
    expect(model.drafts).toEqual([])
  })
})
