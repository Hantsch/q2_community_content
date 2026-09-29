// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BridgeWriteItem, BridgeWriteResult } from '../bridge/bridge-protocol'
import type { ContentSourceRead } from '../content-types/descriptor'
import { draftFromDocument, updateDraft, type EntryDraft } from '../editor/frontmatter-draft'
import { buildEntryPatch, useSaveEntry } from './use-save-entry'

const DOC = '---\ntemplate: text\ntitle: Alpha\norder: 10\nmystery: keep\n---\nBody\n'
const INDEX =
  JSON.stringify(
    { schemaVersion: 1, entries: [{ id: 'alpha', file: 'a.md', order: 10 }] },
    null,
    2,
  ) + '\n'

const draftOf = (text = DOC, file = 'a.md'): EntryDraft => {
  const draft = draftFromDocument(file, text)
  if ('unreadable' in draft) throw new Error('unreadable')
  return draft
}

const readOf = (text = DOC): ContentSourceRead => ({
  repoRoot: '',
  index: { text: INDEX, value: JSON.parse(INDEX), parsed: true },
  documents: { 'a.md': { text } },
  drafts: [],
  images: [],
  findings: [],
})

describe('buildEntryPatch', () => {
  it('names only changed form-known keys and never order or unknown keys', () => {
    const draft = updateDraft(draftOf(), { title: 'New', order: '99' })
    expect(buildEntryPatch(draft, 'Body\n')).toEqual({ fields: { title: 'New' } })
  })

  it('removes a cleared key and carries a changed body', () => {
    const draft = updateDraft(draftOf(), { title: '' })
    expect(buildEntryPatch(draft, 'Other')).toEqual({ fields: { title: null }, body: 'Other' })
  })

  it('leaves image out while the template offers none', () => {
    const draft = updateDraft(draftOf(), { image: 'x.png' })
    expect(buildEntryPatch(draft, 'Body\n')).toEqual({})
  })
})

function setup(
  write: (w: readonly BridgeWriteItem[]) => Promise<BridgeWriteResult>,
  body = 'Body\n',
) {
  const onSaved = vi.fn()
  const draft = updateDraft(draftOf(), { title: 'New' })
  const view = renderHook(() =>
    useSaveEntry({ read: readOf(), draft, body, canSave: true, write, onSaved }),
  )
  return { view, onSaved }
}

describe('useSaveEntry', () => {
  it('writes the plan through the bridge and reports success', async () => {
    const write = vi.fn().mockResolvedValue({ ok: true, written: ['news/a.md'] })
    const { view, onSaved } = setup(write)
    act(() => view.result.current.save())
    await waitFor(() => expect(view.result.current.state.kind).toBe('saved'))
    const [writes] = write.mock.calls[0] as [BridgeWriteItem[]]
    expect(writes[0]).toMatchObject({ path: 'news/a.md', expected: DOC })
    expect(writes[0].text).toContain('title: New')
    expect(writes[0].text).toContain('mystery: keep')
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('asks before a drop and writes nothing on cancel', () => {
    const write = vi.fn()
    const { view } = setup(write, '')
    act(() => view.result.current.save())
    expect(view.result.current.state).toMatchObject({ kind: 'confirm-drop' })
    act(() => view.result.current.cancel())
    expect(view.result.current.state.kind).toBe('idle')
    expect(write).not.toHaveBeenCalled()
  })

  it('writes a dropping entry after confirming', async () => {
    const write = vi.fn().mockResolvedValue({ ok: true, written: ['news/a.md'] })
    const { view } = setup(write, '')
    act(() => view.result.current.save())
    act(() => view.result.current.confirmDrop())
    await waitFor(() => expect(view.result.current.state.kind).toBe('saved'))
    expect(write).toHaveBeenCalledOnce()
  })

  it('names the changed file on 409 and overwrites with the returned current text', async () => {
    const write = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        error: 'changed',
        path: 'news/a.md',
        current: 'EXTERNAL',
      })
      .mockResolvedValueOnce({ ok: true, written: ['news/a.md'] })
    const { view, onSaved } = setup(write)
    act(() => view.result.current.save())
    await waitFor(() =>
      expect(view.result.current.state).toEqual({ kind: 'conflict', path: 'news/a.md' }),
    )
    expect(onSaved).not.toHaveBeenCalled()
    act(() => view.result.current.overwrite())
    await waitFor(() => expect(view.result.current.state.kind).toBe('saved'))
    const [retry] = write.mock.calls[1] as [BridgeWriteItem[]]
    expect(retry[0].expected).toBe('EXTERNAL')
    expect(onSaved).toHaveBeenCalledOnce()
  })

  it('does nothing while a field issue blocks saving', () => {
    const write = vi.fn()
    const draft = updateDraft(draftOf(), { title: 'New' })
    const { result } = renderHook(() =>
      useSaveEntry({
        read: readOf(),
        draft,
        body: 'Body\n',
        canSave: false,
        write,
        onSaved: vi.fn(),
      }),
    )
    act(() => result.current.save())
    expect(write).not.toHaveBeenCalled()
  })
})
