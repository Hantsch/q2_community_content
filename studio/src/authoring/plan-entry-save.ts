/**
 * Plans the writes of one entry save and asks the launcher's own pipeline whether the saved
 * state would still be delivered. Pure and browser-safe: it reads only the texts it is given.
 */
import { parseFrontmatter, resolveFeed } from '../contract/launcher-contract'
import { writeEntryDocument, type EntryPatch } from './write-entry-document'
import { writeNewsIndex } from './write-news-index'

export interface PlannedWrite {
  path: string
  text: string
  /** The text the file had when it was opened, for the bridge's conflict check. */
  expected: string
}

export interface EntrySavePlanInput {
  /** Repo-relative, e.g. `news/2026-09-10-x.md`. */
  documentPath: string
  openedDocumentText: string
  patch: EntryPatch
  /** `news/index.json` as opened, or `undefined` when it could not be read. */
  openedIndexText: string | undefined
  /** The other documents' texts, keyed by the index row's `file`. */
  otherDocuments: Record<string, string>
}

export type EntrySavePlan =
  | { ok: false; reason: string }
  | { ok: true; writes: PlannedWrite[]; drop: { reason: string } | undefined }

const NEWS_DIR = 'news/'
const INDEX_PATH = 'news/index.json'

function rowsOf(index: unknown): unknown[] {
  const entries =
    typeof index === 'object' && index !== null
      ? (index as { entries?: unknown }).entries
      : undefined
  return Array.isArray(entries) ? entries : []
}

export function planEntrySave(input: EntrySavePlanInput): EntrySavePlan {
  const { documentPath, openedDocumentText, patch, openedIndexText, otherDocuments } = input
  const written = writeEntryDocument(openedDocumentText, patch)
  if (!written.ok) return written

  const writes: PlannedWrite[] = [
    { path: documentPath, text: written.text, expected: openedDocumentText },
  ]
  const file = documentPath.startsWith(NEWS_DIR)
    ? documentPath.slice(NEWS_DIR.length)
    : documentPath

  let index: unknown
  if (openedIndexText !== undefined) {
    try {
      index = JSON.parse(openedIndexText)
    } catch {
      // Whether the entry is published cannot be read; a draft has no row to protect.
      if (openedIndexText.includes(file)) {
        return {
          ok: false,
          reason: 'news/index.json is not valid JSON, so the entry cannot be saved',
        }
      }
      return { ok: true, writes, drop: undefined }
    }
  }

  const row = rowsOf(index).find(
    (item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null && (item as Record<string, unknown>).file === file,
  )
  if (row === undefined || openedIndexText === undefined)
    return { ok: true, writes, drop: undefined }

  let wouldBeIndex = index
  const rawOrder = parseFrontmatter(written.text)?.data.order
  const order = rawOrder === undefined || rawOrder.trim() === '' ? NaN : Number(rawOrder)
  if (Number.isFinite(order)) {
    const result = writeNewsIndex(openedIndexText, { file, order })
    if (result.changed) {
      writes.push({ path: INDEX_PATH, text: result.text, expected: openedIndexText })
      wouldBeIndex = JSON.parse(result.text)
    }
  }

  const feed = resolveFeed({
    index: wouldBeIndex,
    documents: { ...otherDocuments, [file]: written.text },
  })
  const id = row.id
  if (feed.slides.some((slide) => slide.id === id)) return { ok: true, writes, drop: undefined }
  const warning = feed.warnings.findLast((w) => w.file === file)
  return {
    ok: true,
    writes,
    drop: { reason: warning?.reason ?? 'the launcher would not deliver this entry' },
  }
}
