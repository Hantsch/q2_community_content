/**
 * Story 011 D5: explains AC6 (visibility) and AC7 (delivered order) in the author's own terms.
 *
 * Both verdicts are read off the two lists the spine already produced - `resolvedSlides` (every
 * entry the pipeline could build a slide for, unfiltered) and `deliveredSlides` (the same list
 * after `filterAndSortSlides()`'s visibility window and sort) - never by re-checking a visibility
 * window or a sort order ourselves (AC8). The one thing this module reads directly is
 * `Date.parse()`, the same primitive the mirrored `parseBound()` uses on the same strings; nothing
 * here re-implements `parseBound()`'s own malformed-date handling; a malformed bound is simply not
 * a bound (`Number.isNaN`), same as the mirror.
 */
import type { NewsSlide } from '../contract/launcher-contract'
import type { Finding, VisibilityVerdict } from './report-types'

function quote(id: string): string {
  return `"${id}"`
}

/**
 * One entry's visibility verdict (AC6), decided purely by which of the two pipeline lists carries
 * its id, evaluated against the caller's own `now` - never the wall clock.
 *
 * - Absent from `resolvedSlides` entirely: the entry was dropped, and visibility is meaningless for
 *   it (the spine's own placeholder for this case, kept as-is).
 * - Present in both: `published` - the unremarkable default, no finding of its own.
 * - Resolved but filtered out: its own declared `visibleFrom`/`visibleUntil` (carried verbatim on
 *   the resolved slide) explain which bound excluded it, at `info` per the story's Decisions
 *   (Sprint) - a scheduled or expired entry is often exactly what the author intended, not a
 *   mistake. If neither bound explains the absence (a malformed bound the pipeline itself already
 *   ignored, so it could not have caused the filtering), there is nothing safe to claim, so this
 *   falls back to `not-applicable` rather than guessing.
 *
 * `source: 'pipeline'` on the scheduled/expired findings below (not `'studio'`): the pipeline emits
 * no `NewsFeedWarning` for a slide sitting outside its visibility window - filtering it out is
 * silent - but the verdict is still read entirely off two lists `resolveFeed()`/`filterAndSortSlides()`
 * themselves produced, with no studio-side check of anything the pipeline does not already know
 * (unlike D3's declared-image-missing check, which inspects the repository's own file listing, a
 * fact the pipeline never sees). AC8's own wording ("derived from the mirrored pipeline's own
 * output") does not restrict that output to `warnings` - `resolvedSlides`/`deliveredSlides` are
 * output too - so `'pipeline'` is the correct source here, not a mislabel.
 */
export function buildVisibilityVerdict(
  id: string,
  resolvedSlides: readonly NewsSlide[],
  deliveredSlides: readonly NewsSlide[],
  now: Date,
  file: string,
): { visibility: VisibilityVerdict; finding?: Finding } {
  const slide = resolvedSlides.find((candidate) => candidate.id === id)
  if (!slide) return { visibility: { state: 'not-applicable' } }

  const isDelivered = deliveredSlides.some((candidate) => candidate.id === id)
  if (isDelivered) return { visibility: { state: 'published' } }

  const nowMs = now.getTime()

  if (slide.visibleFrom !== undefined) {
    const from = Date.parse(slide.visibleFrom)
    if (!Number.isNaN(from) && nowMs < from) {
      return {
        visibility: { state: 'scheduled', visibleFrom: slide.visibleFrom },
        finding: {
          severity: 'info',
          kind: 'scheduled',
          message: `not yet visible; scheduled for ${slide.visibleFrom}`,
          entryId: id,
          file,
          source: 'pipeline',
        },
      }
    }
  }

  if (slide.visibleUntil !== undefined) {
    const until = Date.parse(slide.visibleUntil)
    if (!Number.isNaN(until) && nowMs > until) {
      return {
        visibility: { state: 'expired', visibleUntil: slide.visibleUntil },
        finding: {
          severity: 'info',
          kind: 'expired',
          message: `no longer visible; expired ${slide.visibleUntil}`,
          entryId: id,
          file,
          source: 'pipeline',
        },
      }
    }
  }

  // Resolved, filtered out, yet neither declared bound explains it against `now` - only reachable
  // via a malformed bound the mirror's own `parseBound()` already treats as no bound at all, so it
  // could not be why `filterAndSortSlides()` dropped this slide. Nothing safe to claim either way.
  return { visibility: { state: 'not-applicable' } }
}

/**
 * AC7's tie-break flag: every resolved entry that shares its `order` with at least one other
 * resolved entry gets a `Finding` naming the others and which one `filterAndSortSlides()`'s stable
 * sort actually delivers first.
 *
 * "Delivered first" has to be read off `deliveredSlides` - the filtered-and-sorted list the sort
 * really produced - never off `resolvedSlides`'s unfiltered index order: a tied entry can be first
 * in index order and still be scheduled/expired, in which case it is never delivered at all, and
 * naming it "delivered first" would be simply wrong. If none of a tie group's members made it into
 * `deliveredSlides` (all scheduled/expired), there is no actual delivery-order collision to explain,
 * so that group is skipped entirely rather than guessing at an order among entries none of which
 * deliver.
 *
 * Entries with no usable declared `order` all share the pipeline's own sentinel
 * (`Number.MAX_SAFE_INTEGER`, `parseOrder()`'s fallback) rather than an intentional order value, and
 * are already reported through the pipeline's own "sorts after the ordered ones" warning - grouping
 * them here as well would flag every such entry as tied with every other one, which is not what AC7
 * describes.
 *
 * One `Finding` per participant (not one shared finding), each carrying that participant's own
 * `entryId` - `Finding` has a single optional `entryId`, not a list, so there is no other shape for
 * "this concerns two entries" per the story's own note on this.
 */
export function buildOrderTieFindings(
  resolvedSlides: readonly NewsSlide[],
  deliveredSlides: readonly NewsSlide[],
  fileById: ReadonlyMap<string, string>,
): Finding[] {
  const groups = new Map<number, NewsSlide[]>()
  for (const slide of resolvedSlides) {
    if (slide.order === Number.MAX_SAFE_INTEGER) continue
    const group = groups.get(slide.order)
    if (group) group.push(slide)
    else groups.set(slide.order, [slide])
  }

  const findings: Finding[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue

    const deliveredIndexOf = (id: string): number =>
      deliveredSlides.findIndex((candidate) => candidate.id === id)
    const deliveredMembers = group
      .map((slide) => ({ slide, deliveredIndex: deliveredIndexOf(slide.id) }))
      .filter((member) => member.deliveredIndex >= 0)
      .sort((a, b) => a.deliveredIndex - b.deliveredIndex)
    // No tied member was actually delivered - nothing collided, so nothing to report.
    if (deliveredMembers.length === 0) continue
    const firstId = deliveredMembers[0].slide.id

    for (const slide of group) {
      const otherIds = group
        .filter((candidate) => candidate.id !== slide.id)
        .map((candidate) => quote(candidate.id))
        .join(', ')
      findings.push({
        severity: 'warning',
        kind: 'order-tie',
        message: `shares order ${slide.order} with ${otherIds}; ${quote(firstId)} is delivered first (index order)`,
        entryId: slide.id,
        file: fileById.get(slide.id),
        source: 'studio',
      })
    }
  }
  return findings
}
