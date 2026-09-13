// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { StudioPage } from './StudioPage'

afterEach(cleanup)

test('renders the studio heading and its intro line', () => {
  render(<StudioPage />)

  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Q2 Content Studio')
  expect(
    screen.getByText('Author and validate community content for the Q2 Launcher.'),
  ).toBeDefined()
})
