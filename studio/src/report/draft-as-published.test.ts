/**
 * Story 020 D1: the criterion is equivalence - a draft folded in gets exactly the verdict the same
 * document gets as a real last index row - not the shape of the folded read.
 */
import { describe, expect, it } from 'vitest'

import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { toNewsReportInput } from '../content-types/descriptors'
import { buildNewsTreeFixture, type EntryDescription } from './__fixtures__/news-tree'
import { buildNewsReport } from './build-news-report'
import { withDraftAsPublished } from './draft-as-published'

const NOW = new Date('2026-09-14T00:00:00.000Z')
const DRAFT_PATH = 'news/drafts/new-post.md'

function makeRead(
  entries: readonly EntryDescription[],
  draftText: string,
  images: string[] = [],
): ContentRepoRead {
  const fixture = buildNewsTreeFixture(entries)
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents: Object.fromEntries(
      Object.entries(fixture.documents).map(([file, text]) => [file, { text }]),
    ),
    drafts: [{ path: DRAFT_PATH, text: draftText }],
    images: images.map((name) => ({ name, path: `news/img/${name}`, bytes: 100 })),
    findings: [],
  }
}

function draftDocument(lines: string[]): string {
  return ['---', ...lines, '---', 'Body'].join('\n')
}

/** The draft's verdict after folding, and the verdict of the same document as a real last row. */
function bothVerdicts(read: ContentRepoRead) {
  const folded = withDraftAsPublished(read, DRAFT_PATH)
  if (folded === undefined) throw new Error('expected a folded read')
  const foldedReport = buildNewsReport(toNewsReportInput(folded.read, NOW))
  const asDraft = foldedReport.entries.find((entry) => entry.id === folded.entryId)

  const draftText = read.drafts[0]?.text ?? ''
  const published: ContentRepoRead = {
    ...read,
    index: {
      ...read.index,
      value: {
        ...(read.index.value as object),
        entries: [
          ...(read.index.value as { entries: unknown[] }).entries,
          { id: 'published-twin', file: 'published-twin.md' },
        ],
      },
    },
    documents: { ...read.documents, 'published-twin.md': { text: draftText } },
    drafts: [],
  }
  const publishedReport = buildNewsReport(toNewsReportInput(published, NOW))
  const asPublished = publishedReport.entries.find((entry) => entry.id === 'published-twin')
  return { asDraft, asPublished }
}

const findingsOf = (verdict: { findings: { kind: string; message: string }[] } | undefined) =>
  verdict?.findings.map(({ kind, message }) => ({ kind, message }))

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

describe('withDraftAsPublished', () => {
  it('folding a draft in leaves the read it was given untouched', () => {
    const read = makeRead(
      [{ id: 'a', template: 'text', title: 'A', body: 'Body', order: '10' }],
      draftDocument(['template: text', 'title: D', 'order: 20']),
    )
    const before = structuredClone(read)
    deepFreeze(read)

    const folded = withDraftAsPublished(read, DRAFT_PATH)

    expect(folded).toBeDefined()
    expect(read).toEqual(before)
    expect(folded?.read).not.toBe(read)
    expect(folded?.read.drafts).toEqual([])
  })

  it('a draft cover with a missing image gets the verdict it would get as a published row', () => {
    const read = makeRead(
      [{ id: 'a', template: 'cover', title: 'A', body: 'Body', image: 'a.png', order: '10' }],
      draftDocument(['template: cover', 'title: D', 'image: ', 'order: 20']),
      ['a.png'],
    )

    const { asDraft, asPublished } = bothVerdicts(read)

    expect(asDraft).toBeDefined()
    expect(asDraft?.delivered).not.toBe('dropped')
    if (asDraft?.delivered !== 'dropped' && asDraft !== undefined) {
      expect(asDraft.delivered.template).toBe('text')
    }
    expect(asDraft?.delivered).toEqual(asPublished?.delivered)
    expect(findingsOf(asDraft)).toEqual(findingsOf(asPublished))
    expect(findingsOf(asDraft)?.length).toBeGreaterThan(0)
  })

  it("a draft whose frontmatter does not parse is dropped with the pipeline's own reason", () => {
    const read = makeRead(
      [{ id: 'a', template: 'text', title: 'A', body: 'Body', order: '10' }],
      'no frontmatter here',
    )

    const { asDraft, asPublished } = bothVerdicts(read)

    expect(asDraft?.delivered).toBe('dropped')
    const draftError = asDraft?.findings.find((finding) => finding.severity === 'error')
    const publishedError = asPublished?.findings.find((finding) => finding.severity === 'error')
    expect(draftError?.message).toBeTruthy()
    expect(draftError?.message).toBe(publishedError?.message)
  })

  it('a draft takes the delivered position its frontmatter order gives it', () => {
    const read = makeRead(
      [
        { id: 'a', template: 'text', title: 'A', body: 'Body', order: '10' },
        { id: 'b', template: 'text', title: 'B', body: 'Body', order: '30' },
      ],
      draftDocument(['template: text', 'title: D', 'order: 20']),
    )

    const { asDraft, asPublished } = bothVerdicts(read)

    expect(asDraft?.delivered).not.toBe('dropped')
    if (asDraft !== undefined && asDraft.delivered !== 'dropped') {
      expect(asDraft.delivered.position).toBe(1)
    }
    expect(asDraft?.delivered).toEqual(asPublished?.delivered)
  })

  it("a draft without order sorts last with the pipeline's warning", () => {
    const read = makeRead(
      [
        { id: 'a', template: 'text', title: 'A', body: 'Body', order: '10' },
        { id: 'b', template: 'text', title: 'B', body: 'Body', order: '30' },
      ],
      draftDocument(['template: text', 'title: D']),
    )

    const { asDraft, asPublished } = bothVerdicts(read)

    expect(asDraft?.delivered).not.toBe('dropped')
    if (asDraft !== undefined && asDraft.delivered !== 'dropped') {
      expect(asDraft.delivered.position).toBe(2)
    }
    expect(findingsOf(asDraft)).toEqual(findingsOf(asPublished))
    expect(asDraft?.findings.some((finding) => finding.severity === 'warning')).toBe(true)
  })

  it('an unknown draft path or an unparsed index yields undefined', () => {
    const read = makeRead(
      [{ id: 'a', template: 'text', title: 'A', body: 'Body' }],
      draftDocument(['title: D']),
    )
    const unparsed: ContentRepoRead = {
      ...read,
      index: { text: '{', value: undefined, parsed: false },
    }
    const noEntries: ContentRepoRead = {
      ...read,
      index: { text: '{}', value: { schemaVersion: 1 }, parsed: true },
    }

    expect(withDraftAsPublished(read, 'news/drafts/other.md')).toBeUndefined()
    expect(withDraftAsPublished(unparsed, DRAFT_PATH)).toBeUndefined()
    expect(withDraftAsPublished(noEntries, DRAFT_PATH)).toBeUndefined()
  })
})
