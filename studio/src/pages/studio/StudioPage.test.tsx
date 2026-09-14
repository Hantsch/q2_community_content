// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { createContentTypeRegistry } from '../../content-types/registry'
import { StudioPage } from './StudioPage'

afterEach(cleanup)

test('renders the studio heading and its intro line', () => {
  render(<StudioPage />)

  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Q2 Content Studio')
  expect(
    screen.getByText('Author and validate community content for the Q2 Launcher.'),
  ).toBeDefined()
})

test('renders every registered content type in the navigation', () => {
  render(<StudioPage />)

  const registeredLabels = createContentTypeRegistry().map((descriptor) => descriptor.label)
  for (const label of registeredLabels) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  }
})
