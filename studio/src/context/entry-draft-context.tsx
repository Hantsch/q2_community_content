/**
 * Story 022 D3: the frontmatter draft of the selected entry, held in a context beside
 * `CurrentEntryContext`. The provider takes the selected file and its raw document text and starts
 * a fresh draft whenever either changes (selecting another entry, or a re-read that returns new
 * text), so a later story can decide where to ask before an edit is thrown away. Nothing here
 * writes to disk: the draft lives in memory only.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  draftFromDocument,
  isDirty as isDraftDirty,
  updateDraft,
  type DraftFields,
  type EntryDraft,
  type UnreadableDraft,
} from '../editor/frontmatter-draft'
import { canSave as canSaveDraft, validateDraft, type FieldIssue } from '../editor/field-rules'

export interface EntryDraftContextValue {
  /** `null` while no document is selected; `{ unreadable: true }` when its frontmatter cannot be
   * read. */
  readonly draft: EntryDraft | UnreadableDraft | null
  readonly update: (patch: Partial<DraftFields>) => void
  readonly isDirty: boolean
  readonly issues: readonly FieldIssue[]
  readonly canSave: boolean
  /** Back to the fields as first read. */
  readonly reset: () => void
  /** `true` when nothing would be lost; otherwise asks the user and returns their answer. */
  readonly confirmDiscard: () => boolean
}

const EntryDraftContext = createContext<EntryDraftContextValue | undefined>(undefined)

export interface EntryDraftProviderProps {
  /** Repository-relative file of the selected entry, `null` when nothing is selected. */
  readonly file: string | null
  /** The document text as read from disk, `undefined` when there is none for `file`. */
  readonly text: string | undefined
  readonly children: React.ReactNode
}

function initialDraft(file: string | null, text: string | undefined) {
  return file === null || text === undefined ? null : draftFromDocument(file, text)
}

function isEntryDraft(draft: EntryDraft | UnreadableDraft | null): draft is EntryDraft {
  return draft !== null && !('unreadable' in draft)
}

export function EntryDraftProvider({
  file,
  text,
  children,
}: EntryDraftProviderProps): React.JSX.Element {
  const [state, setState] = useState(() => ({ file, text, draft: initialDraft(file, text) }))

  // Adjusting state while rendering, as `useNewsLibrary` does: a changed selection or text starts
  // a fresh draft without an extra render pass through an effect.
  if (state.file !== file || state.text !== text) {
    setState({ file, text, draft: initialDraft(file, text) })
  }

  const { draft } = state
  const value = useMemo<EntryDraftContextValue>(() => {
    const editable = isEntryDraft(draft)
    return {
      draft,
      update: (patch) =>
        setState((current) =>
          isEntryDraft(current.draft)
            ? { ...current, draft: updateDraft(current.draft, patch) }
            : current,
        ),
      isDirty: editable && isDraftDirty(draft),
      issues: editable ? validateDraft(draft) : [],
      canSave: editable && canSaveDraft(draft),
      reset: () =>
        setState((current) =>
          isEntryDraft(current.draft)
            ? { ...current, draft: { ...current.draft, fields: current.draft.initialFields } }
            : current,
        ),
      confirmDiscard: () =>
        !(editable && isDraftDirty(draft)) ||
        window.confirm(`Discard unsaved changes to ${draft.file}?`),
    }
  }, [draft])

  // The browser's own "leave site?" prompt, registered only while there is something to lose.
  const dirty = value.isDirty
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event: BeforeUnloadEvent): void => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  return <EntryDraftContext.Provider value={value}>{children}</EntryDraftContext.Provider>
}

/** Throws outside `EntryDraftProvider` - a wiring bug, like `useCurrentEntry`. */
export function useEntryDraft(): EntryDraftContextValue {
  const value = useContext(EntryDraftContext)
  if (!value) throw new Error('useEntryDraft must be used within an EntryDraftProvider')
  return value
}
