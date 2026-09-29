/**
 * Story 020 D1: a draft folded into an in-memory read as if it were the last row of
 * `news/index.json`. Pure, data-in/data-out, never throws, and it never touches its input - the
 * result shares no mutated state with the read it was given.
 *
 * There is deliberately no verdict logic here. The caller runs the returned read through the same
 * unchanged `buildNewsReport()` / validators any published row goes through, so the draft's verdict
 * is the pipeline's own. The appended row carries no `order`: the pipeline reads order from the
 * document's frontmatter only (`parseOrder(data.order)`), so a draft without one sorts last with
 * the pipeline's own warning.
 */
import type { ContentRepoRead } from '../content-repo/read-content-repo'

const NEWS_PREFIX = 'news/'

export interface DraftAsPublished {
  read: ContentRepoRead
  /** The id of the appended row - the draft's repository path. */
  entryId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value)
}

/**
 * Returns a new read in which `draftPath` is an index row (last), its text a document and no longer
 * a draft; `undefined` when the index did not parse, has no `entries` array, or names no such draft.
 */
export function withDraftAsPublished(
  read: ContentRepoRead,
  draftPath: string,
): DraftAsPublished | undefined {
  if (!read.index.parsed) return undefined
  const value = read.index.value
  if (!isRecord(value)) return undefined
  const entries = value.entries
  if (!isUnknownArray(entries)) return undefined

  const draft = read.drafts.find((candidate) => candidate.path === draftPath)
  if (draft === undefined) return undefined

  const file = draftPath.startsWith(NEWS_PREFIX) ? draftPath.slice(NEWS_PREFIX.length) : draftPath

  return {
    read: {
      ...read,
      index: {
        ...read.index,
        value: { ...value, entries: [...entries, { id: draftPath, file }] },
      },
      documents: { ...read.documents, [file]: { text: draft.text } },
      drafts: read.drafts.filter((candidate) => candidate !== draft),
    },
    entryId: draftPath,
  }
}
