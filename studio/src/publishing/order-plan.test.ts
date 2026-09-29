import { describe, expect, it } from 'vitest'

import type { EntryDescription } from '../report/__fixtures__/news-tree'
import { buildOrderSequence, planMove, type OrderItem } from './order-plan'
import { makeRead } from './test-support'

const entry = (id: string, order?: string): EntryDescription => ({
  id,
  template: 'text',
  title: id,
  body: 'Body',
  ...(order === undefined ? {} : { order }),
})

function seq(...orders: (number | undefined)[]): OrderItem[] {
  return orders.map((order, i) => ({
    id: `e${i}`,
    file: `e${i}.md`,
    indexPosition: i,
    order,
  }))
}

describe('buildOrderSequence', () => {
  it('lists resolved rows in delivered order, scheduled and expired included, dropped excluded', () => {
    const read = makeRead([
      entry('c', '30'),
      { ...entry('a', '10'), visibleFrom: '2999-01-01T00:00:00Z' },
      { ...entry('b', '20'), visibleUntil: '2000-01-01T00:00:00Z' },
      { id: 'broken', rawDocument: 'no frontmatter' },
      entry('none'),
    ])
    expect(buildOrderSequence(read)).toEqual([
      { id: 'a', file: 'a.md', indexPosition: 1, order: 10 },
      { id: 'b', file: 'b.md', indexPosition: 2, order: 20 },
      { id: 'c', file: 'c.md', indexPosition: 0, order: 30 },
      { id: 'none', file: 'none.md', indexPosition: 4, order: undefined },
    ])
  })
})

describe('planMove', () => {
  it('a move into a gap changes only the moved entry', () => {
    const plan = planMove(seq(10, 20, 40), 0, 1) // e0 lands between 20 and 40
    expect(plan).toEqual({
      kind: 'gap',
      changes: [{ id: 'e0', file: 'e0.md', indexPosition: 0, from: 10, to: 30 }],
    })
  })

  it('without a gap the plan renumbers and lists only the entries whose value changes', () => {
    // e2 (21) moves between 20 and 21's neighbours: prev 10, next 11 has no integer between.
    const plan = planMove(seq(10, 11, 40), 2, 1)
    expect(plan.kind).toBe('renumber')
    if (plan.kind !== 'renumber') return
    // New order e0, e2, e1 -> 10, 20, 30. e0 keeps 10 and is not listed.
    expect(plan.changes).toEqual([
      { id: 'e2', file: 'e2.md', indexPosition: 2, from: 40, to: 20 },
      { id: 'e1', file: 'e1.md', indexPosition: 1, from: 11, to: 30 },
    ])
  })

  it('moving to the top uses 0 as the lower neighbour', () => {
    expect(planMove(seq(10, 20, 30), 2, 0)).toMatchObject({
      kind: 'gap',
      changes: [{ id: 'e2', from: 30, to: 5 }],
    })
  })

  it('moving to the top has no gap when the first entry sits at 1', () => {
    expect(planMove(seq(1, 20, 30), 2, 0).kind).toBe('renumber')
  })

  it('moving to the end takes the next multiple of ten above the last value', () => {
    expect(planMove(seq(10, 20, 30), 0, 2)).toMatchObject({
      kind: 'gap',
      changes: [{ id: 'e0', from: 10, to: 40 }],
    })
  })

  it('tied neighbours (20/20) leave no gap', () => {
    expect(planMove(seq(10, 20, 20, 50), 3, 2).kind).toBe('renumber')
  })

  it('a neighbour without a usable order leaves no gap', () => {
    expect(planMove(seq(10, undefined, 30), 2, 1).kind).toBe('renumber')
    expect(planMove(seq(10, 20, undefined), 0, 1).kind).toBe('renumber')
  })

  it('a no-op or out-of-range move plans nothing', () => {
    expect(planMove(seq(10, 20), 1, 1)).toEqual({ kind: 'none' })
    expect(planMove(seq(10, 20), 0, 5)).toEqual({ kind: 'none' })
    expect(planMove([], 0, 0)).toEqual({ kind: 'none' })
  })
})
