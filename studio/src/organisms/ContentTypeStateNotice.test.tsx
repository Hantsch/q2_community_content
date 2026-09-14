// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { ContentTypeDescriptor } from '../content-types/descriptor'
import { ContentTypeStateNotice } from './ContentTypeStateNotice'

afterEach(cleanup)

test('a reserved content type shows the reserved notice and its concept path as plain text', () => {
  const descriptor: ContentTypeDescriptor = {
    id: 'packs',
    label: 'Packs',
    state: 'reserved',
    directory: 'packs',
    conceptPath: 'docs/concepts/packs-content.md',
  }

  const { container } = render(<ContentTypeStateNotice descriptor={descriptor} />)

  expect(screen.getByText(/reserved — the launcher does not read this yet/)).toBeDefined()
  expect(screen.getByText('docs/concepts/packs-content.md')).toBeDefined()
  expect(container.querySelector('a')).toBeNull()
})

test('a launcher-reads content type explains it is not editable here yet', () => {
  const descriptor: ContentTypeDescriptor = {
    id: 'engines',
    label: 'Engines',
    state: 'launcher-reads',
    directory: 'engines',
    indexFile: 'manifest.json',
  }

  render(<ContentTypeStateNotice descriptor={descriptor} />)

  expect(screen.getByText(/read by the launcher, not editable here yet/)).toBeDefined()
  expect(
    screen.getByText('Editing support for this content type has not been built yet.'),
  ).toBeDefined()
})

test('an implemented content type shows a labelled, non-empty mount region', () => {
  const descriptor: ContentTypeDescriptor = {
    id: 'news',
    label: 'News',
    state: 'implemented',
    directory: 'news',
    indexFile: 'index.json',
  }

  render(<ContentTypeStateNotice descriptor={descriptor} />)

  const region = screen.getByLabelText('News content')
  expect(region.textContent?.trim().length).toBeGreaterThan(0)
})
