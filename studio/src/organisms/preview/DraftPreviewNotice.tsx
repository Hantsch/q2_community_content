/**
 * Story 020 D3: the notice above a draft's slide preview. Props-in/JSX-out like
 * `ContentTypeStateNotice`: the caller hands over the draft's own verdict (from the synthetic
 * report the preview is built from) and how many entries that report delivers; nothing is fetched
 * or derived here beyond wording. Finding messages are the pipeline's own, never reworded.
 *
 * It lives outside the slide iframe on purpose, so the frame stays exactly what the launcher would
 * render.
 */
import { EntryStatusBadge } from '../../molecules/status/EntryStatusBadge'
import type { EntryVerdict, VisibilityVerdict } from '../../report/report-types'

export interface DraftPreviewNoticeProps {
  readonly verdict: EntryVerdict
  /** Entries of the synthetic report whose `delivered` has a `position`. */
  readonly deliveredCount: number
}

function visibilityLine(visibility: VisibilityVerdict): string | undefined {
  switch (visibility.state) {
    case 'scheduled':
      return `Scheduled — visible from ${visibility.visibleFrom}.`
    case 'expired':
      return `Expired — was visible until ${visibility.visibleUntil}.`
    case 'published':
    case 'not-applicable':
      return undefined
    default: {
      const exhaustive: never = visibility
      throw new Error(`Unhandled visibility state: ${String(exhaustive)}`)
    }
  }
}

function positionLine(verdict: EntryVerdict, deliveredCount: number): string | undefined {
  const { delivered, declared, visibility } = verdict
  if (delivered !== 'dropped' && delivered.position !== undefined) {
    const byOrder = declared.order === undefined ? '' : `, by its order ${declared.order}`
    return `Position ${delivered.position + 1} of ${deliveredCount} in today's feed${byOrder}.`
  }
  return visibilityLine(visibility)
}

export function DraftPreviewNotice({
  verdict,
  deliveredCount,
}: DraftPreviewNoticeProps): React.JSX.Element {
  const { delivered, declared, findings } = verdict
  const position = positionLine(verdict, deliveredCount)

  return (
    <section
      aria-label="Draft preview"
      className="flex flex-col gap-2 rounded-md border border-status-draft-border bg-status-draft-soft p-4 text-text"
    >
      <p className="flex items-center gap-2">
        <EntryStatusBadge status="draft" />
        <span className="font-medium">
          Not in news/index.json — the launcher does not show this.
        </span>
      </p>
      <p>
        If published:{' '}
        {delivered === 'dropped' ? (
          'dropped — the launcher would not deliver it.'
        ) : (
          <>
            delivered as {delivered.template}
            {declared.template !== undefined && declared.template !== delivered.template
              ? ` (declared ${declared.template})`
              : ''}
          </>
        )}
      </p>
      {findings.length > 0 && (
        <ul className="flex flex-col gap-1">
          {findings.map((finding, index) => (
            <li key={index}>{finding.message}</li>
          ))}
        </ul>
      )}
      {position !== undefined && <p>{position}</p>}
      <p className="text-text-muted">Assumes its row is appended to the end of news/index.json.</p>
    </section>
  )
}
