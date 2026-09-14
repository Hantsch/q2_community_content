/**
 * Story 016 D2: a small presentational badge for one `LibraryRow.status`
 * (`studio/src/library/library-types.ts`). Purely props-in/JSX-out, like `ContentTypeStateNotice` -
 * no fetch, no IO, no derivation of the status itself, which stays `library-model.ts`'s job.
 *
 * The status word is always rendered as text (design-tokens house rule: status is never signalled
 * by colour alone) - the per-status colour in `STATUS_STYLES` is a reinforcing cue, not the only
 * one.
 */
import type { LibraryStatus } from '../../library/library-types'

export interface EntryStatusBadgeProps {
  readonly status: LibraryStatus
}

const STATUS_LABEL: Readonly<Record<LibraryStatus, string>> = {
  published: 'Published',
  scheduled: 'Scheduled',
  expired: 'Expired',
  dropped: 'Dropped',
  draft: 'Draft',
}

const STATUS_STYLES: Readonly<Record<LibraryStatus, string>> = {
  published: 'bg-status-published-soft text-status-published border-status-published-border',
  scheduled: 'bg-status-scheduled-soft text-status-scheduled border-status-scheduled-border',
  expired: 'bg-status-expired-soft text-status-expired border-status-expired-border',
  dropped: 'bg-status-dropped-soft text-status-dropped border-status-dropped-border',
  draft: 'bg-status-draft-soft text-status-draft border-status-draft-border',
}

export function EntryStatusBadge({ status }: EntryStatusBadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-sm font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
