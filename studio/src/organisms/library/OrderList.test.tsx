// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { OrderList, type OrderListProps } from './OrderList'

afterEach(cleanup)

const ITEMS = [
  { id: 'a', title: 'Entry A', order: 10 },
  { id: 'b', title: 'Entry B', order: 20 },
  { id: 'c', title: 'Entry C', order: undefined },
]

function renderList(props: Partial<OrderListProps> = {}) {
  const onMove = vi.fn()
  render(
    <OrderList
      items={ITEMS}
      busy={false}
      pending={null}
      result={null}
      onMove={onMove}
      onConfirm={() => {}}
      onCancel={() => {}}
      {...props}
    />,
  )
  return onMove
}

test('one row per item with title and order, and a visible note when unusable', () => {
  renderList()
  const rows = within(screen.getByRole('region', { name: 'Order' })).getAllByRole('listitem')
  expect(rows).toHaveLength(3)
  expect(within(rows[0]).getByText('Entry A')).toBeTruthy()
  expect(within(rows[0]).getByText('Order: 10')).toBeTruthy()
  expect(within(rows[2]).getByText('Order: not usable')).toBeTruthy()
})

test('move buttons call move with the right indices and disable at the ends', () => {
  const onMove = renderList()
  const rows = screen.getAllByRole('listitem')
  const up0 = within(rows[0]).getByRole<HTMLButtonElement>('button', { name: /Move up/ })
  const down2 = within(rows[2]).getByRole<HTMLButtonElement>('button', { name: /Move down/ })
  expect(up0.disabled).toBe(true)
  expect(down2.disabled).toBe(true)
  fireEvent.click(within(rows[1]).getByRole('button', { name: /Move up/ }))
  fireEvent.click(within(rows[1]).getByRole('button', { name: /Move down/ }))
  expect(onMove).toHaveBeenNthCalledWith(1, 1, 0)
  expect(onMove).toHaveBeenNthCalledWith(2, 1, 2)
})

test('dropping a handle on a row calls move(from, rowIndex)', () => {
  const onMove = renderList()
  const rows = screen.getAllByRole('listitem')
  const data = new Map<string, string>()
  const dataTransfer = {
    setData: (k: string, v: string) => data.set(k, v),
    getData: (k: string) => data.get(k) ?? '',
  }
  fireEvent.dragStart(screen.getByLabelText('Drag Entry A'), { dataTransfer })
  fireEvent.drop(rows[2], { dataTransfer })
  expect(onMove).toHaveBeenCalledWith(0, 2)
})

test('a renumber lists <id>: <old> to <new> and confirming calls through', () => {
  const onConfirm = vi.fn()
  renderList({
    pending: {
      kind: 'renumber',
      changes: [
        { id: 'b', file: 'b.md', indexPosition: 1, from: 20, to: 30 },
        { id: 'c', file: 'c.md', indexPosition: 2, from: 21, to: 40 },
      ],
    },
    onConfirm,
  })
  const panel = screen.getByRole('alertdialog', { name: 'No gap — renumber entries?' })
  expect(within(panel).getByText('b: 20 → 30')).toBeTruthy()
  expect(within(panel).getByText('c: 21 → 40')).toBeTruthy()
  fireEvent.click(within(panel).getByRole('button', { name: 'Confirm' }))
  expect(onConfirm).toHaveBeenCalled()
})

test('results show as status and errors as alert', () => {
  renderList({
    result: {
      kind: 'changed',
      entries: [
        { id: 'a', file: 'a.md' },
        { id: 'b', file: 'b.md' },
      ],
    },
  })
  expect(screen.getByRole('status').textContent).toBe('Renumbered: a, b')
  cleanup()
  renderList({ result: { kind: 'error', message: 'changed on disk' } })
  expect(screen.getByRole('alert').textContent).toBe('changed on disk')
})
