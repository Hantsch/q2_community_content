// @vitest-environment jsdom
/**
 * Story 016 D4: proves the seam story 017 needs — a default of `null`, a `selectEntry` call that
 * a second, independent consumer sees, and the outside-provider guard.
 */
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CurrentEntryProvider, useCurrentEntry } from './current-entry-context'

afterEach(cleanup)

/** A consumer independent of the one that calls `selectEntry`, proving the context — not prop
 * drilling — is what carries the update (Decisions (Sprint): "would otherwise reach into a page"). */
function CurrentEntryReadout(): React.JSX.Element {
  const { currentEntryId } = useCurrentEntry()
  return <p>current: {currentEntryId ?? 'none'}</p>
}

function SelectButton({ id }: { id: string }): React.JSX.Element {
  const { selectEntry } = useCurrentEntry()
  return (
    <button type="button" onClick={() => selectEntry(id)}>
      select {id}
    </button>
  )
}

describe('CurrentEntryProvider / useCurrentEntry', () => {
  it('defaults currentEntryId to null', () => {
    const { result } = renderHook(() => useCurrentEntry(), { wrapper: CurrentEntryProvider })
    expect(result.current.currentEntryId).toBeNull()
  })

  it('lets one consumer select an entry and a second, independent consumer see the update', () => {
    render(
      <CurrentEntryProvider>
        <SelectButton id="welcome" />
        <CurrentEntryReadout />
      </CurrentEntryProvider>,
    )

    expect(screen.getByText('current: none')).toBeDefined()

    act(() => {
      screen.getByRole('button', { name: 'select welcome' }).click()
    })

    expect(screen.getByText('current: welcome')).toBeDefined()
  })

  it('throws when useCurrentEntry is called outside a provider', () => {
    // React logs the thrown error to the console during render; silence it so the test output
    // stays readable, then restore it.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<CurrentEntryReadout />)).toThrow(
      'useCurrentEntry must be used within a CurrentEntryProvider',
    )

    consoleError.mockRestore()
  })
})
