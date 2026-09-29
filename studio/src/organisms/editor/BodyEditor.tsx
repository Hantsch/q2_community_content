/**
 * Story 023 D2: the slide body as a plain textarea. The launcher renders the body as plain text, so
 * the field keeps exactly what was typed - no trimming, toolbar, shortcuts or rich editing. Lint
 * findings (`lintBody`) are listed underneath and linked to the field through `aria-describedby`.
 */
import { useId } from 'react'
import { lintBody } from '../../editor/body-lint'
import { FIELD_CLASS } from '../../molecules/editor/TextField'
import { SeverityBadge } from '../SeverityBadge'

export interface BodyEditorProps {
  readonly value: string
  readonly onChange: (body: string) => void
}

export function BodyEditor({ value, onChange }: BodyEditorProps): React.JSX.Element {
  const id = useId()
  const findings = lintBody(value)
  const listId = `${id}-findings`

  return (
    <div data-testid="body-editor" className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">
        Body
      </label>
      <textarea
        id={id}
        value={value}
        rows={10}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={findings.some((finding) => finding.code === 'empty-body') || undefined}
        aria-describedby={findings.length > 0 ? listId : undefined}
        className={`${FIELD_CLASS} py-2`}
      />
      {findings.length > 0 && (
        <ul id={listId} className="flex flex-col gap-1">
          {findings.map((finding, index) => (
            <li
              key={index}
              data-testid="body-finding"
              data-code={finding.code}
              className="flex items-center gap-2"
            >
              <SeverityBadge severity={finding.severity} />
              <span>{finding.message}</span>
              {finding.line !== undefined && (
                <span className="text-text-subtle">line {finding.line}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
