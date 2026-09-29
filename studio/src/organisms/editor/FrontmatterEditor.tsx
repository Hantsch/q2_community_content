/**
 * Story 022 D3: the frontmatter editor of the selected entry or draft. Reads and writes the
 * in-memory draft through `useEntryDraft()`; issues re-evaluate on every input because they are
 * derived from the draft. Nothing is written to disk, and the validation panel and preview keep
 * showing the on-disk report.
 */
import { useEntryDraft } from '../../context/entry-draft-context'
import { fieldsFor } from '../../editor/frontmatter-draft'
import type { FieldIssue, FieldName } from '../../editor/field-rules'
import { ButtonListField } from '../../molecules/editor/ButtonListField'
import { SelectField } from '../../molecules/editor/SelectField'
import { TextField } from '../../molecules/editor/TextField'

const TEMPLATES = ['text', 'split', 'banner', 'cover']
const DATE_PLACEHOLDER = '2026-08-01T00:00:00Z'

function issuesOf(issues: readonly FieldIssue[], field: FieldName): FieldIssue[] {
  return issues.filter((issue) => issue.field === field)
}

function statusText(dirty: boolean, blocking: number): string {
  const parts: string[] = []
  if (dirty) parts.push('Unsaved changes')
  if (blocking > 0) {
    parts.push(blocking === 1 ? '1 issue blocks saving' : `${blocking} issues block saving`)
  }
  return parts.join(' · ')
}

export function FrontmatterEditor(): React.JSX.Element | null {
  const { draft, update, isDirty, issues } = useEntryDraft()
  if (!draft) return null

  if ('unreadable' in draft) {
    return (
      <section aria-label="Frontmatter editor" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">Frontmatter</h2>
        <p role="alert" className="text-severity-error">
          <strong>Error</strong> the frontmatter cannot be read — the launcher drops this entry
        </p>
      </section>
    )
  }

  const { fields } = draft
  const image = fieldsFor(fields.template).image
  const blocking = issues.filter((issue) => issue.blocksSave).length

  return (
    <section aria-label="Frontmatter editor" className="flex flex-col gap-4">
      <h2 className="text-xl font-bold">Frontmatter</h2>
      <p role="status" className="min-h-6 font-medium">
        {statusText(isDirty, blocking)}
      </p>
      <SelectField
        id="field-template"
        label="Template"
        value={fields.template}
        options={TEMPLATES}
        onChange={(template) => update({ template })}
        issues={issuesOf(issues, 'template')}
      />
      <TextField
        id="field-title"
        label="Title"
        value={fields.title}
        onChange={(title) => update({ title })}
        issues={issuesOf(issues, 'title')}
      />
      <TextField
        id="field-order"
        label="Order"
        value={fields.order}
        readOnly
        note="Reordering happens in the library"
      />
      {image !== 'none' && (
        <TextField
          id="field-image"
          label={image === 'required' ? 'Image (required)' : 'Image (optional)'}
          value={fields.image}
          onChange={(next) => update({ image: next })}
          issues={issuesOf(issues, 'image')}
        />
      )}
      <TextField
        id="field-visible-from"
        label="Visible from"
        value={fields.visibleFrom}
        placeholder={DATE_PLACEHOLDER}
        onChange={(visibleFrom) => update({ visibleFrom })}
        issues={issuesOf(issues, 'visibleFrom')}
      />
      <TextField
        id="field-visible-until"
        label="Visible until"
        value={fields.visibleUntil}
        placeholder={DATE_PLACEHOLDER}
        onChange={(visibleUntil) => update({ visibleUntil })}
        issues={issuesOf(issues, 'visibleUntil')}
      />
      <ButtonListField
        buttons={fields.buttons}
        issues={issuesOf(issues, 'buttons')}
        onChange={(buttons) => update({ buttons })}
      />
    </section>
  )
}
