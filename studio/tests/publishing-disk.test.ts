/**
 * Story 027 D3, AC7: after each operation the report's delivered order equals the mirrored
 * pipeline's over the files on disk. Real bridge, real batch client, a tmp copy of the fixture.
 */
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { createBridgeClient } from '../src/bridge/client'
import { createFileBridge } from '../src/bridge/create-file-bridge'
import { readContentRepo, type ContentRepoRead } from '../src/content-repo/read-content-repo'
import { buildFeed, parseFrontmatter } from '../src/contract/launcher-contract'
import * as imageRules from '../src/contract/launcher-safe-names'
import { buildWriteSet, type ApplyPlan } from '../src/publishing/apply-plan'
import { buildOrderSequence, planMove } from '../src/publishing/order-plan'
import { planPublish, planUnpublish } from '../src/publishing/publish-plan'
import { buildNewsReport } from '../src/report/build-news-report'

const ORIGIN = 'http://localhost:5173'
const NOW = new Date('2026-09-25T00:00:00Z')

let root: string
let server: Server
let baseUrl: string

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'q2-publishing-'))
  cpSync(
    join(__dirname, '..', 'e2e', 'fixtures', 'reorder-publish-tree', 'news'),
    join(root, 'news'),
    { recursive: true },
  )
  const middleware = createFileBridge({
    repoRoot: root,
    directories: ['news'],
    writableDirectories: ['news'],
    imageRules,
  })
  server = createServer((req, res) =>
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('{}')
    }),
  )
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((done) => server.close(() => done()))
  rmSync(root, { recursive: true, force: true })
})

const client = () =>
  createBridgeClient((input, init) =>
    fetch(`${baseUrl}${input as string}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN },
    }),
  )

function documentsOf(read: ContentRepoRead): Record<string, string> {
  return Object.fromEntries(Object.entries(read.documents).map(([file, { text }]) => [file, text]))
}

async function apply(read: ContentRepoRead, plan: ApplyPlan): Promise<ContentRepoRead> {
  const set = buildWriteSet(read, plan)
  if (!set.ok) throw new Error(set.reason)
  expect(await client().writeBatch(set.files)).toMatchObject({ ok: true })
  return readContentRepo({ repoRoot: root })
}

/** Ids by the report's delivered position, the mirrored feed's ids, and whether both order sources agree. */
function check(read: ContentRepoRead) {
  const index = read.index.value
  const documents = documentsOf(read)
  const report = buildNewsReport({ index, documents, now: NOW })
  const reported = report.entries
    .flatMap((entry) =>
      entry.delivered !== 'dropped' && entry.delivered.position !== undefined
        ? [{ id: entry.id, position: entry.delivered.position }]
        : [],
    )
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.id)
  const feed = buildFeed({ index, documents, now: NOW }).slides.map((slide) => slide.id)
  const rows = (index as { entries: { file: string; order?: number }[] }).entries
  const agree = rows.every(
    (row) => Number(parseFrontmatter(documents[row.file])?.data.order) === row.order,
  )
  return { reported, feed, agree }
}

describe('publishing over the real bridge', () => {
  test("after each operation the report's delivered order equals the mirrored pipeline's over the files on disk", async () => {
    let read = readContentRepo({ repoRoot: root })

    const gap = planMove(buildOrderSequence(read), 3, 1)
    expect(gap.kind).toBe('gap')
    if (gap.kind === 'none') return
    read = await apply(read, { kind: 'move', changes: gap.changes })
    let state = check(read)
    expect(state.reported).toEqual(state.feed)
    expect(state.feed).toEqual(['a', 'd', 'b', 'c'])
    expect(state.agree).toBe(true)

    const renumber = planMove(buildOrderSequence(read), 0, 2)
    expect(renumber.kind).toBe('renumber')
    if (renumber.kind === 'none') return
    read = await apply(read, { kind: 'move', changes: renumber.changes })
    state = check(read)
    expect(state.reported).toEqual(state.feed)
    expect(state.feed).toEqual(['d', 'b', 'a', 'c'])
    expect(state.agree).toBe(true)

    const draftPath = 'news/2026-09-20-draft-ok.md'
    const publish = planPublish(read, draftPath, NOW)
    expect(publish.verdict).toBe('ok')
    read = await apply(read, { kind: 'publish', draftPath, plan: publish })
    state = check(read)
    expect(state.reported).toEqual(state.feed)
    expect(state.feed.at(-1)).toBe(publish.row.id)
    expect(state.agree).toBe(true)

    const unpublish = planUnpublish(read, 0, 'a')
    if (unpublish.kind !== 'remove') throw new Error('expected a removal')
    read = await apply(read, { kind: 'unpublish', plan: unpublish })
    state = check(read)
    expect(state.reported).toEqual(state.feed)
    expect(state.feed).not.toContain('a')
    expect(state.agree).toBe(true)
    expect(read.drafts.map((d) => d.path)).toContain('news/2026-09-01-a.md')
  })
})
