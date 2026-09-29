/**
 * Story 022 D3: the raw document text of a library row, taken from the read the library was built
 * from - an index entry by its file name, a draft by its repository path (its row id).
 */
import type { ContentSourceRead } from '../content-types/descriptor'
import type { LibraryRow } from './library-types'

export function documentFor(
  read: ContentSourceRead | null,
  row: LibraryRow | undefined,
): { file: string; text: string } | undefined {
  if (!read || !row) return undefined
  if (row.status === 'draft') {
    const draft = read.drafts.find((d) => d.path === row.id)
    return draft ? { file: draft.path, text: draft.text } : undefined
  }
  const document = read.documents[row.file]
  return document ? { file: row.file, text: document.text } : undefined
}
