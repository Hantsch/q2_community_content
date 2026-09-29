// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { BridgeWriteBatchResult } from '../bridge/bridge-protocol'
import { makeRead } from './test-support'
import { usePublishing } from './use-publishing'

const entry = (id: string, order: string) => ({
  id,
  template: 'text',
  title: id,
  body: 'Body',
  order,
})
const read = makeRead([entry('a', '10'), entry('b', '20'), entry('c', '21'), entry('d', '40')])
const OK: BridgeWriteBatchResult = { ok: true, written: [] }

function setup(outcome: BridgeWriteBatchResult) {
  const writeBatch = vi.fn().mockResolvedValue(outcome)
  const refresh = vi.fn()
  const view = renderHook(() => usePublishing({ read, writeBatch, refresh }))
  return { ...view, writeBatch, refresh }
}

describe('usePublishing', () => {
  it('a renumber move waits for confirmation and lists every changed entry', async () => {
    const { result, writeBatch, refresh } = setup(OK)
    act(() => result.current.move(0, 1))
    expect(writeBatch).not.toHaveBeenCalled()
    expect(result.current.pending?.kind).toBe('renumber')
    act(() => result.current.confirm())
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(writeBatch).toHaveBeenCalledTimes(1)
    expect(result.current.pending).toBeNull()
    expect(result.current.result?.kind).toBe('changed')
  })

  it('a gap move writes at once and refreshes', async () => {
    const { result, writeBatch, refresh } = setup(OK)
    act(() => result.current.move(3, 1))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    expect(writeBatch).toHaveBeenCalledTimes(1)
  })

  it('a conflict is surfaced as the error and nothing is refreshed', async () => {
    const { result, refresh } = setup({
      ok: false,
      kind: 'conflict',
      status: 409,
      error: 'changed on disk',
      conflicts: [{ path: 'news/index.json', current: null }],
    })
    act(() => result.current.move(3, 1))
    await waitFor(() => expect(result.current.result?.kind).toBe('error'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('an unpublish always asks first and cancel writes nothing', () => {
    const { result, writeBatch } = setup(OK)
    act(() => result.current.unpublish(1, 'b'))
    expect(result.current.pending).toMatchObject({ kind: 'unpublish', id: 'b' })
    act(() => result.current.cancel())
    expect(result.current.pending).toBeNull()
    expect(writeBatch).not.toHaveBeenCalled()
  })
})
