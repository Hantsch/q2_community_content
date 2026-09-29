/**
 * Story 022 D3: a labelled text input with its issues inline underneath, linked through
 * `aria-describedby`. `readOnly` shows a value the editor does not change; `note` explains why.
 */
import type { FieldIssue } from '../../editor/field-rules'
import { describedBy, FieldIssueList } from './FieldIssueList'

export interface TextFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly onChange?: (value: string) => void
  readonly issues?: readonly FieldIssue[]
  readonly placeholder?: string
  readonly readOnly?: boolean
  readonly note?: string
}

export const FIELD_CLASS =
  'min-h-11 rounded-md border border-muted-border bg-transparent px-3 text-base text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected read-only:bg-muted-soft'

export function TextField({
  id,
  label,
  value,
  onChange,
  issues = [],
  placeholder,
  readOnly,
  note,
}: TextFieldProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(event) => onChange?.(event.target.value)}
        aria-invalid={issues.some((issue) => issue.blocksSave) || undefined}
        aria-describedby={describedBy(id, issues, note !== undefined)}
        className={FIELD_CLASS}
      />
      {note !== undefined && (
        <p id={`${id}-note`} className="text-base text-muted">
          {note}
        </p>
      )}
      <FieldIssueList id={`${id}-issues`} issues={issues} />
    </div>
  )
}
