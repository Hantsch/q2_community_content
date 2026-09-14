// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { LibraryStatus } from '../../library/library-types'
import { EntryStatusBadge } from './EntryStatusBadge'

afterEach(cleanup)

const STATUSES: readonly LibraryStatus[] = ['published', 'scheduled', 'expired', 'dropped', 'draft']

describe.each(STATUSES)('EntryStatusBadge status=%s', (status) => {
  test('renders its own status word as visible text', () => {
    render(<EntryStatusBadge status={status} />)

    const label = screen.getByText(new RegExp(status, 'i'))
    expect(label).toBeDefined()
    // The word itself is the signal, independent of whatever class carries the colour - this is
    // the same node the styling classes live on, but the assertion above never looks at them.
    expect(label.textContent?.toLowerCase()).toContain(status)
  })
})

test('renders a distinct label per status, so no two statuses collapse onto the same text', () => {
  const labels = STATUSES.map((status) => {
    const { unmount } = render(<EntryStatusBadge status={status} />)
    const text = screen.getByText(new RegExp(status, 'i')).textContent
    unmount()
    return text
  })

  expect(new Set(labels).size).toBe(STATUSES.length)
})
