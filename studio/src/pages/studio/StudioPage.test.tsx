// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
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

// Story 016 D5: `news` is `descriptors[0]`, the default tab, so the studio starts on `news` and
// immediately drives `useNewsLibrary()` off the default (unbound) registry's `news` descriptor —
// no reader has been stubbed, so the bridge client's own `read()` runs for real against whatever
// dev-server route this test's jsdom environment has (none), settling on the `unreadable` state
// `LibraryStateNotice` renders. This proves the shell wires `news` to `LibraryView` in place of
// the deleted `NewsBridgeSummary`, without needing a fixture reader.
test('selecting news renders the library in place of the old bridge summary', async () => {
  render(<StudioPage />)

  expect(screen.getByLabelText('Library content').textContent).toMatch(/Reading news\/…/)

  await waitFor(() => {
    expect(screen.getByLabelText('Library content').textContent).toMatch(
      /news\/ could not be read\./,
    )
  })

  expect(screen.queryByText(/^Index: news\/index\.json$/)).toBeNull()
})
