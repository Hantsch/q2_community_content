/**
 * Story 021 D1: proves the visibility-override decision model against real report verdicts built
 * through `buildNewsReport()` with a supplied clock.
 */
import { describe, expect, it } from 'vitest'
import { buildNewsReport } from '../report/build-news-report'
import { buildNewsTreeFixture } from '../report/__fixtures__/news-tree'
import type { EntryDescription } from '../report/__fixtures__/news-tree'
import type { EntryVerdict } from '../report/report-types'
import { decidePreviewVisibility } from './visibility-override'

const NOW = new Date('2026-09-14T00:00:00.000Z')

function verdictsFor(entries: EntryDescription[]): Record<string, EntryVerdict> {
  const { index, documents } = buildNewsTreeFixture(entries)
  const report = buildNewsReport({ index, documents, now: NOW })
  return Object.fromEntries(report.entries.map((entry) => [entry.id, entry]))
}

const SCHEDULED = {
  id: 'future',
  title: 'Future',
  body: 'Body',
  visibleFrom: '2099-01-01T00:00:00Z',
}
const EXPIRED = {
  id: 'past',
  title: 'Past',
  body: 'Body',
  visibleUntil: '2020-01-01T00:00:00Z',
}

function findingMessage(verdict: EntryVerdict, kind: string): string {
  const finding = verdict.findings.find((candidate) => candidate.kind === kind)
  if (!finding) throw new Error(`fixture has no ${kind} finding`)
  return finding.message
}

describe('decidePreviewVisibility', () => {
  it("a scheduled entry is hidden with the report's reason while the override is off", () => {
    const verdict = verdictsFor([SCHEDULED]).future
    const result = decidePreviewVisibility(verdict, false)
    expect(result).toEqual({
      kind: 'hidden',
      reason: 'not yet visible; scheduled for 2099-01-01T00:00:00Z',
      overrideAvailable: true,
    })
    expect(result.kind === 'hidden' && result.reason).toBe(findingMessage(verdict, 'scheduled'))
  })

  it("an expired entry is hidden with the report's reason while the override is off", () => {
    const verdict = verdictsFor([EXPIRED]).past
    const result = decidePreviewVisibility(verdict, false)
    expect(result).toEqual({
      kind: 'hidden',
      reason: findingMessage(verdict, 'expired'),
      overrideAvailable: true,
    })
  })

  it('with the override on a scheduled or expired entry renders and is marked as an override', () => {
    const verdicts = verdictsFor([SCHEDULED, EXPIRED])
    for (const [id, kind] of [
      ['future', 'scheduled'],
      ['past', 'expired'],
    ] as const) {
      expect(decidePreviewVisibility(verdicts[id], true)).toEqual({
        kind: 'render',
        override: true,
        overrideAvailable: true,
        realState: findingMessage(verdicts[id], kind),
      })
    }
  })

  it('the override is not offered for published or dropped entries', () => {
    const report = buildNewsReport({
      ...buildNewsTreeFixture([
        { id: 'live', title: 'Live', body: 'Body' },
        { id: 'dup', file: 'dup.md', title: 'Dup', body: 'Body' },
        { id: 'dup', file: 'dup-2.md', title: 'Dup 2', body: 'Body' },
      ]),
      now: NOW,
    })
    const live = report.entries[0]
    const dropped = report.entries.find((entry) => entry.delivered === 'dropped')
    expect(dropped).toBeDefined()

    for (const overrideOn of [false, true]) {
      expect(decidePreviewVisibility(live, overrideOn)).toEqual({
        kind: 'render',
        override: false,
        overrideAvailable: false,
      })
      expect(decidePreviewVisibility(dropped as EntryVerdict, overrideOn)).toEqual({
        kind: 'deferred',
        overrideAvailable: false,
      })
    }
  })

  it('deciding the preview never modifies the verdict', () => {
    const verdicts = verdictsFor([SCHEDULED, EXPIRED, { id: 'live', title: 'Live', body: 'Body' }])
    for (const verdict of Object.values(verdicts)) {
      const before = structuredClone(verdict)
      decidePreviewVisibility(verdict, false)
      decidePreviewVisibility(verdict, true)
      expect(verdict).toEqual(before)
    }
  })

  it('a scheduled split without an image is still delivered as text under the override', () => {
    const verdict = verdictsFor([{ ...SCHEDULED, id: 'split', template: 'split' }]).split
    expect(verdict.visibility.state).toBe('scheduled')
    expect(verdict.delivered !== 'dropped' && verdict.delivered.template).toBe('text')
    expect(decidePreviewVisibility(verdict, true)).toMatchObject({ kind: 'render', override: true })
  })
})
