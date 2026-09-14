import { describe, expect, it } from 'vitest'

import type { ContentReport, EntryVerdict, ReportSummary } from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'
import { exitCodeFor, summarise } from './summary'

/** A minimal `ContentReport` for the counts this module reads - `entries` only needs a length,
 * `summary` carries the three delivery-outcome counts, `findings` is irrelevant here. */
function buildReport(overrides?: {
  entryCount?: number
  summary?: Partial<ReportSummary>
  repositoryFindings?: readonly unknown[]
}): ContentReport & { repositoryFindings?: readonly unknown[] } {
  const entryCount = overrides?.entryCount ?? 0
  return {
    entries: Array.from({ length: entryCount }, () => ({}) as unknown as EntryVerdict),
    findings: [],
    summary: {
      deliveredAsDeclared: 0,
      fallenBack: 0,
      dropped: 0,
      findingsBySeverity: { error: 0, warning: 0, info: 0 },
      ...overrides?.summary,
    },
    ...(overrides?.repositoryFindings !== undefined
      ? { repositoryFindings: overrides.repositoryFindings }
      : {}),
  }
}

describe('summarise', () => {
  it('a feed where every entry is delivered as declared summarises to all-delivered', () => {
    const report = buildReport({ entryCount: 3, summary: { deliveredAsDeclared: 3 } })

    const summary = summarise(report)

    expect(summary).toEqual({
      deliveredAsDeclared: 3,
      fallingBack: 0,
      dropped: 0,
      repositoryFindings: 0,
      total: 3,
    })
    expect(exitCodeFor(summary)).toBe(0)
  })

  it('counts entries delivered as declared, falling back, dropped and repository findings', () => {
    const report = buildReport({
      entryCount: 5,
      summary: { deliveredAsDeclared: 2, fallenBack: 1, dropped: 2 },
      repositoryFindings: ['finding-a', 'finding-b'],
    })

    const summary = summarise(report)

    expect(summary).toEqual({
      deliveredAsDeclared: 2,
      fallingBack: 1,
      dropped: 2,
      repositoryFindings: 2,
      total: 5,
    })
  })

  it('real repository findings on the report produce a non-zero count', () => {
    // Story 017 D1: `buildValidationSnapshot()` now always supplies story 013's actual findings on
    // the report it summarises, so the non-zero path is exercised with the real `RepositoryFinding`
    // shape rather than only with placeholder values.
    const repositoryFindings: readonly RepositoryFinding[] = [
      {
        kind: 'draft',
        severity: 'info',
        message: 'news/unreleased.md is not named by any news/index.json row (draft)',
        file: 'news/unreleased.md',
      },
      {
        kind: 'duplicate-id',
        severity: 'error',
        message: 'id "shared" is already used by first.md, which is kept',
        id: 'shared',
        file: 'second.md',
      },
    ]
    const report = buildReport({ entryCount: 2, repositoryFindings })

    const summary = summarise(report)

    expect(summary.repositoryFindings).toBe(2)
    // Repository findings are counted, never graded: an `error`-severity one does not by itself
    // fail the run (only dropped entries do, AC3) - asserting that here pins story 012's exit-code
    // contract now that the CLI actually feeds real findings through.
    expect(exitCodeFor(summary)).toBe(0)
    expect(exitCodeFor(summary, { strict: true })).toBe(0)
  })

  it('an absent repositoryFindings field counts as 0', () => {
    const report = buildReport({ entryCount: 1 })

    expect(summarise(report).repositoryFindings).toBe(0)
  })
})

describe('exitCodeFor', () => {
  it('drops fail the exit code, fallbacks only under --strict', () => {
    const dropped = summarise(buildReport({ entryCount: 1, summary: { dropped: 1 } }))
    const fallenBack = summarise(buildReport({ entryCount: 1, summary: { fallenBack: 1 } }))
    const clean = summarise(buildReport({ entryCount: 1, summary: { deliveredAsDeclared: 1 } }))

    expect(exitCodeFor(dropped)).toBe(1)
    expect(exitCodeFor(dropped, { strict: true })).toBe(1)

    expect(exitCodeFor(fallenBack)).toBe(0)
    expect(exitCodeFor(fallenBack, { strict: true })).toBe(1)

    expect(exitCodeFor(clean)).toBe(0)
    expect(exitCodeFor(clean, { strict: true })).toBe(0)
  })
})
