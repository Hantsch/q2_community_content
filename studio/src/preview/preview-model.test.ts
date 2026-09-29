/**
 * Story 018 D1: the preview model's observable behaviour — what an author sees for one entry.
 * Inline fixtures over `buildNewsTreeFixture`, reports built by the same `buildNewsReport` the
 * library uses, so the verdicts are the pipeline's own.
 */
import { describe, expect, it } from 'vitest'

import type { ContentSourceRead } from '../content-types/descriptor'
import { toNewsReportInput } from '../content-types/descriptors'
import { resolveFeed } from '../contract/launcher-contract'
import { buildNewsTreeFixture, type EntryDescription } from '../report/__fixtures__/news-tree'
import { buildNewsReport } from '../report/build-news-report'
import { buildSlidePreviewModel } from './preview-model'

const NOW = new Date('2026-09-14T00:00:00.000Z')

function setup(
  entries: readonly EntryDescription[],
  options: { images?: string[]; drafts?: { path: string; text: string }[] } = {},
) {
  const fixture = buildNewsTreeFixture(entries)
  const read: ContentSourceRead = {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents: Object.fromEntries(
      Object.entries(fixture.documents).map(([file, text]) => [file, { text }]),
    ),
    drafts: options.drafts ?? [],
    images: (options.images ?? []).map((name) => ({ name, path: `news/img/${name}`, bytes: 100 })),
    findings: [],
  }
  const report = buildNewsReport(toNewsReportInput(read, NOW))
  return { read, report }
}

describe('buildSlidePreviewModel', () => {
  it('is idle without a selection, a read or a report', () => {
    const { read, report } = setup([{ id: 'a', template: 'text', title: 'A' }])
    expect(buildSlidePreviewModel({ read, report, entryId: null })).toEqual({ state: 'idle' })
    expect(buildSlidePreviewModel({ read: null, report, entryId: 'a' })).toEqual({ state: 'idle' })
    expect(buildSlidePreviewModel({ read, report: null, entryId: 'a' })).toEqual({ state: 'idle' })
  })

  it("the previewed slide is the pipeline's own resolved slide", () => {
    const { read, report } = setup(
      [{ id: 'a', template: 'text', title: '  Padded title  ', body: 'Body', image: 'cover.png' }],
      { images: ['cover.png'] },
    )
    const { index, documents } = toNewsReportInput(read, NOW)
    const expected = resolveFeed({ index, documents }).slides.find((slide) => slide.id === 'a')

    const model = buildSlidePreviewModel({ read, report, entryId: 'a' })

    expect(model).toEqual({
      state: 'slide',
      slide: { ...expected, imageUrl: '/news-img/cover.png' },
    })
    if (model.state === 'slide') expect(model.slide.title).toBe('Padded title')
  })

  it('a cover without an image previews as text', () => {
    const { read, report } = setup([{ id: 'c', template: 'cover', title: 'Cover', body: 'Body' }])

    const model = buildSlidePreviewModel({ read, report, entryId: 'c' })

    expect(model.state).toBe('slide')
    if (model.state === 'slide') {
      expect(model.slide.template).toBe('text')
      expect(model.slide.imageUrl).toBeUndefined()
    }
  })

  it("buttons are the pipeline's delivered buttons", () => {
    const button = (n: number, host = 'https://github.com') => ({
      label: `Button ${n}`,
      url: `${host}/q2/${n}`,
    })
    const { read, report } = setup([
      {
        id: 'b',
        template: 'text',
        title: 'Buttons',
        body: 'Body',
        buttons: [button(1), button(2), button(3, 'https://evil.example'), button(4)],
      },
    ])

    const model = buildSlidePreviewModel({ read, report, entryId: 'b' })

    expect(model.state).toBe('slide')
    if (model.state === 'slide') {
      expect(model.slide.buttons).toHaveLength(3)
      expect(model.slide.buttons.map((b) => b.label)).not.toContain('Button 3')
    }
  })

  it('an image absent from the repository yields no imageUrl', () => {
    const { read, report } = setup([
      { id: 'a', template: 'split', title: 'A', body: 'Body', image: 'missing.png' },
    ])

    const model = buildSlidePreviewModel({ read, report, entryId: 'a' })

    expect(model.state).toBe('slide')
    if (model.state === 'slide') expect(model.slide.imageUrl).toBeUndefined()
  })

  it('a dropped entry yields nothing with its reason', () => {
    const { read, report } = setup([{ id: 'x', rawDocument: 'no frontmatter at all' }])
    const verdict = report.entries[0]
    const reason = verdict?.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message)
      .join('; ')

    const model = buildSlidePreviewModel({ read, report, entryId: 'x' })

    expect(reason).toBeTruthy()
    expect(model).toEqual({ state: 'nothing', reason })
  })

  it('a scheduled or expired entry yields nothing with its date', () => {
    const { read, report } = setup([
      {
        id: 'soon',
        template: 'text',
        title: 'Soon',
        body: 'Body',
        visibleFrom: '2027-01-01T00:00:00.000Z',
      },
      {
        id: 'gone',
        template: 'text',
        title: 'Gone',
        body: 'Body',
        visibleUntil: '2026-01-01T00:00:00.000Z',
      },
    ])

    const soon = buildSlidePreviewModel({ read, report, entryId: 'soon' })
    const gone = buildSlidePreviewModel({ read, report, entryId: 'gone' })

    expect(soon.state).toBe('nothing')
    expect(soon.state === 'nothing' && soon.reason).toMatch(/^Scheduled — .*2027-01-01/)
    expect(gone.state).toBe('nothing')
    expect(gone.state === 'nothing' && gone.reason).toMatch(/^Expired — .*2026-01-01/)
  })

  it('an id without a verdict yields nothing', () => {
    const { read, report } = setup([{ id: 'a', template: 'text', title: 'A' }])

    expect(buildSlidePreviewModel({ read, report, entryId: 'draft.md' })).toEqual({
      state: 'nothing',
      reason: 'Not in news/index.json — the launcher does not show it.',
    })
  })
})
