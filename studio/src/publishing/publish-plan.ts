/**
 * Story 027 D1: plans for publishing a draft (adding an index row) and unpublishing an entry
 * (removing one). Pure data in, data out: no I/O, never throws.
 *
 * The pre-check for a publish is the report spine itself over the index plus the new row, so "would
 * the launcher drop this?" is answered by the mirrored pipeline, not by a rule of ours. The one rule
 * outside it is the launcher's own safe-name check, taken from its mirror.
 */
import { writeEntryDocument } from '../authoring/write-entry-document'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { isSafeNewsDocumentName } from '../contract/launcher-safe-names'
import { buildNewsReport } from '../report/build-news-report'
import { buildOrderSequence, documentTexts, indexRows } from './order-plan'

export interface PublishPlan {
  readonly row: { readonly id: string; readonly file: string }
  /** The `order` value the draft gets, written into its frontmatter on publish. */
  readonly frontmatterOrder: number
  readonly verdict: 'ok' | { readonly dropped: string }
}

export type UnpublishPlan =
  | {
      readonly kind: 'remove'
      readonly indexPosition: number
      readonly row: { id: string; file: string }
    }
  | { readonly kind: 'refused'; readonly reason: string }

const NEWS_PREFIX = 'news/'
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}-/
const UNSAFE_NAME_REASON = 'the launcher does not fetch this file name'

function idOf(file: string): string {
  return file.replace(/\.md$/i, '').replace(DATE_PREFIX, '')
}

export function planPublish(read: ContentRepoRead, draftPath: string, now: Date): PublishPlan {
  const file = draftPath.startsWith(NEWS_PREFIX) ? draftPath.slice(NEWS_PREFIX.length) : draftPath
  const row = { id: idOf(file), file }

  const orders = buildOrderSequence(read).flatMap((item) =>
    item.order === undefined ? [] : [item.order],
  )
  const highest = orders.length === 0 ? 0 : Math.max(...orders)
  const frontmatterOrder = (Math.floor(Math.max(highest, 0) / 10) + 1) * 10

  const dropped = (reason: string): PublishPlan => ({
    row,
    frontmatterOrder,
    verdict: { dropped: reason },
  })

  if (!isSafeNewsDocumentName(file)) return dropped(UNSAFE_NAME_REASON)
  const draft = read.drafts.find((candidate) => candidate.path === draftPath)
  if (!draft) return dropped(`${draftPath} is not a draft under news/`)

  const withOrder = writeEntryDocument(draft.text, { fields: { order: String(frontmatterOrder) } })
  const text = withOrder.ok ? withOrder.text : draft.text

  const existing = read.index.value as { entries?: unknown } | null | undefined
  const entries = Array.isArray(existing?.entries) ? (existing.entries as unknown[]) : []
  const indexPosition = entries.length
  const index = {
    ...(typeof existing === 'object' && existing !== null ? existing : {}),
    entries: [...entries, row],
  }
  const report = buildNewsReport({
    index,
    documents: { ...documentTexts(read), [file]: text },
    now,
  })

  const entry = report.entries.find((candidate) => candidate.indexPosition === indexPosition)
  if (entry === undefined || entry.delivered === 'dropped') {
    const errors = (entry?.findings ?? []).filter((finding) => finding.severity === 'error')
    return dropped(errors[0]?.message ?? 'the launcher would drop this entry')
  }
  return { row, frontmatterOrder, verdict: 'ok' }
}

export function planUnpublish(
  read: ContentRepoRead,
  indexPosition: number,
  id: string,
): UnpublishPlan {
  const row = indexRows(read)[indexPosition]
  if (row === undefined || row.id !== id) {
    return { kind: 'refused', reason: `the index row at position ${indexPosition} is not "${id}"` }
  }
  return { kind: 'remove', indexPosition, row }
}
