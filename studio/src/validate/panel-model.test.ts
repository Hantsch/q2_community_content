import { describe, expect, it } from 'vitest'

import type { EntryVerdict } from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'
import { buildPanelModel } from './panel-model'

/** A minimal-but-complete `EntryVerdict`, overridable per test - every field this module reads is
 * given an ordinary "nothing wrong" value so a test only has to spell out what it cares about. */
function buildEntry(overrides?: Partial<EntryVerdict>): EntryVerdict {
  return {
    id: 'entry-1',
    file: 'entry-1.md',
    indexPosition: 0,
    declared: { template: 'text', title: 'Entry One', body: 'body', buttonCount: 0, buttons: [] },
    delivered: { template: 'text', order: 1, position: 0, buttons: [] },
    visibility: { state: 'published' },
    buttons: [],
    findings: [],
    ...overrides,
  }
}

describe('buildPanelModel', () => {
  it('selects an existing entry: declared form, delivered form, visibility, status and its own findings', () => {
    const entry = buildEntry({
      id: 'entry-1',
      file: 'entry-1.md',
      visibility: { state: 'scheduled', visibleFrom: '2026-01-01' },
      findings: [
        {
          severity: 'warning',
          kind: 'template-fallback',
          message: 'fell back to text',
          entryId: 'entry-1',
          file: 'entry-1.md',
          source: 'pipeline',
        },
      ],
    })
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 1,
        fallenBack: 0,
        dropped: 0,
        findingsBySeverity: { error: 0, warning: 1, info: 0 },
      },
    }

    const model = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: 'entry-1' })

    expect(model.entry?.id).toBe('entry-1')
    expect(model.entry?.file).toBe('entry-1.md')
    expect(model.entry?.declared).toEqual(entry.declared)
    expect(model.entry?.delivered).toEqual(entry.delivered)
    expect(model.entry?.visibility).toEqual({ state: 'scheduled', visibleFrom: '2026-01-01' })
    expect(model.entry?.status).toBe('scheduled')
    expect(model.entry?.findings).toEqual([
      {
        severity: 'warning',
        rule: 'template-fallback',
        message: 'fell back to text',
        file: 'entry-1.md',
        field: undefined,
        entryId: 'entry-1',
      },
    ])
  })

  it('a dropped entry gets status "dropped" regardless of its visibility verdict', () => {
    const entry = buildEntry({
      delivered: 'dropped',
      visibility: { state: 'published' },
    })
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 0,
        fallenBack: 0,
        dropped: 1,
        findingsBySeverity: { error: 1, warning: 0, info: 0 },
      },
    }

    const model = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: 'entry-1' })

    expect(model.entry?.status).toBe('dropped')
  })

  it("AC2: a rejected button URL names the button's url field and the reason, for each pipeline kind", () => {
    const kinds: readonly string[] = ['button-host-not-allowed', 'button-invalid', 'button-cap']

    for (const kind of kinds) {
      const entry = buildEntry({
        buttons: [
          {
            declared: { label: 'Go', url: 'https://not-allowed.example' },
            kept: false,
            reason: kind,
          },
        ],
        findings: [
          {
            severity: 'warning',
            kind,
            message: `pipeline reason for ${kind}`,
            entryId: 'entry-1',
            file: 'entry-1.md',
            source: 'pipeline',
          },
        ],
      })
      const report = {
        entries: [entry],
        findings: [],
        summary: {
          deliveredAsDeclared: 1,
          fallenBack: 0,
          dropped: 0,
          findingsBySeverity: { error: 0, warning: 1, info: 0 },
        },
      }

      const model = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: 'entry-1' })

      expect(model.entry?.findings).toHaveLength(1)
      const view = model.entry?.findings[0]
      expect(view?.field).toBe('url')
      expect(view?.rule).toBe(kind)
      expect(view?.message).toBe(`pipeline reason for ${kind}`)
      expect(view?.file).toBe('entry-1.md')
    }
  })

  it('"entry-dropped" and "unclassified" button reasons produce no per-button finding, so no url field is asserted from them', () => {
    // These two `ButtonVerdict.reason` values name a case with no `Finding` of its own (see
    // `button-verdicts.ts`) - the entry-level finding (e.g. the drop reason) is what a view shows,
    // not a per-button one, so this deliberately has zero findings referencing 'url'.
    const entry = buildEntry({
      delivered: 'dropped',
      buttons: [
        {
          declared: { label: 'Go', url: 'https://example.com' },
          kept: false,
          reason: 'entry-dropped',
        },
      ],
      findings: [
        {
          severity: 'error',
          kind: 'entry-dropped',
          message: 'entry dropped',
          entryId: 'entry-1',
          file: 'entry-1.md',
          source: 'pipeline',
        },
      ],
    })
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 0,
        fallenBack: 0,
        dropped: 1,
        findingsBySeverity: { error: 1, warning: 0, info: 0 },
      },
    }

    const model = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: 'entry-1' })

    expect(model.entry?.findings[0]?.field).toBeUndefined()
  })

  it('a missing declared image produces field "image"', () => {
    const entry = buildEntry({
      findings: [
        {
          severity: 'warning',
          kind: 'declared-image-missing',
          message: 'declared image "img/missing.png" not found',
          entryId: 'entry-1',
          file: 'entry-1.md',
          source: 'studio',
        },
      ],
    })
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 1,
        fallenBack: 0,
        dropped: 0,
        findingsBySeverity: { error: 0, warning: 1, info: 0 },
      },
    }

    const model = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: 'entry-1' })

    expect(model.entry?.findings[0]?.field).toBe('image')
  })

  it('AC4: every finding view names a file, falling back to news/index.json', () => {
    const entryFindingNoFile: EntryVerdict['findings'][number] = {
      severity: 'error',
      kind: 'bad-index-shape',
      message: 'index is not shaped as expected',
      source: 'pipeline',
      // no entryId, no file - a report-level finding
    }
    const entry = buildEntry({ findings: [entryFindingNoFile] })
    const repositoryFindingNoFile: RepositoryFinding = {
      kind: 'duplicate-id',
      severity: 'error',
      message: 'duplicate id',
    }
    const repositoryFindingWithFile: RepositoryFinding = {
      kind: 'orphan-image',
      severity: 'info',
      message: 'orphan image',
      file: 'news/img/unused.png',
    }
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 1,
        fallenBack: 0,
        dropped: 0,
        findingsBySeverity: { error: 1, warning: 0, info: 1 },
      },
    }

    const model = buildPanelModel({
      report,
      repositoryFindings: [repositoryFindingNoFile, repositoryFindingWithFile],
      selectedEntryId: 'entry-1',
    })

    expect(model.entry?.findings[0]?.file).toBe('news/index.json')
    expect(model.repositoryFindings[0]?.file).toBe('news/index.json')
    expect(model.repositoryFindings[1]?.file).toBe('news/img/unused.png')
  })

  it("keeps repository findings in a separate list from the entry's own findings", () => {
    const entry = buildEntry({
      findings: [
        {
          severity: 'warning',
          kind: 'template-fallback',
          message: 'entry-level finding',
          entryId: 'entry-1',
          file: 'entry-1.md',
          source: 'pipeline',
        },
      ],
    })
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 1,
        fallenBack: 0,
        dropped: 0,
        findingsBySeverity: { error: 0, warning: 1, info: 0 },
      },
    }
    const repositoryFindings: readonly RepositoryFinding[] = [
      { kind: 'draft', severity: 'info', message: 'draft file', file: 'news/draft.md' },
    ]

    const model = buildPanelModel({ report, repositoryFindings, selectedEntryId: 'entry-1' })

    expect(model.entry?.findings).toHaveLength(1)
    expect(model.entry?.findings[0]?.message).toBe('entry-level finding')
    expect(model.repositoryFindings).toHaveLength(1)
    expect(model.repositoryFindings[0]?.message).toBe('draft file')
  })

  it("allClear is true only when both the entry's own findings and repository findings are empty", () => {
    const cleanEntry = buildEntry({ findings: [] })
    const dirtyEntry = buildEntry({
      findings: [
        {
          severity: 'warning',
          kind: 'template-fallback',
          message: 'fell back',
          entryId: 'entry-1',
          file: 'entry-1.md',
          source: 'pipeline',
        },
      ],
    })
    const repoFinding: RepositoryFinding = { kind: 'draft', severity: 'info', message: 'draft' }

    const bothEmpty = buildPanelModel({
      report: {
        entries: [cleanEntry],
        findings: [],
        summary: {
          deliveredAsDeclared: 1,
          fallenBack: 0,
          dropped: 0,
          findingsBySeverity: { error: 0, warning: 0, info: 0 },
        },
      },
      repositoryFindings: [],
      selectedEntryId: 'entry-1',
    })
    expect(bothEmpty.allClear).toBe(true)

    // Clean entry, but a repository-level finding elsewhere: not all-clear.
    const cleanEntryDirtyRepo = buildPanelModel({
      report: {
        entries: [cleanEntry],
        findings: [],
        summary: {
          deliveredAsDeclared: 1,
          fallenBack: 0,
          dropped: 0,
          findingsBySeverity: { error: 0, warning: 0, info: 1 },
        },
      },
      repositoryFindings: [repoFinding],
      selectedEntryId: 'entry-1',
    })
    expect(cleanEntryDirtyRepo.allClear).toBe(false)

    // Dirty entry, no repository findings: not all-clear either.
    const dirtyEntryCleanRepo = buildPanelModel({
      report: {
        entries: [dirtyEntry],
        findings: [],
        summary: {
          deliveredAsDeclared: 0,
          fallenBack: 1,
          dropped: 0,
          findingsBySeverity: { error: 0, warning: 1, info: 0 },
        },
      },
      repositoryFindings: [],
      selectedEntryId: 'entry-1',
    })
    expect(dirtyEntryCleanRepo.allClear).toBe(false)
  })

  it('a selected id matching no entry yields entry: undefined, same as no selection at all', () => {
    const entry = buildEntry()
    const report = {
      entries: [entry],
      findings: [],
      summary: {
        deliveredAsDeclared: 1,
        fallenBack: 0,
        dropped: 0,
        findingsBySeverity: { error: 0, warning: 0, info: 0 },
      },
    }

    const noMatch = buildPanelModel({
      report,
      repositoryFindings: [],
      selectedEntryId: 'does-not-exist',
    })
    const noSelection = buildPanelModel({ report, repositoryFindings: [], selectedEntryId: null })

    expect(noMatch.entry).toBeUndefined()
    expect(noSelection.entry).toBeUndefined()
    // With nothing selected, an entry's own findings count as empty (vacuously), so allClear
    // still only depends on repository findings.
    expect(noMatch.allClear).toBe(true)
    expect(noSelection.allClear).toBe(true)
  })
})
