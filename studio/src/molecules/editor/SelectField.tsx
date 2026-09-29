/**
 * Story 022 D3: a labelled select with its issues inline underneath. A current value that is not
 * among `options` (an unknown declared template) is listed as-is, so it is shown, not replaced.
 */
import type { FieldIssue } from '../../editor/field-rules'
import { describedBy, FieldIssueList } from './FieldIssueList'
import { FIELD_CLASS } from './TextField'

export interface SelectFieldProps {
  readonly id: string
  readonly label: string
  readonly value: string
  readonly options: readonly string[]
  readonly onChange: (value: string) => void
  readonly issues?: readonly FieldIssue[]
}

export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  issues = [],
}: SelectFieldProps): React.JSX.Element {
  const shown = options.includes(value) ? options : [...options, value]
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={describedBy(id, issues)}
        className={FIELD_CLASS}
      >
        {shown.map((option) => (
          <option key={option} value={option}>
            {option === '' ? '(none declared)' : option}
          </option>
        ))}
      </select>
      <FieldIssueList id={`${id}-issues`} issues={issues} />
    </div>
  )
}
