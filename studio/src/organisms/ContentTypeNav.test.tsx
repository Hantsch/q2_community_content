// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import type { ContentTypeDescriptor } from '../content-types/descriptor'
import { createContentTypeRegistry } from '../content-types/registry'
import { ContentTypeNav } from './ContentTypeNav'

afterEach(cleanup)

test('the navigation lists every registered content type', () => {
  const descriptors = createContentTypeRegistry({})

  render(
    <ContentTypeNav descriptors={descriptors} selectedId={descriptors[0].id} onSelect={() => {}} />,
  )

  const items = screen.getAllByRole('listitem').map((item) => item.textContent)
  expect(items).toEqual(descriptors.map((descriptor) => descriptor.label))
})

test('a throwaway descriptor appears in the navigation without a shell change', () => {
  const throwaway: ContentTypeDescriptor = {
    id: 'throwaway' as ContentTypeDescriptor['id'],
    label: 'Throwaway type',
    state: 'reserved',
    directory: 'throwaway',
  }
  const descriptors = [...createContentTypeRegistry({}), throwaway]

  render(
    <ContentTypeNav descriptors={descriptors} selectedId={descriptors[0].id} onSelect={() => {}} />,
  )

  expect(screen.getByText('Throwaway type')).toBeDefined()
})

test('selecting an entry marks it current', () => {
  const descriptors = createContentTypeRegistry({})
  const onSelect = vi.fn()
  const { rerender } = render(
    <ContentTypeNav descriptors={descriptors} selectedId={descriptors[0].id} onSelect={onSelect} />,
  )

  const secondButton = screen.getByRole('button', { name: descriptors[1].label })
  fireEvent.click(secondButton)

  expect(onSelect).toHaveBeenCalledWith(descriptors[1].id)

  rerender(
    <ContentTypeNav descriptors={descriptors} selectedId={descriptors[1].id} onSelect={onSelect} />,
  )

  expect(
    screen.getByRole('button', { name: descriptors[1].label }).getAttribute('aria-current'),
  ).toBe('page')
  expect(
    screen.getByRole('button', { name: descriptors[0].label }).getAttribute('aria-current'),
  ).toBeNull()
})
