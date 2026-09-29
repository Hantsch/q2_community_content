/**
 * Story 016 D3: one row of the library — presentational only, like `ContentTypeNav`. Data and
 * handlers arrive as props; this component fetches nothing and resolves nothing. In particular the
 * thumbnail is a plain `thumbnailUrl` string the caller already resolved — turning `row.image` into
 * a URL is D4's job (the bridge lives there), not this component's.
 */
import { EntryStatusBadge } from '../../molecules/status/EntryStatusBadge'
import type { LibraryRow } from '../../library/library-types'

export interface LibraryEntryRowProps {
  readonly row: LibraryRow
  /** Whether this row is the one the detail panel (story 017) currently shows. */
  readonly selected: boolean
  readonly onSelect: (id: LibraryRow['id']) => void
  /** An already-resolved thumbnail URL, or absent — this component never resolves `row.image`
   * itself, it only decides how to render the result. */
  readonly thumbnailUrl?: string
  /** Story 027 D6: shown on a draft row only; absent callback, absent button. */
  readonly onPublish?: (draftPath: string) => void
  /** Shown on an index row only, and only when the row knows its index position. */
  readonly onUnpublish?: (indexPosition: number, id: string) => void
  /** True while a publishing write is in flight. */
  readonly busy?: boolean
}

const ACTION_CLASS =
  'min-h-11 min-w-11 self-start rounded-md border border-muted-border px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-selected disabled:opacity-50'

/** AC3: "visible from" for a scheduled row, "visible until" for an expired one. Which of the two
 * it is follows from `row.status`, matching `LibraryRow.visibilityDate`'s own doc comment. */
function visibilityLabel(status: LibraryRow['status']): string {
  return status === 'scheduled' ? 'Visible from' : 'Visible until'
}

/** The fallback title (row.title is absent): the file name, not the full repository path. */
function titleOf(row: LibraryRow): string {
  if (row.title) return row.title
  const segments = row.file.split('/')
  return segments[segments.length - 1] ?? row.file
}

export function LibraryEntryRow({
  row,
  selected,
  onSelect,
  thumbnailUrl,
  onPublish,
  onUnpublish,
  busy = false,
}: LibraryEntryRowProps): React.JSX.Element {
  const title = titleOf(row)
  const indexPosition = row.verdict?.indexPosition

  return (
    <li className="flex flex-col gap-2">
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(row.id)}
        className={`flex min-h-11 w-full items-center gap-3 rounded-md border px-3 py-2 text-left ${
          selected ? 'border-selected-border bg-selected-soft' : 'border-muted-border'
        }`}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Thumbnail for ${title}`}
            className="h-12 w-12 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label="No thumbnail"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-muted-border bg-muted-soft text-center text-xs text-muted"
          >
            No thumbnail
          </span>
        )}

        <span className="flex flex-1 flex-col gap-1">
          <span className="font-medium">{title}</span>

          <span>
            {row.templatesDiffer ? (
              <>
                <span>declared: {row.declaredTemplate ?? '—'}</span>{' '}
                <span>delivered: {row.deliveredTemplate}</span>
              </>
            ) : (
              <span>{row.declaredTemplate ?? '—'}</span>
            )}
          </span>

          {row.order !== undefined && <span>Order: {row.order}</span>}

          {row.visibilityDate && (
            <span>
              {visibilityLabel(row.status)}: {row.visibilityDate}
            </span>
          )}

          {row.dropReason && <span>Reason: {row.dropReason}</span>}
        </span>

        <EntryStatusBadge status={row.status} />

        <span className="sr-only">{selected ? ' (selected)' : ''}</span>
      </button>
      {row.status === 'draft' && onPublish && (
        <button
          type="button"
          disabled={busy}
          aria-label={`Publish ${title}`}
          onClick={() => onPublish(row.file)}
          className={ACTION_CLASS}
        >
          Publish
        </button>
      )}
      {row.status !== 'draft' && onUnpublish && indexPosition !== undefined && (
        <button
          type="button"
          disabled={busy}
          aria-label={`Unpublish ${title}`}
          onClick={() => onUnpublish(indexPosition, row.id)}
          className={ACTION_CLASS}
        >
          Unpublish
        </button>
      )}
    </li>
  )
}
