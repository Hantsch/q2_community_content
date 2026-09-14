/**
 * Story 016 D3: composes the library's rows or its non-list states, purely from props — no
 * fetching, no context reads, no state of its own (`/frontend-guidelines`). D4's data hook and
 * context are what will eventually own `model`, `loading`, `selectedId` and `onSelect`; this
 * component only renders whatever it is handed.
 *
 * D4 addendum: `thumbnailUrlFor` closes the gap D3 flagged — resolving `LibraryRow.image` to a
 * bridge URL is a browser-URL concern, not something this presentational component or the pure
 * `LibraryModel` should own, so it arrives as a prop and is threaded down to each row.
 */
import { LibraryEntryRow } from './LibraryEntryRow'
import { LibraryStateNotice } from './LibraryStateNotice'
import type { LibraryModel, LibraryRow } from '../../library/library-types'

export interface LibraryViewProps {
  /** `null` before the first read completes — distinct from `loading`, since a load can also
   * finish with a model the caller wants to keep showing while a refresh is in flight. */
  readonly model: LibraryModel | null
  readonly loading: boolean
  readonly selectedId: LibraryRow['id'] | null
  readonly onSelect: (id: LibraryRow['id']) => void
  /** Resolves a row's thumbnail URL, or `undefined` when the row has none — e.g.
   * `useNewsLibrary()`'s `thumbnailUrlFor`. Optional so existing callers/tests need not supply it. */
  readonly thumbnailUrlFor?: (row: LibraryRow) => string | undefined
}

export function LibraryView({
  model,
  loading,
  selectedId,
  onSelect,
  thumbnailUrlFor,
}: LibraryViewProps): React.JSX.Element {
  if (loading || !model) {
    return <LibraryStateNotice state="loading" />
  }

  if (model.state !== 'ready') {
    return <LibraryStateNotice state={model.state} unreadableFindings={model.unreadableFindings} />
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="Entries">
        <h2 className="font-medium">Entries</h2>
        <ul className="flex flex-col gap-2">
          {model.entries.map((row) => (
            <LibraryEntryRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={onSelect}
              thumbnailUrl={thumbnailUrlFor?.(row)}
            />
          ))}
        </ul>
      </section>

      <section aria-label="Drafts">
        <h2 className="font-medium">Drafts — not visible to the launcher</h2>
        <ul className="flex flex-col gap-2">
          {model.drafts.map((row) => (
            <LibraryEntryRow
              key={row.id}
              row={row}
              selected={row.id === selectedId}
              onSelect={onSelect}
              thumbnailUrl={thumbnailUrlFor?.(row)}
            />
          ))}
        </ul>
      </section>
    </div>
  )
}
