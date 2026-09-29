/**
 * Story 027 D5: an inline (non-modal) question with two answers. The panel names itself from its
 * title; the body is a slot for whatever the question needs to list. Presentational only.
 */
import { useId } from 'react'

export interface ConfirmPanelProps {
  readonly title: string
  /** Overrides the default "Confirm", e.g. "Publish anyway". */
  readonly confirmLabel?: string
  readonly disabled?: boolean
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly children?: React.ReactNode
}

const BUTTON_CLASS =
  'min-h-11 min-w-11 rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected disabled:opacity-50'

export function ConfirmPanel({
  title,
  confirmLabel = 'Confirm',
  disabled = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmPanelProps): React.JSX.Element {
  const titleId = useId()
  return (
    <section
      role="alertdialog"
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-md border border-muted-border p-4"
    >
      <h3 id={titleId} className="font-medium">
        {title}
      </h3>
      {children}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onConfirm} disabled={disabled} className={BUTTON_CLASS}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={disabled} className={BUTTON_CLASS}>
          Cancel
        </button>
      </div>
    </section>
  )
}
