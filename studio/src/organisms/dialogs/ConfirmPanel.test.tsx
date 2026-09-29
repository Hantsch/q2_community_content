// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ConfirmPanel } from './ConfirmPanel'

afterEach(cleanup)

test('it is an alertdialog named by its title with Confirm and Cancel', () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmPanel title="Sure?" onConfirm={onConfirm} onCancel={onCancel}>
      <p>Body text</p>
    </ConfirmPanel>,
  )
  expect(screen.getByRole('alertdialog', { name: 'Sure?' })).toBeTruthy()
  expect(screen.getByText('Body text')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(onConfirm).toHaveBeenCalledTimes(1)
  expect(onCancel).toHaveBeenCalledTimes(1)
})

test('the confirm label can be overridden', () => {
  render(
    <ConfirmPanel
      title="T"
      confirmLabel="Publish anyway"
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  )
  expect(screen.getByRole('button', { name: 'Publish anyway' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull()
})
