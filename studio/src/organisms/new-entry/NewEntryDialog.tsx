/**
 * Story 025 D3: the "New entry" dialog on the native `<dialog>` (focus held inside, Escape
 * cancels). The author picks a kit template, types a title and may adjust the derived slug and the
 * date; the file name is previewed live and a name that cannot be used is refused in words before
 * anything is written. Rendered only while it is open; it fetches nothing.
 */
import { useEffect, useId, useRef, useState } from 'react'
import type { NewsTemplate } from '../../contract/launcher-contract'
import type { LibraryRow } from '../../library/library-types'
import { TemplateChoice } from '../../molecules/new-entry/TemplateChoice'
import { TextField } from '../../molecules/editor/TextField'
import {
  findNewEntryConflict,
  isValidSlug,
  newEntryFileName,
  slugify,
} from '../../new-entry/new-entry'
import type {
  CreateNewEntryResult,
  GuidanceState,
  NewEntryInput,
} from '../../new-entry/use-new-entry'

const FALLBACK_TEMPLATES: readonly NewsTemplate[] = ['split', 'banner', 'text', 'cover']

export interface NewEntryDialogProps {
  readonly guidance: GuidanceState
  readonly rows: readonly LibraryRow[]
  /** Today's date as `YYYY-MM-DD`, local time. */
  readonly today: string
  readonly onCreate: (input: NewEntryInput) => Promise<CreateNewEntryResult>
  readonly onCancel: () => void
}

const BUTTON_CLASS =
  'min-h-11 min-w-11 rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected disabled:opacity-50'

function titleOf(row: LibraryRow): string {
  return row.title ?? row.file.slice(row.file.lastIndexOf('/') + 1)
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** The reason the entered name cannot be used, or `undefined` while it can. */
function refusalFor(
  input: { title: string; slug: string; date: string },
  rows: readonly LibraryRow[],
): string | undefined {
  if (input.title.trim() === '') return undefined
  if (!isRealDate(input.date)) return 'The date must be a real date written as YYYY-MM-DD.'
  if (!isValidSlug(input.slug)) {
    return 'The slug may only use lowercase letters and digits, joined by single hyphens.'
  }
  const fileName = newEntryFileName(input.date, input.slug)
  const conflict = findNewEntryConflict({ fileName, slug: input.slug, rows })
  if (!conflict) return undefined
  const { existing } = conflict
  return conflict.kind === 'file-exists'
    ? `${fileName} already exists: "${titleOf(existing)}" (${existing.file}).`
    : `The slug "${input.slug}" is already used by "${titleOf(existing)}" (${existing.file}).`
}

export function NewEntryDialog({
  guidance,
  rows,
  today,
  onCreate,
  onCancel,
}: NewEntryDialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const [template, setTemplate] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [slugOverride, setSlugOverride] = useState<string | null>(null)
  const [date, setDate] = useState(today)
  const [failure, setFailure] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || dialog.open) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  const slug = slugOverride ?? slugify(title)
  const refusal = refusalFor({ title, slug, date }, rows)
  const canCreate = template !== null && title.trim() !== '' && refusal === undefined && !busy

  const choices =
    guidance.status === 'ready'
      ? guidance.guidance.map((g) => ({ template: g.template, useCase: g.useCase, image: g.image }))
      : FALLBACK_TEMPLATES.map((name) => ({
          template: name,
          useCase: undefined,
          image: undefined,
        }))

  const submit = async (): Promise<void> => {
    if (!canCreate) return
    setBusy(true)
    setFailure(null)
    const result = await onCreate({ template, title: title.trim(), slug, date })
    setBusy(false)
    if (!result.ok) setFailure(result.message)
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={headingId}
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
      className="w-full max-w-2xl rounded-md border border-muted-border bg-muted-soft p-6"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <h2 id={headingId} className="text-xl font-bold">
          New entry
        </h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">Template</legend>
          {guidance.status === 'unavailable' && (
            <p role="status" className="text-base">
              Template guidance is unavailable; the template names are listed without it.
            </p>
          )}
          {choices.map((choice) => (
            <TemplateChoice
              key={choice.template}
              template={choice.template}
              useCase={choice.useCase}
              image={choice.image}
              checked={template === choice.template}
              onChoose={setTemplate}
            />
          ))}
        </fieldset>
        <TextField id="new-entry-title" label="Title" value={title} onChange={setTitle} />
        <TextField id="new-entry-slug" label="Slug" value={slug} onChange={setSlugOverride} />
        <TextField id="new-entry-date" label="Date" value={date} onChange={setDate} />
        <p className="text-base">
          File: <code data-testid="new-entry-file-name">{newEntryFileName(date, slug)}</code>
        </p>
        {refusal !== undefined && (
          <p role="alert" className="text-base text-severity-error">
            <strong>Refused</strong> {refusal}
          </p>
        )}
        {failure !== null && (
          <p role="alert" className="text-base text-severity-error">
            <strong>Not created</strong> {failure}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={!canCreate} className={BUTTON_CLASS}>
            Create
          </button>
          <button type="button" onClick={onCancel} className={BUTTON_CLASS}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  )
}
