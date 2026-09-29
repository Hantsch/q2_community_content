/**
 * Story 024 D6: saves the entry being edited. Builds the patch from the form's own fields (a key
 * the form does not know is never in it), plans the writes from the texts the library opened,
 * asks before a save that would make the launcher drop the entry, and hands the writes to the
 * bridge, which refuses to overwrite a file that changed on disk in the meantime.
 */
import { useCallback, useRef, useState } from 'react'
import type { BridgeWriteItem, BridgeWriteResult } from '../bridge/bridge-protocol'
import type { ContentSourceRead } from '../content-types/descriptor'
import { splitDocument } from '../editor/body-document'
import { fieldsFor, type EntryDraft, type UnreadableDraft } from '../editor/frontmatter-draft'
import { planEntrySave } from './plan-entry-save'
import type { EntryPatch } from './write-entry-document'

const NEWS_DIR = 'news/'

/** The patch for what the user changed: scalar form fields and buttons, plus the body. `order` is
 * read-only in the form and therefore never patched; `image` only while the template offers it. */
export function buildEntryPatch(draft: EntryDraft, body: string): EntryPatch {
  const { fields, initialFields } = draft
  const scalars: Record<string, string | null> = {}
  const keys = ['template', 'title', 'visibleFrom', 'visibleUntil'] as const
  for (const key of keys) {
    if (fields[key] !== initialFields[key]) scalars[key] = fields[key] === '' ? null : fields[key]
  }
  if (fieldsFor(fields.template).image !== 'none' && fields.image !== initialFields.image) {
    scalars.image = fields.image === '' ? null : fields.image
  }

  const patch: EntryPatch = {}
  if (Object.keys(scalars).length > 0) patch.fields = scalars
  const buttonsChanged =
    fields.buttons.length !== initialFields.buttons.length ||
    fields.buttons.some(
      (b, i) =>
        b.label !== initialFields.buttons[i].label || b.url !== initialFields.buttons[i].url,
    )
  if (buttonsChanged) patch.buttons = fields.buttons.length === 0 ? null : fields.buttons
  if (body !== splitDocument(draft.originalText).body) patch.body = body
  return patch
}

export type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'confirm-drop'; reason: string }
  | { kind: 'conflict'; path: string }
  | { kind: 'failed'; message: string }

export interface UseSaveEntryInput {
  readonly read: ContentSourceRead | null
  readonly draft: EntryDraft | UnreadableDraft | null
  readonly body: string
  /** `false` while a field issue blocks saving. */
  readonly canSave: boolean
  readonly write: (writes: readonly BridgeWriteItem[]) => Promise<BridgeWriteResult>
  /** Called after every write succeeded, e.g. to re-read the library. */
  readonly onSaved: () => void
}

export interface UseSaveEntryResult {
  readonly state: SaveState
  readonly save: () => void
  readonly confirmDrop: () => void
  readonly overwrite: () => void
  readonly cancel: () => void
}

const IDLE: SaveState = { kind: 'idle' }

function repoPath(file: string): string {
  return file.startsWith(NEWS_DIR) ? file : `${NEWS_DIR}${file}`
}

export function useSaveEntry(input: UseSaveEntryInput): UseSaveEntryResult {
  const { read, draft, body, canSave, write, onSaved } = input
  const editing = draft !== null && !('unreadable' in draft) ? draft : null
  const file = editing?.file ?? null

  const [tracked, setTracked] = useState<{ file: string | null; state: SaveState }>({
    file,
    state: IDLE,
  })
  const pending = useRef<{ writes: readonly BridgeWriteItem[]; conflictCurrent?: string | null }>({
    writes: [],
  })
  // Another entry starts without the previous one's notice.
  if (tracked.file !== file) setTracked({ file, state: IDLE })
  const state = tracked.file === file ? tracked.state : IDLE
  const setState = useCallback((next: SaveState) => setTracked({ file, state: next }), [file])

  const send = useCallback(
    async (writes: readonly BridgeWriteItem[]) => {
      pending.current = { writes }
      setState({ kind: 'saving' })
      const result = await write(writes)
      if (result.ok) {
        pending.current = { writes: [] }
        setState({ kind: 'saved' })
        onSaved()
      } else if (result.status === 409 && result.path !== undefined) {
        pending.current = { writes, conflictCurrent: result.current ?? null }
        setState({ kind: 'conflict', path: result.path })
      } else {
        const done = result.written?.length
          ? ` (already written: ${result.written.join(', ')})`
          : ''
        setState({ kind: 'failed', message: `${result.error}${done}` })
      }
    },
    [write, onSaved, setState],
  )

  const save = useCallback(() => {
    if (!editing || !canSave || state.kind === 'saving') return
    const otherDocuments: Record<string, string> = {}
    for (const [key, document] of Object.entries(read?.documents ?? {})) {
      otherDocuments[key] = document.text
    }
    const indexText = read?.index.text
    const plan = planEntrySave({
      documentPath: repoPath(editing.file),
      openedDocumentText: editing.originalText,
      patch: buildEntryPatch(editing, body),
      openedIndexText: indexText === undefined || indexText === '' ? undefined : indexText,
      otherDocuments,
    })
    if (!plan.ok) {
      setState({ kind: 'failed', message: plan.reason })
      return
    }
    pending.current = { writes: plan.writes }
    if (plan.drop) setState({ kind: 'confirm-drop', reason: plan.drop.reason })
    else void send(plan.writes)
  }, [editing, canSave, state.kind, read, body, send, setState])

  const confirmDrop = useCallback(() => {
    if (state.kind === 'confirm-drop') void send(pending.current.writes)
  }, [state.kind, send])

  const overwrite = useCallback(() => {
    if (state.kind !== 'conflict') return
    const { path } = state
    const { writes, conflictCurrent } = pending.current
    void send(
      writes.map((item) =>
        item.path === path ? { ...item, expected: conflictCurrent ?? null } : item,
      ),
    )
  }, [state, send])

  const cancel = useCallback(() => {
    pending.current = { writes: [] }
    setState(IDLE)
  }, [setState])

  return { state, save, confirmDrop, overwrite, cancel }
}
