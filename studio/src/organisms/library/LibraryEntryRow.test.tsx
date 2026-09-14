// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { LibraryRow } from '../../library/library-types'
import { LibraryEntryRow } from './LibraryEntryRow'

afterEach(cleanup)

const BASE_ROW: LibraryRow = {
  id: 'entry-1',
  file: 'news/entry-1.md',
  title: 'A published entry',
  declaredTemplate: 'text',
  deliveredTemplate: 'text',
  templatesDiffer: false,
  order: 3,
  status: 'published',
}

test('a normal row renders title, template, order and status badge', () => {
  render(<LibraryEntryRow row={BASE_ROW} selected={false} onSelect={() => {}} />)

  expect(screen.getByText('A published entry')).toBeDefined()
  expect(screen.getByText('text')).toBeDefined()
  expect(screen.getByText('Order: 3')).toBeDefined()
  expect(screen.getByText('Published')).toBeDefined()
})

test('a row with no title falls back to the file name, not the full path', () => {
  const row: LibraryRow = { ...BASE_ROW, title: undefined, file: 'news/nested/no-title.md' }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.getByText('no-title.md')).toBeDefined()
})

test('templatesDiffer false shows only the declared template', () => {
  const row: LibraryRow = {
    ...BASE_ROW,
    declaredTemplate: 'text',
    deliveredTemplate: 'text',
    templatesDiffer: false,
  }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.queryByText(/declared:/)).toBeNull()
  expect(screen.queryByText(/delivered:/)).toBeNull()
  expect(screen.getByText('text')).toBeDefined()
})

test('templatesDiffer true shows both the declared and delivered template, labelled', () => {
  const row: LibraryRow = {
    ...BASE_ROW,
    declaredTemplate: 'text',
    deliveredTemplate: 'gallery',
    templatesDiffer: true,
  }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.getByText(/declared:\s*text/)).toBeDefined()
  expect(screen.getByText(/delivered:\s*gallery/)).toBeDefined()
})

test('a scheduled row shows its visible-from date', () => {
  const row: LibraryRow = {
    ...BASE_ROW,
    status: 'scheduled',
    visibilityDate: '2026-10-01',
    order: undefined,
  }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.getByText(/Visible from:\s*2026-10-01/)).toBeDefined()
})

test('an expired row shows its visible-until date', () => {
  const row: LibraryRow = {
    ...BASE_ROW,
    status: 'expired',
    visibilityDate: '2026-08-01',
  }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.getByText(/Visible until:\s*2026-08-01/)).toBeDefined()
})

test('a dropped row shows its reason inline, without leaving the row', () => {
  const row: LibraryRow = {
    ...BASE_ROW,
    status: 'dropped',
    order: undefined,
    deliveredTemplate: undefined,
    dropReason: 'Missing required field: title',
  }

  render(<LibraryEntryRow row={row} selected={false} onSelect={() => {}} />)

  expect(screen.getByText(/Reason:\s*Missing required field: title/)).toBeDefined()
})

test('a missing thumbnail renders a labelled placeholder, not a broken image', () => {
  const { container } = render(
    <LibraryEntryRow row={BASE_ROW} selected={false} onSelect={() => {}} />,
  )

  expect(screen.getByLabelText('No thumbnail')).toBeDefined()
  expect(container.querySelector('img')).toBeNull()
})

test('a resolved thumbnail URL renders as an image', () => {
  render(
    <LibraryEntryRow
      row={BASE_ROW}
      selected={false}
      onSelect={() => {}}
      thumbnailUrl="bridge://news/img/a.png"
    />,
  )

  const image = screen.getByRole('img')
  expect(image.getAttribute('src')).toBe('bridge://news/img/a.png')
})

test('clicking the row calls onSelect with the row id', () => {
  const onSelect = vi.fn()
  render(<LibraryEntryRow row={BASE_ROW} selected={false} onSelect={onSelect} />)

  fireEvent.click(screen.getByRole('button'))

  expect(onSelect).toHaveBeenCalledWith('entry-1')
})

test('the selected row renders a distinguishable, non-colour-only state', () => {
  render(<LibraryEntryRow row={BASE_ROW} selected onSelect={() => {}} />)

  const row = screen.getByRole('button')
  expect(row.getAttribute('aria-current')).toBe('true')
})

test('an unselected row carries no aria-current', () => {
  render(<LibraryEntryRow row={BASE_ROW} selected={false} onSelect={() => {}} />)

  expect(screen.getByRole('button').getAttribute('aria-current')).toBeNull()
})
