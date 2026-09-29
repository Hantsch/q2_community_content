import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { readContentRepo } from '../content-repo/read-content-repo'
import { parseFrontmatter } from '../contract/launcher-contract'
import { buildWriteSet, type WriteSet } from './apply-plan'
import { buildOrderSequence, planMove } from './order-plan'
import { planPublish, planUnpublish } from './publish-plan'

const read = readContentRepo({
  repoRoot: fileURLToPath(new URL('../../e2e/fixtures/reorder-publish-tree/', import.meta.url)),
})

function filesOf(set: WriteSet) {
  if (!set.ok) throw new Error(set.reason)
  return set.files
}

function indexRows(text: string): { file: string; order?: number }[] {
  return (JSON.parse(text) as { entries: { file: string; order?: number }[] }).entries
}

function gapMove() {
  const plan = planMove(buildOrderSequence(read), 3, 1)
  if (plan.kind !== 'gap') throw new Error('expected a gap move')
  return plan
}

describe('buildWriteSet', () => {
  it("an order change writes the index row and the document's frontmatter to the same value", () => {
    const plan = gapMove()
    const files = filesOf(buildWriteSet(read, { kind: 'move', changes: plan.changes }))
    const [{ file, to }] = plan.changes
    const document = files.find((f) => f.path === `news/${file}`)
    const index = files.find((f) => f.path === 'news/index.json')
    expect(Number(parseFrontmatter(document?.text ?? '')?.data.order)).toBe(to)
    expect(indexRows(index?.text ?? '').find((row) => row.file === file)?.order).toBe(to)
  })

  it('untouched neighbours are not in the write set', () => {
    const plan = gapMove()
    const files = filesOf(buildWriteSet(read, { kind: 'move', changes: plan.changes }))
    expect(files.map((f) => f.path).sort()).toEqual(
      [`news/${plan.changes[0].file}`, 'news/index.json'].sort(),
    )
  })

  it('every file is guarded by the text of the read the plan came from', () => {
    const plan = gapMove()
    const files = filesOf(buildWriteSet(read, { kind: 'move', changes: plan.changes }))
    expect(files.find((f) => f.path === 'news/index.json')?.expected).toBe(read.index.text)
    expect(files.find((f) => f.path !== 'news/index.json')?.expected).toBe(
      read.documents[plan.changes[0].file].text,
    )
  })

  it("publish appends the row with id/file/order and sets the draft's order", () => {
    const draftPath = 'news/2026-09-20-draft-ok.md'
    const plan = planPublish(read, draftPath, new Date('2026-09-25T00:00:00Z'))
    const files = filesOf(buildWriteSet(read, { kind: 'publish', draftPath, plan }))
    const rows = indexRows(files.find((f) => f.path === 'news/index.json')?.text ?? '')
    expect(rows.at(-1)).toEqual({
      id: plan.row.id,
      file: plan.row.file,
      order: plan.frontmatterOrder,
    })
    expect(rows).toHaveLength(indexRows(read.index.text).length + 1)
    const draft = files.find((f) => f.path === draftPath)
    expect(Number(parseFrontmatter(draft?.text ?? '')?.data.order)).toBe(plan.frontmatterOrder)
  })

  it('unpublish write set contains only news/index.json', () => {
    const plan = planUnpublish(read, 1, 'b')
    if (plan.kind !== 'remove') throw new Error('expected a removal')
    const files = filesOf(buildWriteSet(read, { kind: 'unpublish', plan }))
    expect(files.map((f) => f.path)).toEqual(['news/index.json'])
    expect(indexRows(files[0].text).map((row) => row.file)).toEqual(
      indexRows(read.index.text)
        .map((row) => row.file)
        .filter((file) => file !== plan.row.file),
    )
  })
})
