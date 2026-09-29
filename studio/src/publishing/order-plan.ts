/**
 * Story 027 D1: the delivered order of the feed as a plain sequence, and the plan for moving one
 * entry within it. Pure data in, data out: no I/O, never throws.
 *
 * The sequence is read off the mirrored pipeline (`resolveFeed()` then `filterAndSortSlides()`), never
 * off a sort of ours. Visibility bounds are removed before sorting so that scheduled and expired
 * entries stay in the sequence: the author reorders them too.
 */
import { filterAndSortSlides, resolveFeed, type NewsSlide } from '../contract/launcher-contract'
import type { ContentRepoRead } from '../content-repo/read-content-repo'

export interface OrderItem {
  readonly id: string
  readonly file: string
  readonly indexPosition: number
  /** The frontmatter `order`; undefined where the pipeline finds no usable value. */
  readonly order: number | undefined
}

export interface OrderChange {
  readonly id: string
  readonly file: string
  readonly indexPosition: number
  readonly from: number | undefined
  readonly to: number
}

export type MovePlan =
  | { readonly kind: 'none' }
  | { readonly kind: 'gap'; readonly changes: readonly [OrderChange] }
  | { readonly kind: 'renumber'; readonly changes: readonly OrderChange[] }

/** The rows of `news/index.json` with a usable id and file, in index order (exported for reuse). */
export function indexRows(read: ContentRepoRead): { id: string; file: string }[] {
  const entries = (read.index.value as { entries?: unknown } | null | undefined)?.entries
  if (!Array.isArray(entries)) return []
  return entries.map((raw) => {
    const id = (raw as { id?: unknown } | null)?.id
    const file = (raw as { file?: unknown } | null)?.file
    return typeof id === 'string' &&
      id.trim() !== '' &&
      typeof file === 'string' &&
      file.trim() !== ''
      ? { id: id.trim(), file: file.trim() }
      : { id: '', file: '' }
  })
}

export function documentTexts(read: ContentRepoRead): Record<string, string> {
  return Object.fromEntries(Object.entries(read.documents).map(([file, { text }]) => [file, text]))
}

export function buildOrderSequence(read: ContentRepoRead): OrderItem[] {
  const { slides } = resolveFeed({ index: read.index.value, documents: documentTexts(read) })

  const rowById = new Map<string, { file: string; indexPosition: number }>()
  indexRows(read).forEach((row, indexPosition) => {
    if (row.id !== '' && !rowById.has(row.id))
      rowById.set(row.id, { file: row.file, indexPosition })
  })

  const unbounded: NewsSlide[] = slides.map((slide) => {
    const rest = { ...slide }
    delete rest.visibleFrom
    delete rest.visibleUntil
    return rest
  })
  const items: OrderItem[] = []
  for (const slide of filterAndSortSlides(unbounded, new Date(0))) {
    const row = rowById.get(slide.id)
    if (!row) continue
    items.push({
      id: slide.id,
      file: row.file,
      indexPosition: row.indexPosition,
      order: slide.order === Number.MAX_SAFE_INTEGER ? undefined : slide.order,
    })
  }
  return items
}

function change(item: OrderItem, to: number): OrderChange {
  return { id: item.id, file: item.file, indexPosition: item.indexPosition, from: item.order, to }
}

/** Array-move semantics: remove at `from`, insert at `to`. */
export function planMove(sequence: readonly OrderItem[], from: number, to: number): MovePlan {
  const inRange = (n: number): boolean => Number.isInteger(n) && n >= 0 && n < sequence.length
  if (!inRange(from) || !inRange(to) || from === to) return { kind: 'none' }

  const moved = sequence[from]
  const reordered = [...sequence]
  reordered.splice(from, 1)
  reordered.splice(to, 0, moved)

  const before = to === 0 ? undefined : reordered[to - 1]
  const after = to === reordered.length - 1 ? undefined : reordered[to + 1]
  const prev = to === 0 ? 0 : before?.order
  if (after === undefined && prev !== undefined) {
    // At the end: the next multiple of ten above the last value, always a gap.
    return { kind: 'gap', changes: [change(moved, (Math.floor(prev / 10) + 1) * 10)] }
  }
  const next = after?.order
  if (prev !== undefined && next !== undefined) {
    const value = Math.floor((prev + next) / 2)
    if (prev < value && value < next) return { kind: 'gap', changes: [change(moved, value)] }
  }

  const changes = reordered
    .map((item, index) => change(item, (index + 1) * 10))
    .filter((c) => c.from !== c.to)
  return { kind: 'renumber', changes }
}
