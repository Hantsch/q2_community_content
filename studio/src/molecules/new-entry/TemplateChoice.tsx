/**
 * Story 025 D3: one radio card of the template picker - the kit's template name, what it is for
 * and whether it needs an image. The texts are the kit README's own; nothing is worded here.
 */
export interface TemplateChoiceProps {
  readonly template: string
  readonly useCase?: string
  readonly image?: string
  readonly checked: boolean
  readonly onChoose: (template: string) => void
}

export function TemplateChoice({
  template,
  useCase,
  image,
  checked,
  onChoose,
}: TemplateChoiceProps): React.JSX.Element {
  return (
    <label
      className={`flex min-h-11 cursor-pointer flex-col gap-1 rounded-md border p-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-selected ${
        checked ? 'border-selected-border bg-selected-soft' : 'border-muted-border'
      }`}
    >
      <span className="flex items-center gap-2">
        <input
          type="radio"
          name="new-entry-template"
          value={template}
          checked={checked}
          onChange={() => onChoose(template)}
          className="h-5 w-5"
        />
        <span className="font-medium">{template}</span>
      </span>
      {useCase !== undefined && <span className="text-base">{useCase}</span>}
      {image !== undefined && <span className="text-base text-muted">Image: {image}</span>}
    </label>
  )
}
