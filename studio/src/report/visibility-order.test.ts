/**
 * Story 011 D5: proves AC6 (published/scheduled/expired against the supplied clock, never the wall
 * clock) and AC7 (delivered position, and the index-order tie-break for entries sharing an
 * `order`), plus the two Decisions (Sprint) that shape both: scheduled/expired are `info`, not a
 * finding/drop, and an entry with no usable `order` keeps reporting the pipeline's own "sorts after
 * the ordered ones" reason unchanged. Exercised through `buildNewsReport()`, the same way D3/D4's
 * tests are, since that is the only place `now` and the two slide lists come together.
 */
import { describe, expect, it } from 'vitest'
import { buildNewsReport } from './build-news-report'
import { buildNewsTreeFixture } from './__fixtures__/news-tree'

const NOW = new Date('2026-09-14T00:00:00.000Z')

// Deliberately far from the real wall-clock date (today, per the environment, is 2026-09-14 - see
// `NOW` above, used by every other describe block in this file). AC6 requires the supplied clock,
// never `new Date()`, to decide published/scheduled/expired; a fixture whose `now` and bounds all
// sit on the same side of the *real* wall-clock date would still pass against an implementation
// that accidentally read the wall clock instead of `now`. Picking a `now` in the past, with
// `visibleFrom` chosen to sit between this `now` and the real wall-clock date, makes a wall-clock
// implementation visibly flip `scheduled` to `published` - it would see that date as already past.
const NOW_PAST = new Date('2020-01-01T00:00:00.000Z')

describe('visibility verdicts', () => {
  it('visibility is published, scheduled or expired against the supplied clock', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'future', title: 'Future', body: 'Body', visibleFrom: '2020-06-01T00:00:00.000Z' },
      { id: 'past', title: 'Past', body: 'Body', visibleUntil: '2019-06-01T00:00:00.000Z' },
      { id: 'now', title: 'Now', body: 'Body' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW_PAST })
    const byId = Object.fromEntries(report.entries.map((entry) => [entry.id, entry]))

    expect(byId.future.visibility).toEqual({
      state: 'scheduled',
      visibleFrom: '2020-06-01T00:00:00.000Z',
    })
    const scheduledFinding = byId.future.findings.find((f) => f.kind === 'scheduled')
    expect(scheduledFinding).toBeDefined()
    expect(scheduledFinding?.severity).toBe('info')

    expect(byId.past.visibility).toEqual({
      state: 'expired',
      visibleUntil: '2019-06-01T00:00:00.000Z',
    })
    const expiredFinding = byId.past.findings.find((f) => f.kind === 'expired')
    expect(expiredFinding).toBeDefined()
    expect(expiredFinding?.severity).toBe('info')

    expect(byId.now.visibility).toEqual({ state: 'published' })
    expect(byId.now.findings.some((f) => f.kind === 'scheduled' || f.kind === 'expired')).toBe(
      false,
    )
  })

  it('scheduled and expired entries are not counted as dropped', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'future', title: 'Future', body: 'Body', visibleFrom: '2020-06-01T00:00:00.000Z' },
      { id: 'past', title: 'Past', body: 'Body', visibleUntil: '2019-06-01T00:00:00.000Z' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW_PAST })

    expect(report.summary.dropped).toBe(0)
    for (const entry of report.entries) {
      expect(entry.delivered).not.toBe('dropped')
      if (entry.delivered !== 'dropped') expect(entry.delivered.position).toBeUndefined()
    }
  })
})

describe('order verdicts', () => {
  it('two entries sharing an order value are flagged with the tie-break', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'first', title: 'First', body: 'Body', order: '5' },
      { id: 'second', title: 'Second', body: 'Body', order: '5' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const byId = Object.fromEntries(report.entries.map((entry) => [entry.id, entry]))

    const firstTie = byId.first.findings.find((f) => f.kind === 'order-tie')
    const secondTie = byId.second.findings.find((f) => f.kind === 'order-tie')
    expect(firstTie).toBeDefined()
    expect(secondTie).toBeDefined()
    expect(firstTie?.message).toContain('second')
    expect(firstTie?.message).toContain('first')
    expect(firstTie?.message).toMatch(/'first' is delivered first|"first" is delivered first/)
    expect(secondTie?.message).toMatch(/'first' is delivered first|"first" is delivered first/)

    expect(byId.first.delivered !== 'dropped' && byId.first.delivered.position).toBe(0)
    expect(byId.second.delivered !== 'dropped' && byId.second.delivered.position).toBe(1)
  })

  it('the tie-break names whichever tied entry is actually delivered, not the one filtered out even though it resolves first', () => {
    // 'earliest' comes first in index order (so it is first in the unfiltered `resolvedSlides`) but
    // is expired and therefore never reaches `deliveredSlides`; 'later' shares its order and *is*
    // delivered. The tie-break must name 'later' as "delivered first", never 'earliest' - naming an
    // entry that was never delivered as "delivered first" would be simply wrong.
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'earliest',
        title: 'Earliest',
        body: 'Body',
        order: '5',
        visibleUntil: '2020-01-01T00:00:00.000Z',
      },
      { id: 'later', title: 'Later', body: 'Body', order: '5' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const byId = Object.fromEntries(report.entries.map((entry) => [entry.id, entry]))

    expect(byId.earliest.visibility.state).toBe('expired')
    expect(byId.later.visibility.state).toBe('published')

    const earliestTie = byId.earliest.findings.find((f) => f.kind === 'order-tie')
    const laterTie = byId.later.findings.find((f) => f.kind === 'order-tie')
    expect(earliestTie).toBeDefined()
    expect(laterTie).toBeDefined()
    expect(earliestTie?.message).toMatch(/'later' is delivered first|"later" is delivered first/)
    expect(laterTie?.message).toMatch(/'later' is delivered first|"later" is delivered first/)
    expect(earliestTie?.message).not.toMatch(
      /'earliest' is delivered first|"earliest" is delivered first/,
    )
  })

  it('a duplicate-id row does not borrow the surviving row\'s order-tie finding', () => {
    // 'a' (kept) and 'b' share order 5, so both get a tie finding naming 'a' as delivered first. The
    // second 'a' row is a duplicate id and is dropped before it ever reaches `resolvedSlides` - it
    // must get its own duplicate-id error, never the kept row's order-tie finding (nor that row's
    // `file`) just because they share the same `id` string.
    const { index, documents } = buildNewsTreeFixture([
      { id: 'a', file: 'a.md', title: 'A', body: 'Body', order: '5' },
      { id: 'a', file: 'a-dup.md', title: 'A2', body: 'Body', order: '5' },
      { id: 'b', title: 'B', body: 'Body', order: '5' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const [firstA, duplicateA, entryB] = report.entries

    expect(firstA.findings.some((f) => f.kind === 'order-tie')).toBe(true)
    expect(entryB.findings.some((f) => f.kind === 'order-tie')).toBe(true)

    expect(duplicateA.delivered).toBe('dropped')
    expect(duplicateA.findings.some((f) => f.kind === 'duplicate-id')).toBe(true)
    expect(duplicateA.findings.some((f) => f.kind === 'order-tie')).toBe(false)
  })

  it('entries with no usable order report the pipeline\'s own "sorts after the ordered ones" reason', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'no-order', title: 'No order', body: 'Body' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    const entry = report.entries[0]
    const finding = entry.findings.find((f) => f.kind === 'order-missing')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('warning')
    expect(finding?.message).toBe('no usable order value; this entry sorts after the ordered ones')
    // Two entries with no usable order both fall back to the same sentinel order value, which is
    // not an authored tie - only the pipeline's own "sorts after" reason should apply, no order-tie.
    expect(entry.findings.some((f) => f.kind === 'order-tie')).toBe(false)
  })

  it('two entries with no usable order are not flagged as an order tie with each other', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'no-order-a', title: 'A', body: 'Body' },
      { id: 'no-order-b', title: 'B', body: 'Body' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    expect(
      report.entries.every((entry) => !entry.findings.some((f) => f.kind === 'order-tie')),
    ).toBe(true)
  })
})
