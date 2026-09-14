// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ValidationPanel } from './ValidationPanel'
import type { LibraryRow } from '../library/library-types'
import type { MirrorProvenance } from '../mirror/provenance'
import type { FindingView, PanelEntryView, ValidationPanelModel } from '../validate/panel-model'

afterEach(cleanup)

function entryFinding(overrides: Partial<FindingView> = {}): FindingView {
  return {
    severity: 'error',
    rule: 'declared-image-missing',
    message: 'The declared image file does not exist.',
    file: 'news/hello.md',
    entryId: 'hello',
    ...overrides,
  }
}

function repoFinding(overrides: Partial<FindingView> = {}): FindingView {
  return {
    severity: 'warning',
    rule: 'duplicate-id',
    message: 'Two entries declare the same id.',
    file: 'news/index.json',
    entryId: 'duplicate-id:hello',
    ...overrides,
  }
}

function panelEntry(overrides: Partial<PanelEntryView> = {}): PanelEntryView {
  return {
    id: 'hello',
    file: 'news/hello.md',
    declared: { title: 'Hello world', body: 'body', buttonCount: 0, buttons: [] },
    delivered: { template: 'text', order: 1, position: 0, buttons: [] },
    visibility: { state: 'published' },
    status: 'published',
    findings: [],
    ...overrides,
  }
}

function draftRow(overrides: Partial<LibraryRow> = {}): LibraryRow {
  return {
    id: 'news/draft.md',
    file: 'news/draft.md',
    title: 'A Draft',
    status: 'draft',
    templatesDiffer: false,
    ...overrides,
  }
}

test('entry findings and repository findings never mix', () => {
  const model: ValidationPanelModel = {
    entry: panelEntry({
      findings: [entryFinding({ message: 'Entry-only finding.', entryId: 'hello' })],
    }),
    repositoryFindings: [repoFinding({ message: 'Repository-only finding.' })],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} />)

  const entrySection = screen.getByRole('region', { name: 'Entry findings' })
  const repoSection = screen.getByRole('region', { name: 'Repository findings' })

  expect(within(entrySection).getByText('Entry-only finding.')).toBeDefined()
  expect(within(entrySection).queryByText('Repository-only finding.')).toBeNull()

  expect(within(repoSection).getByText('Repository-only finding.')).toBeDefined()
  expect(within(repoSection).queryByText('Entry-only finding.')).toBeNull()
})

test('a snapshot without findings shows the all-clear state', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: true,
  }

  render(<ValidationPanel panelModel={model} />)

  expect(screen.getByText(/all clear/i)).toBeDefined()
})

test('a draft entry with no findings reads as fine, but invisible to the launcher', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} selectedRow={draftRow()} />)

  expect(screen.getByText(/is a draft/i)).toBeDefined()
  expect(screen.getByText(/invisible to the launcher/i)).toBeDefined()
  expect(screen.queryByText(/nothing selected/i)).toBeNull()
})

test('nothing selected renders a notice distinct from the draft and all-clear states', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} />)

  expect(screen.getByText(/nothing selected/i)).toBeDefined()
  expect(screen.queryByText(/is a draft/i)).toBeNull()
  expect(screen.queryByText(/all clear/i)).toBeNull()
})

test('the repository findings region always renders, even when empty', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} />)

  const repoSection = screen.getByRole('region', { name: 'Repository findings' })
  expect(repoSection).toBeDefined()
})

test('a finding with an entryId calls onSelectEntry when its control is activated', () => {
  const onSelectEntry = vi.fn()
  const model: ValidationPanelModel = {
    entry: panelEntry({ findings: [entryFinding({ entryId: 'hello' })] }),
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} onSelectEntry={onSelectEntry} />)

  fireEvent.click(screen.getByRole('button', { name: /declared image/i }))

  expect(onSelectEntry).toHaveBeenCalledWith('hello')
})

function provenance(overrides: Partial<MirrorProvenance> = {}): MirrorProvenance {
  return {
    verdict: 'out-of-sync',
    launcherCommit: 'abcdef0123456789',
    launcherCommitShort: 'abcdef012345',
    syncedAt: '2026-01-01T00:00:00.000Z',
    ageInDays: 7,
    fileCount: 12,
    mismatchedFiles: ['launcher-core/contract/foo.ts'],
    ...overrides,
  }
}

test('a provenance prop shows the verdict, commit, sync age and out-of-sync file count', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} provenance={provenance()} />)

  const provenanceSection = screen.getByRole('region', { name: 'Mirror provenance' })
  expect(within(provenanceSection).getByText(/status: out of sync/i)).toBeDefined()
  expect(within(provenanceSection).getByText(/abcdef012345/)).toBeDefined()
  expect(within(provenanceSection).getByText(/7d ago/)).toBeDefined()
  expect(within(provenanceSection).getByText(/out of sync: 1/i)).toBeDefined()
})

test('no provenance prop renders no provenance region', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} />)

  expect(screen.queryByRole('region', { name: 'Mirror provenance' })).toBeNull()
})

test('a finding without an entryId renders as plain, non-interactive content', () => {
  const model: ValidationPanelModel = {
    entry: undefined,
    repositoryFindings: [repoFinding({ entryId: undefined, message: 'No entry attribution.' })],
    allClear: false,
  }

  render(<ValidationPanel panelModel={model} onSelectEntry={vi.fn()} />)

  const repoSection = screen.getByRole('region', { name: 'Repository findings' })
  expect(within(repoSection).queryByRole('button')).toBeNull()
  expect(within(repoSection).getByText('No entry attribution.')).toBeDefined()
})
