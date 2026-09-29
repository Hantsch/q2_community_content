/**
 * Story 022 D3: the buttons of a slide as an editable list - add, remove, edit label and url.
 * Issues of one button sit under its own field (label rules under the label, url and cap rules
 * under the url).
 */
import type { DraftButton } from '../../editor/frontmatter-draft'
import type { FieldIssue } from '../../editor/field-rules'
import { TextField } from './TextField'

export interface ButtonListFieldProps {
  readonly buttons: readonly DraftButton[]
  readonly issues: readonly FieldIssue[]
  readonly onChange: (buttons: DraftButton[]) => void
}

const LABEL_RULES = ['button-label', 'presentation']
const BUTTON_CLASS =
  'min-h-11 w-fit rounded-md border border-muted-border px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected'

export function ButtonListField({
  buttons,
  issues,
  onChange,
}: ButtonListFieldProps): React.JSX.Element {
  const replace = (index: number, patch: Partial<DraftButton>): void =>
    onChange(buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)))

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-medium">Buttons</legend>
      {buttons.map((button, index) => {
        const own = issues.filter((issue) => issue.index === index)
        const n = index + 1
        return (
          <div
            key={index}
            role="group"
            aria-label={`Button ${n}`}
            className="flex flex-col gap-2 rounded-md border border-muted-border p-3"
          >
            <TextField
              id={`button-${n}-label`}
              label={`Button ${n} label`}
              value={button.label}
              onChange={(label) => replace(index, { label })}
              issues={own.filter((issue) => LABEL_RULES.includes(issue.rule))}
            />
            <TextField
              id={`button-${n}-url`}
              label={`Button ${n} url`}
              value={button.url}
              onChange={(url) => replace(index, { url })}
              issues={own.filter((issue) => !LABEL_RULES.includes(issue.rule))}
            />
            <button
              type="button"
              onClick={() => onChange(buttons.filter((_, i) => i !== index))}
              className={BUTTON_CLASS}
            >
              Remove button {n}
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => onChange([...buttons, { label: '', url: '' }])}
        className={BUTTON_CLASS}
      >
        Add button
      </button>
    </fieldset>
  )
}
