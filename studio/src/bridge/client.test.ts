import { expect, test, vi } from 'vitest'
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { addNewsImage, createBridgeClient } from './client'

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

test('writeBatch posts { files } to the write-batch route and answers the written paths', async () => {
  const fetchImpl = vi.fn(
    () => new Response(JSON.stringify({ written: ['news/a.md', 'news/index.json'] })),
  )
  const client = createBridgeClient(fetchImpl as unknown as typeof fetch)
  const files = [{ path: 'news/index.json', text: '{}\n', expected: null }]

  expect(await client.writeBatch(files)).toEqual({
    ok: true,
    written: ['news/a.md', 'news/index.json'],
  })
  expect(fetchImpl).toHaveBeenCalledWith('/__studio/fs/write-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files }),
  })
})

test('writeBatch resolves a 500 to failed with the written paths, a bare 403 to refused', async () => {
  const failure = {
    error: 'news/index.json: EIO',
    written: ['news/a.md'],
    failed: 'news/index.json',
  }
  const failing = createBridgeClient(
    vi.fn(() => new Response(JSON.stringify(failure), { status: 500 })) as unknown as typeof fetch,
  )
  expect(await failing.writeBatch([])).toEqual({
    ok: false,
    kind: 'failed',
    status: 500,
    ...failure,
  })

  const guarded = createBridgeClient(
    vi.fn(() => new Response('not json', { status: 403 })) as unknown as typeof fetch,
  )
  expect(await guarded.writeBatch([])).toEqual({
    ok: false,
    kind: 'refused',
    status: 403,
    error: 'HTTP 403',
    refused: [],
  })
})

test('addNewsImage posts the raw bytes as octet-stream and answers the image field value', async () => {
  const fetchImpl = vi.fn(
    () =>
      new Response(JSON.stringify({ path: 'news/img/a b.png', image: 'img/a b.png' }), {
        status: 201,
      }),
  )
  const bytes = new Blob([new Uint8Array([1, 2, 3])])

  const result = await addNewsImage('a b.png', bytes, fetchImpl as unknown as typeof fetch)

  expect(result).toEqual({ ok: true, image: 'img/a b.png' })
  expect(fetchImpl).toHaveBeenCalledWith('/__studio/fs/image?name=a%20b.png', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: bytes,
  })
})

test('addNewsImage resolves a refusal to its rule and error', async () => {
  const fetchImpl = vi.fn(
    () =>
      new Response(
        JSON.stringify({ error: 'exists: news/img/a.png already exists', rule: 'exists' }),
        {
          status: 409,
        },
      ),
  )

  const result = await addNewsImage('a.png', new Blob([]), fetchImpl as unknown as typeof fetch)

  expect(result).toEqual({
    ok: false,
    rule: 'exists',
    error: 'exists: news/img/a.png already exists',
  })
})

test('addNewsImage resolves a fetch rejection to the network rule without throwing', async () => {
  const fetchImpl = vi.fn(() => {
    throw new Error('network down')
  })

  const result = await addNewsImage('a.png', new Blob([]), fetchImpl)

  expect(result).toEqual({ ok: false, rule: 'network', error: 'network down' })
})

test('addNewsImage resolves an answer without a rule to the http rule', async () => {
  const fetchImpl = vi.fn(() => new Response('not json', { status: 403 }))

  const result = await addNewsImage('a.png', new Blob([]), fetchImpl as unknown as typeof fetch)

  expect(result).toEqual({ ok: false, rule: 'http', error: 'HTTP 403' })
})
