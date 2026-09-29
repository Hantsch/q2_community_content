/**
 * Story 024 D6: the save button of the entry editor with everything that can follow it: the
 * confirmation before a save that makes the launcher drop the entry, the notice for a file that
 * changed on disk since it was opened, and the outcome. Every state is text, not colour alone.
 */
import type { SaveState } from '../../authoring/use-save-entry'
import { ConfirmDialog } from '../../molecules/dialogs/ConfirmDialog'

export interface SaveEntryControlsProps {
  readonly state: SaveState
  readonly dirty: boolean
  /** `false` while a field issue blocks saving. */
  readonly canSave: boolean
  readonly onSave: () => void
  readonly onConfirmDrop: () => void
  readonly onOverwrite: () => void
  readonly onCancel: () => void
}

const BUTTON_CLASS =
  'min-h-11 min-w-11 rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected disabled:opacity-60'

export function SaveEntryControls({
  state,
  dirty,
  canSave,
  onSave,
  onConfirmDrop,
  onOverwrite,
  onCancel,
}: SaveEntryControlsProps): React.JSX.Element {
  const busy = state.kind === 'saving'
  const disabled = !dirty || !canSave || busy || state.kind === 'conflict'

  return (
    <section aria-label="Save entry" className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onSave} disabled={disabled} className={BUTTON_CLASS}>
          Save
        </button>
        <p role="status" className="min-h-6 font-medium">
          {busy && 'Saving…'}
          {state.kind === 'saved' && 'Saved'}
          {state.kind === 'idle' && !canSave && 'Fix the issues above before saving'}
        </p>
      </div>
      {state.kind === 'failed' && (
        <p
          role="alert"
          className="rounded-md border border-severity-error-border bg-severity-error-soft p-3"
        >
          <strong>Error</strong> not saved: {state.message}
        </p>
      )}
      {state.kind === 'conflict' && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-md border border-severity-warning-border bg-severity-warning-soft p-3"
        >
          <p>
            <strong>Warning</strong> {state.path} changed on disk since it was opened. Nothing was
            written.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onOverwrite} className={BUTTON_CLASS}>
              Overwrite
            </button>
            <button type="button" onClick={onCancel} className={BUTTON_CLASS}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {state.kind === 'confirm-drop' && (
        <ConfirmDialog
          title="Save this entry?"
          message={`The launcher will drop this entry: ${state.reason}`}
          confirmLabel="Save anyway"
          cancelLabel="Cancel"
          onConfirm={onConfirmDrop}
          onCancel={onCancel}
        />
      )}
    </section>
  )
}
