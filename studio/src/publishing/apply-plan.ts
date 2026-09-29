/**
 * Story 027 D3: turns a plan (D1) into the files one batch write puts on disk. Pure: no I/O.
 *
 * Every file's `expected` token is the text of the SAME read the plan was made from, so the bridge
 * refuses the whole batch when anything changed on disk since. Unpublishing touches `index.json`
 * only: the document and its images stay exactly as they are.
 */
import type { BridgeWriteItem } from '../bridge/bridge-protocol'
import { writeEntryDocument } from '../authoring/write-entry-document'
import { writeNewsIndex } from '../authoring/write-news-index'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { OrderChange } from './order-plan'
import type { PublishPlan, UnpublishPlan } from './publish-plan'

export const INDEX_PATH = 'news/index.json'
const NEWS_PREFIX = 'news/'

export type ApplyPlan =
  | { readonly kind: 'move'; readonly changes: readonly OrderChange[] }
  | { readonly kind: 'publish'; readonly draftPath: string; readonly plan: PublishPlan }
  | { readonly kind: 'unpublish'; readonly plan: Extract<UnpublishPlan, { kind: 'remove' }> }

export type WriteSet =
  | { readonly ok: true; readonly files: readonly BridgeWriteItem[] }
  | { readonly ok: false; readonly reason: string }

type IndexRoot = { entries?: unknown }

function parseIndex(read: ContentRepoRead): IndexRoot | undefined {
  if (!read.index.parsed) return undefined
  try {
    const root: unknown = JSON.parse(read.index.text)
    return typeof root === 'object' && root !== null && Array.isArray((root as IndexRoot).entries)
      ? root
      : undefined
  } catch {
    return undefined
  }
}

function serialise(root: unknown): string {
  return JSON.stringify(root, null, 2) + '\n'
}

const NO_INDEX: WriteSet = {
  ok: false,
  reason: 'news/index.json could not be read as an index, so nothing was changed',
}

function moveFiles(read: ContentRepoRead, changes: readonly OrderChange[]): WriteSet {
  if (!read.index.parsed) return NO_INDEX
  const files: BridgeWriteItem[] = []
  let indexText = read.index.text
  try {
    for (const change of changes) {
      const document = read.documents[change.file]
      if (document === undefined) {
        return { ok: false, reason: `${NEWS_PREFIX}${change.file} was not read` }
      }
      const written = writeEntryDocument(document.text, { fields: { order: String(change.to) } })
      if (!written.ok) return { ok: false, reason: `${change.file}: ${written.reason}` }
      if (written.text !== document.text) {
        files.push({
          path: `${NEWS_PREFIX}${change.file}`,
          text: written.text,
          expected: document.text,
        })
      }
      indexText = writeNewsIndex(indexText, { file: change.file, order: change.to }).text
    }
  } catch {
    return NO_INDEX
  }
  if (indexText !== read.index.text) {
    files.push({ path: INDEX_PATH, text: indexText, expected: read.index.text })
  }
  return { ok: true, files }
}

function publishFiles(read: ContentRepoRead, draftPath: string, plan: PublishPlan): WriteSet {
  const root = parseIndex(read)
  if (root === undefined) return NO_INDEX
  const draft = read.drafts.find((candidate) => candidate.path === draftPath)
  if (draft === undefined) return { ok: false, reason: `${draftPath} is not a draft under news/` }
  const written = writeEntryDocument(draft.text, {
    fields: { order: String(plan.frontmatterOrder) },
  })
  if (!written.ok) return { ok: false, reason: `${draftPath}: ${written.reason}` }

  const entries = root.entries as unknown[]
  const next = {
    ...root,
    entries: [...entries, { id: plan.row.id, file: plan.row.file, order: plan.frontmatterOrder }],
  }
  return {
    ok: true,
    files: [
      { path: draftPath, text: written.text, expected: draft.text },
      { path: INDEX_PATH, text: serialise(next), expected: read.index.text },
    ],
  }
}

function unpublishFiles(
  read: ContentRepoRead,
  plan: Extract<UnpublishPlan, { kind: 'remove' }>,
): WriteSet {
  const root = parseIndex(read)
  if (root === undefined) return NO_INDEX
  const entries = (root.entries as unknown[]).filter((_, i) => i !== plan.indexPosition)
  return {
    ok: true,
    files: [{ path: INDEX_PATH, text: serialise({ ...root, entries }), expected: read.index.text }],
  }
}

export function buildWriteSet(read: ContentRepoRead, plan: ApplyPlan): WriteSet {
  switch (plan.kind) {
    case 'move':
      return moveFiles(read, plan.changes)
    case 'publish':
      return publishFiles(read, plan.draftPath, plan.plan)
    case 'unpublish':
      return unpublishFiles(read, plan.plan)
  }
}
