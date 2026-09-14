/**
 * Story 012 D2: proves the text formatter lays out every fact AC1/AC7 require, using only the
 * wording story 009's `formatProvenance` and story 012's `summarise` already produce - never a
 * hand-typed duplicate of either.
 */
import { describe, expect, it } from 'vitest'

import { formatProvenance } from '../mirror/provenance'
import type { MirrorProvenance } from '../mirror/provenance'
import type { ContentReport, EntryVerdict } from '../report/report-types'
import { formatValidationText } from './format-text'
import { summarise } from './summary'

function buildProvenance(overrides?: Partial<MirrorProvenance>): MirrorProvenance {
  return {
    verdict: 'in-sync',
    launcherCommit: 'a41b3acab4bd3a089f8a04594fff81556fbd6f8a',
    launcherCommitShort: 'a41b3acab4bd',
    syncedAt: '2020-01-01T00:00:00.000Z',
    ageInDays: 42,
    fileCount: 3,
    mismatchedFiles: [],
    ...overrides,
  }
}

function buildEntry(overrides?: Partial<EntryVerdict>): EntryVerdict {
  return {
    id: 'clean',
    file: 'clean.md',
    indexPosition: 0,
    declared: { template: 'text', body: 'Body', buttonCount: 0, buttons: [] },
    delivered: { template: 'text', order: 0, buttons: [] },
    visibility: { state: 'published' },
    buttons: [],
    findings: [],
    ...overrides,
  }
}

function buildReport(entries: EntryVerdict[]): ContentReport {
  const deliveredAsDeclared = entries.filter(
    (e) => e.delivered !== 'dropped' && e.delivered.template === e.declared.template,
  ).length
  const dropped = entries.filter((e) => e.delivered === 'dropped').length
  const fallenBack = entries.length - deliveredAsDeclared - dropped

  return {
    entries,
    findings: [],
    summary: {
      deliveredAsDeclared,
      fallenBack,
      dropped,
      findingsBySeverity: { error: 0, warning: 0, info: 0 },
    },
  }
}

describe('formatValidationText', () => {
  it('prints every entry with its declared and delivered form plus each finding (AC1)', () => {
    const fallbackEntry = buildEntry({
      id: 'fallback',
      file: 'fallback.md',
      declared: { template: 'split', body: 'Body', buttonCount: 0, buttons: [] },
      delivered: { template: 'text', order: 1, buttons: [] },
      findings: [
        { severity: 'warning', kind: 'template-fallback', message: 'template-fallback: no image', source: 'pipeline' },
        { severity: 'info', kind: 'scheduled', message: 'scheduled until later', source: 'pipeline' },
      ],
    })
    const droppedEntry = buildEntry({
      id: 'dropped',
      file: 'dropped.md',
      declared: { body: '', buttonCount: 0, buttons: [] },
      delivered: 'dropped',
      findings: [
        { severity: 'error', kind: 'template-unresolvable', message: 'dropped: no usable title or body', source: 'pipeline' },
      ],
    })
    const cleanEntry = buildEntry()

    const report = buildReport([cleanEntry, fallbackEntry, droppedEntry])
    const mirror = buildProvenance()
    const lines = formatValidationText({ mirror, report, summary: summarise(report) })
    const text = lines.join('\n')

    // clean: declared and delivered both named
    expect(text).toContain('clean (clean.md): declared text -> delivered text')

    // fallback: declared template differs from delivered, and both appear, plus its findings
    expect(text).toContain('fallback (fallback.md): declared split -> delivered text')
    expect(text).toContain('[warning] template-fallback: no image')
    expect(text).toContain('[info] scheduled until later')

    // dropped: declared has no template, delivered is "dropped", plus its finding
    expect(text).toContain('dropped (dropped.md): declared none declared -> delivered dropped')
    expect(text).toContain('[error] dropped: no usable title or body')
  })

  it("names the launcher commit and mirror verdict using 009's own formatProvenance wording", () => {
    const mirror = buildProvenance({ verdict: 'out-of-sync', mismatchedFiles: ['studio/src/launcher-core/a.ts'] })
    const report = buildReport([buildEntry()])

    const lines = formatValidationText({ mirror, report, summary: summarise(report) })
    const expectedHeader = formatProvenance(mirror)

    expect(lines.slice(0, expectedHeader.length)).toEqual(expectedHeader)
  })

  it('states all four AC7 counts in the summary line', () => {
    const fallbackEntry = buildEntry({
      id: 'fallback',
      file: 'fallback.md',
      declared: { template: 'split', body: 'Body', buttonCount: 0, buttons: [] },
      delivered: { template: 'text', order: 1, buttons: [] },
    })
    const droppedEntry = buildEntry({ id: 'dropped', file: 'dropped.md', delivered: 'dropped' })
    const cleanEntry = buildEntry()

    const report = buildReport([cleanEntry, fallbackEntry, droppedEntry])
    const summary = summarise(report)
    const lines = formatValidationText({ mirror: buildProvenance(), report, summary })

    expect(lines).toContain('1 delivered as declared, 1 falling back, 1 dropped, 0 repository finding(s)')
  })
})
