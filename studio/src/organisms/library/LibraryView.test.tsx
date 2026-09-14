// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { LibraryModel, LibraryRow } from '../../library/library-types'
import { LibraryView } from './LibraryView'

afterEach(cleanup)

function row(id: string, title: string, extra: Partial<LibraryRow> = {}): LibraryRow {
  return {
    id,
    file: `news/${id}.md`,
    title,
    declaredTemplate: 'text',
    templatesDiffer: false,
    status: 'published',
    ...extra,
  }
}

function readyModel(
  entries: readonly LibraryRow[],
  drafts: readonly LibraryRow[] = [],
): LibraryModel {
  return { state: 'ready', entries, drafts, unreadableFindings: [], repositoryFindings: [] }
}

test('entries render in the given order, without re-sorting', () => {
  const entries = [row('c', 'Third'), row('a', 'First'), row('b', 'Second')]

  render(
    <LibraryView
      model={readyModel(entries)}
      loading={false}
      selectedId={null}
      onSelect={() => {}}
    />,
  )

  const section = screen.getByLabelText('Entries')
  const titles = within(section)
    .getAllByRole('button')
    .map((button) => button.textContent)

  expect(titles[0]).toContain('Third')
  expect(titles[1]).toContain('First')
  expect(titles[2]).toContain('Second')
})

test('drafts render in their own section, labelled as invisible to the launcher', () => {
  const entries = [row('a', 'Published entry')]
  const drafts = [row('drafts/b.md', 'A draft', { status: 'draft', declaredTemplate: undefined })]

  render(
    <LibraryView
      model={readyModel(entries, drafts)}
      loading={false}
      selectedId={null}
      onSelect={() => {}}
    />,
  )

  expect(screen.getByText(/Drafts.*not visible to the launcher/i)).toBeDefined()

  const draftsSection = screen.getByLabelText('Drafts')
  expect(within(draftsSection).getByText('A draft')).toBeDefined()

  const entriesSection = screen.getByLabelText('Entries')
  expect(within(entriesSection).queryByText('A draft')).toBeNull()
})

test('loading renders its own distinct notice, not the lists', () => {
  render(<LibraryView model={null} loading onSelect={() => {}} selectedId={null} />)

  expect(screen.getByText(/Reading news/)).toBeDefined()
  expect(screen.queryByLabelText('Entries')).toBeNull()
})

test('an empty model renders a notice distinct from loading and unreadable', () => {
  const model: LibraryModel = {
    state: 'empty',
    entries: [],
    drafts: [],
    unreadableFindings: [],
    repositoryFindings: [],
  }

  render(<LibraryView model={model} loading={false} selectedId={null} onSelect={() => {}} />)

  expect(screen.getByText(/has no entries or drafts/)).toBeDefined()
  expect(screen.queryByText(/Reading news/)).toBeNull()
  expect(screen.queryByText(/could not be read/)).toBeNull()
})

test('an unreadable model renders a notice distinct from loading and empty', () => {
  const model: LibraryModel = {
    state: 'unreadable',
    entries: [],
    drafts: [],
    unreadableFindings: [
      {
        code: 'index-unparseable',
        severity: 'error',
        message: 'news/index.json is not valid JSON.',
      },
    ],
    repositoryFindings: [],
  }

  render(<LibraryView model={model} loading={false} selectedId={null} onSelect={() => {}} />)

  expect(screen.getByText(/could not be read/)).toBeDefined()
  expect(screen.getByText('news/index.json is not valid JSON.')).toBeDefined()
  expect(screen.queryByText(/Reading news/)).toBeNull()
  expect(screen.queryByText(/has no entries or drafts/)).toBeNull()
})

test('the selected row carries the selection state and others do not', () => {
  const entries = [row('a', 'First'), row('b', 'Second')]

  render(
    <LibraryView model={readyModel(entries)} loading={false} selectedId="b" onSelect={() => {}} />,
  )

  const buttons = screen.getAllByRole('button')
  const first = buttons.find((button) => button.textContent?.includes('First'))
  const second = buttons.find((button) => button.textContent?.includes('Second'))

  expect(first?.getAttribute('aria-current')).toBeNull()
  expect(second?.getAttribute('aria-current')).toBe('true')
})
