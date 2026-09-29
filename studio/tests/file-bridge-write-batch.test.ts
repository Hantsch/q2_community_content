/**
 * Story 027 D2: `POST /__studio/fs/write-batch` on the local file bridge. Same harness as
 * `file-bridge-write.test.ts` (a real `node:http` server over a tmp root, raw requests so `Origin`,
 * `Host` and `Content-Type` are fully under the test's control).
 *
 * `renameSync` is wrapped (delegating to the real one) so the tests can observe the order in which
 * targets land on disk and inject an I/O failure on a chosen target, part-way through a batch.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import type { BridgeWriteItem } from '../src/bridge/bridge-protocol'
import { createBridgeClient } from '../src/bridge/client'
import { createFileBridge } from '../src/bridge/create-file-bridge'
import * as imageRules from '../src/contract/launcher-safe-names'

const fsControl = vi.hoisted(() => ({
  renamed: [] as string[],
  failOn: undefined as string | undefined,
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    renameSync: (from: string, to: string) => {
      if (fsControl.failOn !== undefined && basename(to) === fsControl.failOn) {
        throw new Error('injected rename failure')
      }
      actual.renameSync(from, to)
      fsControl.renamed.push(basename(to))
    },
  }
})

const ORIGIN = 'http://localhost:5173'
const INDEX = '{"entries":["a","b"]}\n'

interface RawResponse {
  readonly status: number
  readonly json: Record<string, unknown>
}

function rawRequest(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<RawResponse> {
  const url = new URL(path, baseUrl)
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpRequest(
      { hostname: url.hostname, port: url.port, path: url.pathname, method, headers },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () =>
          resolvePromise({
            status: res.statusCode ?? 0,
            json: data === '' ? {} : (JSON.parse(data) as Record<string, unknown>),
          }),
        )
      },
    )
    req.on('error', rejectPromise)
    req.end(body)
  })
}

let root: string
let server: Server
let baseUrl: string

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'q2-bridge-batch-'))
  const middleware = createFileBridge({
    repoRoot: root,
    directories: ['news', 'engines'],
    writableDirectories: ['news'],
    imageRules,
  })
  server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('{}')
    })
  })
  await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
  rmSync(root, { recursive: true, force: true })
})

beforeEach(() => {
  fsControl.renamed.length = 0
  fsControl.failOn = undefined
  for (const entry of readdirSync(root)) {
    rmSync(join(root, entry), { recursive: true, force: true })
  }
  mkdirSync(join(root, 'news', 'img'), { recursive: true })
  mkdirSync(join(root, 'news', '_templates', 'text'), { recursive: true })
  mkdirSync(join(root, 'engines'), { recursive: true })
  writeFileSync(join(root, 'README.md'), 'readme\n')
  writeFileSync(join(root, 'engines', 'manifest.json'), '{}\n')
  writeFileSync(join(root, 'news', 'index.json'), INDEX)
  writeFileSync(join(root, 'news', 'a.md'), 'old a\n')
  writeFileSync(join(root, 'news', 'b.md'), 'old b\n')
  writeFileSync(join(root, 'news', 'img', 'a.png'), 'png')
  writeFileSync(join(root, 'news', '_templates', 'text', 'template.md'), 'tpl\n')
})

const TRACKED = [
  'README.md',
  'engines/manifest.json',
  'news/index.json',
  'news/a.md',
  'news/b.md',
  'news/img/a.png',
  'news/_templates/text/template.md',
]

/** Every tracked file's bytes plus the full `news/` listing, so a stray temp file shows up too. */
function snapshot(): string {
  const bytes = TRACKED.map((path) => readFileSync(join(root, path)).toString('base64'))
  return JSON.stringify([bytes, readdirSync(join(root, 'news')).sort()])
}

function postBatch(files: readonly BridgeWriteItem[], headers: Record<string, string> = {}) {
  return rawRequest(
    'POST',
    '/__studio/fs/write-batch',
    { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    JSON.stringify({ files }),
  )
}

const reorderBatch = (): BridgeWriteItem[] => [
  { path: 'news/index.json', text: '{"entries":["b","a"]}\n', expected: INDEX },
  { path: 'news/b.md', text: 'new b\n', expected: 'old b\n' },
  { path: 'news/a.md', text: 'new a\n', expected: 'old a\n' },
]

describe('file bridge write-batch route', () => {
  test('a valid batch writes every file and reports them .md first, index.json last', async () => {
    const response = await postBatch(reorderBatch())
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ written: ['news/b.md', 'news/a.md', 'news/index.json'] })
    expect(readFileSync(join(root, 'news', 'index.json'), 'utf8')).toBe('{"entries":["b","a"]}\n')
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('new a\n')
    expect(readFileSync(join(root, 'news', 'b.md'), 'utf8')).toBe('new b\n')
    expect(readdirSync(join(root, 'news')).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  test('write order: every .md lands on disk before index.json, whatever the request order', async () => {
    expect((await postBatch(reorderBatch())).status).toBe(200)
    expect(fsControl.renamed).toEqual(['b.md', 'a.md', 'index.json'])
  })

  test('a conflict on the last file leaves every file byte-identical', async () => {
    const before = snapshot()
    const files = reorderBatch()
    // The index is listed first but written last; make it the one that is stale.
    files[0] = { path: 'news/index.json', text: '{}\n', expected: '{"entries":[]}\n' }
    const response = await postBatch(files)
    expect(response.status).toBe(409)
    expect(response.json.conflicts).toEqual([{ path: 'news/index.json', current: INDEX }])
    expect(snapshot()).toBe(before)
    expect(fsControl.renamed).toEqual([])
  })

  test('a 409 names every conflicting path, not just the first', async () => {
    const before = snapshot()
    const response = await postBatch([
      { path: 'news/a.md', text: 'x\n', expected: 'stale a\n' },
      { path: 'news/b.md', text: 'x\n', expected: 'old b\n' },
      { path: 'news/index.json', text: '{}\n', expected: 'stale\n' },
    ])
    expect(response.status).toBe(409)
    expect(response.json.conflicts).toEqual([
      { path: 'news/a.md', current: 'old a\n' },
      { path: 'news/index.json', current: INDEX },
    ])
    expect(String(response.json.error)).toContain('news/a.md')
    expect(String(response.json.error)).toContain('news/index.json')
    expect(snapshot()).toBe(before)
  })

  test('a path outside news/ refuses the whole batch and names every offender', async () => {
    const before = snapshot()
    const response = await postBatch([
      { path: 'news/a.md', text: 'x\n', expected: 'old a\n' },
      { path: 'README.md', text: 'pwned\n', expected: 'readme\n' },
      { path: 'news/../engines/manifest.json', text: 'pwned\n', expected: '{}\n' },
      { path: 'news/index.json', text: '{}\n', expected: INDEX },
    ])
    expect(response.status).toBe(403)
    const refused = (response.json.refused as { path: string }[]).map(({ path }) => path)
    expect(refused).toEqual(['README.md', 'news/../engines/manifest.json'])
    expect(snapshot()).toBe(before)
    expect(fsControl.renamed).toEqual([])
  })

  test('every refused path shape of the single-file route also refuses a batch', async () => {
    const before = snapshot()
    const paths = [
      'studio/x.md',
      'news/img/a.png',
      'news/_templates/text/template.md',
      'news/notes.txt',
      'news/x.json',
      join(root, 'news', 'a.md'),
      'C:/Windows/x.md',
      '\\\\server\\share\\x.md',
      '//server/share/x.md',
    ]
    for (const path of paths) {
      const response = await postBatch([
        { path: 'news/a.md', text: 'x\n', expected: 'old a\n' },
        { path, text: 'pwned\n', expected: existsSync(join(root, path)) ? '' : null },
      ])
      expect(response.status, path).toBe(403)
      expect(response.json.refused, path).toEqual([{ path, error: expect.any(String) as string }])
    }
    expect(snapshot()).toBe(before)
    expect(existsSync(join(root, 'news', 'notes.txt'))).toBe(false)
  })

  test('a symlink or junction escaping news/ refuses the batch', async (context) => {
    const outside = mkdtempSync(join(tmpdir(), 'q2-bridge-batch-outside-'))
    try {
      try {
        symlinkSync(outside, join(root, 'news', 'link'), 'junction')
      } catch {
        context.skip()
        return
      }
      const response = await postBatch([
        { path: 'news/a.md', text: 'x\n', expected: 'old a\n' },
        { path: 'news/link/x.md', text: 'pwned\n', expected: null },
      ])
      expect(response.status).toBe(403)
      expect(readdirSync(outside)).toEqual([])
      expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('an empty batch and a duplicate path are refused with 400, nothing written', async () => {
    const before = snapshot()
    const empty = await postBatch([])
    expect(empty.status).toBe(400)
    expect(empty.json.refused).toEqual([])

    const duplicate = await postBatch([
      { path: 'news/a.md', text: 'x\n', expected: 'old a\n' },
      { path: 'news/b.md', text: 'x\n', expected: 'old b\n' },
      { path: 'news/a.md', text: 'y\n', expected: 'old a\n' },
    ])
    expect(duplicate.status).toBe(400)
    expect(duplicate.json.refused).toEqual([
      { path: 'news/a.md', error: expect.stringContaining('more than once') as string },
    ])
    expect(snapshot()).toBe(before)
  })

  test('the request guards of the single-file route refuse a batch before anything is read', async () => {
    const before = snapshot()
    const files = reorderBatch()
    const body = JSON.stringify({ files })

    const foreign = await postBatch(files, { Origin: 'https://evil.example' })
    expect(foreign.status).toBe(403)
    const missingOrigin = await rawRequest(
      'POST',
      '/__studio/fs/write-batch',
      { 'Content-Type': 'application/json' },
      body,
    )
    expect(missingOrigin.status).toBe(403)
    const foreignHost = await postBatch(files, { Host: 'evil.example' })
    expect(foreignHost.status).toBe(403)
    const wrongType = await postBatch(files, { 'Content-Type': 'text/plain' })
    expect(wrongType.status).toBe(415)
    const huge = await postBatch([
      { path: 'news/a.md', text: 'x'.repeat(1024 * 1024), expected: 'old a\n' },
    ])
    expect(huge.status).toBe(413)
    const wrongShape = await rawRequest(
      'POST',
      '/__studio/fs/write-batch',
      { Origin: ORIGIN, 'Content-Type': 'application/json' },
      JSON.stringify({ writes: files }),
    )
    expect(wrongShape.status).toBe(400)
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']) {
      const response = await rawRequest(method, '/__studio/fs/write-batch', { Origin: ORIGIN })
      expect(response.status, method).toBe(405)
    }
    expect(snapshot()).toBe(before)
  })

  test('an I/O failure on index.json answers 500 after the .md files, index untouched', async () => {
    fsControl.failOn = 'index.json'
    const indexBefore = readFileSync(join(root, 'news', 'index.json'))
    const response = await postBatch(reorderBatch())
    expect(response.status).toBe(500)
    expect(response.json).toMatchObject({
      written: ['news/b.md', 'news/a.md'],
      failed: 'news/index.json',
    })
    expect(readFileSync(join(root, 'news', 'index.json')).equals(indexBefore)).toBe(true)
    expect(readdirSync(join(root, 'news')).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  test('an I/O failure on a .md answers 500 listing what was written; index.json never written', async () => {
    fsControl.failOn = 'a.md'
    const indexBefore = readFileSync(join(root, 'news', 'index.json'))
    const response = await postBatch(reorderBatch())
    expect(response.status).toBe(500)
    expect(response.json).toMatchObject({ written: ['news/b.md'], failed: 'news/a.md' })
    expect(readFileSync(join(root, 'news', 'b.md'), 'utf8')).toBe('new b\n')
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
    expect(readFileSync(join(root, 'news', 'index.json')).equals(indexBefore)).toBe(true)
  })

  test('the client writeBatch() resolves ok, conflict, refused and failed without throwing', async () => {
    const client = createBridgeClient((input, init) =>
      fetch(`${baseUrl}${input as string}`, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN },
      }),
    )
    expect(await client.writeBatch(reorderBatch())).toEqual({
      ok: true,
      written: ['news/b.md', 'news/a.md', 'news/index.json'],
    })
    expect(await client.writeBatch(reorderBatch())).toMatchObject({
      ok: false,
      kind: 'conflict',
      status: 409,
      conflicts: [
        { path: 'news/b.md', current: 'new b\n' },
        { path: 'news/a.md', current: 'new a\n' },
        { path: 'news/index.json', current: '{"entries":["b","a"]}\n' },
      ],
    })
    expect(
      await client.writeBatch([{ path: 'README.md', text: 'x\n', expected: 'readme\n' }]),
    ).toMatchObject({ ok: false, kind: 'refused', status: 403, refused: [{ path: 'README.md' }] })

    fsControl.failOn = 'a.md'
    const failed = await client.writeBatch([
      { path: 'news/a.md', text: 'z\n', expected: 'new a\n' },
    ])
    expect(failed).toMatchObject({ ok: false, kind: 'failed', status: 500, written: [] })

    const offline = createBridgeClient(() => Promise.reject(new Error('down')))
    expect(await offline.writeBatch([])).toEqual({
      ok: false,
      kind: 'failed',
      status: 0,
      error: 'down',
      written: [],
    })
  })
})
