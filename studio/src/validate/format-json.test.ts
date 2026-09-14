import { describe, expect, it } from 'vitest'

import type { ContentReport, EntryVerdict } from '../report/report-types'
import type { MirrorProvenance } from '../mirror/provenance'
import { toValidationPayload, VALIDATE_SCHEMA_VERSION } from './format-json'
import { summarise } from './summary'

/** A minimal-but-representative mirror provenance, mirroring `provenance.test.ts`'s fixture style. */
function buildMirror(overrides?: Partial<MirrorProvenance>): MirrorProvenance {
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

/** One delivered entry and one dropped entry, each with a finding attached, so the payload has
 * declared/delivered/findings visible on more than one shape of `EntryVerdict`. */
function buildEntries(): EntryVerdict[] {
  return [
    {
      id: 'entry-a',
      file: 'news/entry-a.md',
      indexPosition: 0,
      declared: { body: 'Hello', buttonCount: 0, buttons: [] },
      delivered: { template: 'text', order: 0, position: 0, buttons: [] },
      visibility: { state: 'published' },
      buttons: [],
      findings: [],
    },
    {
      id: 'entry-b',
      file: 'news/entry-b.md',
      indexPosition: 1,
      declared: { body: 'Dropped', buttonCount: 0, buttons: [] },
      delivered: 'dropped',
      visibility: { state: 'not-applicable' },
      buttons: [],
      findings: [
        {
          severity: 'error',
          kind: 'duplicate-id',
          message: 'Duplicate id',
          entryId: 'entry-b',
          source: 'pipeline',
        },
      ],
    },
  ]
}

function buildReport(entries: EntryVerdict[]): ContentReport & { repositoryFindings?: readonly unknown[] } {
  return {
    entries,
    findings: [],
    summary: {
      deliveredAsDeclared: 1,
      fallenBack: 0,
      dropped: 1,
      findingsBySeverity: { error: 1, warning: 0, info: 0 },
    },
  }
}

describe('toValidationPayload', () => {
  it('round-trips through JSON.parse(JSON.stringify(...)) unchanged', () => {
    const mirror = buildMirror()
    const entries = buildEntries()
    const report = buildReport(entries)
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('carries the schema version', () => {
    const mirror = buildMirror()
    const report = buildReport([])
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    expect(payload.schemaVersion).toBe(VALIDATE_SCHEMA_VERSION)
    expect(typeof payload.schemaVersion).toBe('number')
  })

  it('carries the mirror provenance verbatim', () => {
    const mirror = buildMirror({ verdict: 'out-of-sync', mismatchedFiles: ['some/file.ts'] })
    const report = buildReport([])
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    expect(payload.mirror).toEqual(mirror)
  })

  it('carries one object per entry with declared, delivered and findings visible', () => {
    const mirror = buildMirror()
    const entries = buildEntries()
    const report = buildReport(entries)
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    expect(payload.entries).toHaveLength(2)
    expect(payload.entries[0].declared.body).toBe('Hello')
    expect(payload.entries[0].delivered).toEqual({
      template: 'text',
      order: 0,
      position: 0,
      buttons: [],
    })
    expect(payload.entries[1].delivered).toBe('dropped')
    expect(payload.entries[1].findings).toEqual([
      {
        severity: 'error',
        kind: 'duplicate-id',
        message: 'Duplicate id',
        entryId: 'entry-b',
        source: 'pipeline',
      },
    ])
  })

  it('carries repositoryFindings as an empty array today, since story 013 has not landed', () => {
    const mirror = buildMirror()
    const report = buildReport([])
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    expect(payload.repositoryFindings).toEqual([])
  })

  it('the payload carries the same facts as the text output, via the shared ValidationSummary', () => {
    const mirror = buildMirror()
    const entries = buildEntries()
    const report = buildReport(entries)
    const summary = summarise(report)

    const payload = toValidationPayload({ mirror, report, summary })

    // Both format-text.ts and format-json.ts read their counts from the same `ValidationSummary` -
    // asserting equality here is asserting the JSON and text outputs cannot disagree about the
    // AC7 counts, since there is only one place those counts are computed.
    expect(payload.summary).toEqual(summary)
    expect(payload.summary).toEqual({
      deliveredAsDeclared: 1,
      fallingBack: 0,
      dropped: 1,
      repositoryFindings: 0,
      total: 2,
    })
  })
})
