// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import {
  VisibilityOverrideMarker,
  VisibilityOverrideSwitch,
  overrideMarkerText,
} from './VisibilityOverrideControl'

afterEach(cleanup)

test('the switch has an accessible name and reports its state', () => {
  const onChange = vi.fn()
  const { rerender } = render(<VisibilityOverrideSwitch checked={false} onChange={onChange} />)

  const toggle = screen.getByRole<HTMLInputElement>('switch', { name: 'Preview as if visible' })
  expect(toggle.checked).toBe(false)

  fireEvent.click(toggle)
  expect(onChange).toHaveBeenCalledWith(true)

  rerender(<VisibilityOverrideSwitch checked onChange={onChange} />)
  expect(
    screen.getByRole<HTMLInputElement>('switch', { name: 'Preview as if visible' }).checked,
  ).toBe(true)
})

test('the override marker names the real state in text', () => {
  const realState = 'Scheduled — visible from 2099-01-01T00:00:00Z.'
  render(<VisibilityOverrideMarker realState={realState} />)

  const marker = screen.getByRole('status')
  expect(marker.textContent).toBe(overrideMarkerText(realState))
  expect(marker.textContent).toContain('Override — previewing as if visible.')
  expect(marker.textContent).toContain(`Real state: ${realState}`)
})
