import { expect, test, vi } from 'vitest'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { createBridgeClient } from './client'

const CANNED_READ: ContentRepoRead = {
  repoRoot: '/repo',
  index: { text: '{"entries":[]}', value: { entries: [] }, parsed: true },
  documents: {},
  drafts: [],
  images: [],
  findings: [],
}

test('a successful read returns the parsed BridgeReadResponse verbatim', async () => {
  const fetchImpl = vi.fn(() => new Response(JSON.stringify(CANNED_READ), { status: 200 }))
  const client = createBridgeClient(fetchImpl as unknown as typeof fetch)

  const read = await client.read('news')

  expect(read).toEqual(CANNED_READ)
  expect(fetchImpl).toHaveBeenCalledWith('/__studio/fs/read?type=news')
})

test('a non-2xx response falls back to a well-formed empty read naming the error', async () => {
  const fetchImpl = vi.fn(
    () =>
      new Response(JSON.stringify({ error: 'news: not a declared directory' }), { status: 404 }),
  )
  const client = createBridgeClient(fetchImpl as unknown as typeof fetch)

  const read = await client.read('news')

  expect(read.repoRoot).toBe('')
  expect(read.documents).toEqual({})
  expect(read.drafts).toEqual([])
  expect(read.images).toEqual([])
  expect(read.findings).toHaveLength(1)
  expect(read.findings[0].severity).toBe('error')
  expect(read.findings[0].message).toContain('news: not a declared directory')
})

test('a fetch rejection falls back to a well-formed empty read without throwing', async () => {
  const fetchImpl = vi.fn(() => {
    throw new Error('network down')
  })
  const client = createBridgeClient(fetchImpl)

  const read = await client.read('news')

  expect(read.repoRoot).toBe('')
  expect(read.documents).toEqual({})
  expect(read.drafts).toEqual([])
  expect(read.images).toEqual([])
  expect(read.findings).toHaveLength(1)
  expect(read.findings[0].severity).toBe('error')
  expect(read.findings[0].message).toContain('network down')
})
