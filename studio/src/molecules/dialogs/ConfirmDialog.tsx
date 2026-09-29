/**
 * Story 024 D6: a modal question with two answers, on the native `<dialog>` so focus is held inside
 * it and Escape means the cancel answer. Rendered only while it is open.
 */
import { useEffect, useId, useRef } from 'react'

export interface ConfirmDialogProps {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

const BUTTON_CLASS =
  'min-h-11 min-w-11 rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected'

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="max-w-lg rounded-md border border-severity-warning-border bg-severity-warning-soft p-6 text-text"
    >
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-xl font-bold">
          {title}
        </h2>
        <p>{message}</p>
        <div className="flex gap-2">
          <button type="button" onClick={onConfirm} className={BUTTON_CLASS}>
            {confirmLabel}
          </button>
          <button type="button" onClick={onCancel} className={BUTTON_CLASS}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
