/**
 * Canonical writer for one `order` change in `news/index.json`.
 *
 * The file is parsed, the one row is edited in place (JSON.parse keeps key order, so every other
 * key of the row and of the file, unknown ones included, keeps its position) and the result is
 * serialised as `JSON.stringify(value, null, 2) + '\n'`. A row that is missing or already agrees
 * returns the input text untouched, so a no-op never rewrites the file.
 */
export interface NewsIndexChange {
  /** Row `file`, relative to `news/`, e.g. `2026-09-10-x.md`. */
  file: string
  order: number
}

export interface NewsIndexResult {
  changed: boolean
  text: string
}

/** Throws when `indexText` is not valid JSON. */
export function writeNewsIndex(indexText: string, change: NewsIndexChange): NewsIndexResult {
  const root: unknown = JSON.parse(indexText)
  const entries =
    typeof root === 'object' && root !== null ? (root as { entries?: unknown }).entries : undefined
  if (!Array.isArray(entries)) return { changed: false, text: indexText }

  const row = entries.find(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' &&
      item !== null &&
      (item as Record<string, unknown>).file === change.file,
  )
  if (row === undefined || row.order === change.order) return { changed: false, text: indexText }

  row.order = change.order
  return { changed: true, text: JSON.stringify(root, null, 2) + '\n' }
}
