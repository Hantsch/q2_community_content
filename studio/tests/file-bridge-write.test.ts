/**
 * Story 024, D4: `POST /__studio/fs/write` on the local file bridge. Like the read-route tests,
 * every case drives `createFileBridge` over a real `node:http` server; requests are sent with a raw
 * `node:http` client so `Origin` and `Content-Type` are fully under the test's control.
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
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it, test } from 'vitest'

import type { BridgeWriteItem } from '../src/bridge/bridge-protocol'
import { createBridgeClient } from '../src/bridge/client'
import { createFileBridge } from '../src/bridge/create-file-bridge'
import * as imageRules from '../src/contract/launcher-safe-names'

const ORIGIN = 'http://localhost:5173'

interface RawResponse {
  readonly status: number
  readonly json: Record<string, unknown>
}

function rawRequest(
  baseUrl: string,
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
  root = mkdtempSync(join(tmpdir(), 'q2-bridge-write-'))
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
  for (const entry of readdirSync(root)) {
    rmSync(join(root, entry), { recursive: true, force: true })
  }
  mkdirSync(join(root, 'news', 'img'), { recursive: true })
  mkdirSync(join(root, 'news', '_templates', 'text'), { recursive: true })
  mkdirSync(join(root, 'engines'), { recursive: true })
  mkdirSync(join(root, 'studio'), { recursive: true })
  writeFileSync(join(root, 'README.md'), 'readme\n')
  writeFileSync(join(root, 'engines', 'manifest.json'), '{}\n')
  writeFileSync(join(root, 'news', 'a.md'), 'old a\n')
  writeFileSync(join(root, 'news', 'b.md'), 'old b\n')
  writeFileSync(join(root, 'news', 'img', 'a.png'), 'png')
  writeFileSync(join(root, 'news', '_templates', 'text', 'template.md'), 'tpl\n')
})

function post(writes: readonly BridgeWriteItem[], headers: Record<string, string> = {}) {
  return rawRequest(
    baseUrl,
    'POST',
    '/__studio/fs/write',
    { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    JSON.stringify({ writes }),
  )
}

describe('file bridge write route', () => {
  test('a write replaces the file and reports the written paths', async () => {
    const response = await post([{ path: 'news/a.md', text: 'new a\n', expected: 'old a\n' }])
    expect(response.status).toBe(200)
    expect(response.json).toEqual({ written: ['news/a.md'] })
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('new a\n')
    expect(readdirSync(join(root, 'news')).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  test('expected null creates a new file and refuses an existing one', async () => {
    const created = await post([{ path: 'news/c.md', text: 'c\n', expected: null }])
    expect(created.status).toBe(200)
    expect(readFileSync(join(root, 'news', 'c.md'), 'utf8')).toBe('c\n')

    const existing = await post([{ path: 'news/a.md', text: 'x\n', expected: null }])
    expect(existing.status).toBe(409)
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
  })

  test('a stale expected text is refused with 409 and nothing is written', async () => {
    const response = await post([{ path: 'news/a.md', text: 'new a\n', expected: 'stale\n' }])
    expect(response.status).toBe(409)
    expect(response.json).toEqual({
      error: expect.any(String) as string,
      path: 'news/a.md',
      current: 'old a\n',
    })
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
  })

  test('a two-file write with one conflict writes neither', async () => {
    const response = await post([
      { path: 'news/a.md', text: 'new a\n', expected: 'old a\n' },
      { path: 'news/b.md', text: 'new b\n', expected: 'stale\n' },
    ])
    expect(response.status).toBe(409)
    expect(response.json.path).toBe('news/b.md')
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
    expect(readFileSync(join(root, 'news', 'b.md'), 'utf8')).toBe('old b\n')
  })

  test('a CRLF file with a BOM keeps both after a write', async () => {
    writeFileSync(join(root, 'news', 'a.md'), '\uFEFFline1\r\nline2\r\n')
    const response = await post([
      { path: 'news/a.md', text: 'line1\nchanged\n', expected: 'line1\nline2\n' },
    ])
    expect(response.status).toBe(200)
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('\uFEFFline1\r\nchanged\r\n')
  })

  test('paths outside the writable directory are refused', async () => {
    const before = (): string =>
      JSON.stringify(
        [
          'README.md',
          'engines/manifest.json',
          'news/a.md',
          'news/img/a.png',
          'news/_templates/text/template.md',
        ].map((path) => readFileSync(join(root, path), 'utf8')),
      )
    const snapshot = before()
    const paths = [
      'README.md',
      'studio/x.md',
      'engines/manifest.json',
      'news/../README.md',
      'news/img/a.png',
      'news/_templates/text/template.md',
      'news/notes.txt',
      join(root, 'news', 'a.md'),
      'C:/Windows/x.md',
      'C:\\Windows\\x.md',
      '\\\\server\\share\\x.md',
      '//server/share/x.md',
    ]
    for (const path of paths) {
      const existing = existsSync(join(root, path))
      const response = await post([{ path, text: 'pwned\n', expected: existing ? '' : null }])
      expect(response.status, path).toBe(403)
    }
    expect(before()).toBe(snapshot)
    expect(existsSync(join(root, 'studio', 'x.md'))).toBe(false)
    expect(existsSync(join(root, 'news', 'notes.txt'))).toBe(false)
  })

  test('a symlink or junction that escapes the writable directory is refused', async (context) => {
    const outside = mkdtempSync(join(tmpdir(), 'q2-bridge-outside-'))
    try {
      try {
        symlinkSync(outside, join(root, 'news', 'link'), 'junction')
      } catch {
        context.skip()
        return
      }
      for (const expected of [null, '']) {
        const response = await post([{ path: 'news/link/x.md', text: 'pwned\n', expected }])
        expect(response.status).toBe(403)
      }
      expect(readdirSync(outside)).toEqual([])
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })

  test('GET and other methods on the write route answer 405', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']) {
      const response = await rawRequest(baseUrl, method, '/__studio/fs/write', { Origin: ORIGIN })
      expect(response.status, method).toBe(405)
    }
    // POST stays refused on the read routes.
    const readPost = await rawRequest(baseUrl, 'POST', '/__studio/fs/read?type=news', {
      Origin: ORIGIN,
    })
    expect(readPost.status).toBe(405)
  })

  test('a missing or foreign Origin is refused with 403', async () => {
    const body = JSON.stringify({
      writes: [{ path: 'news/a.md', text: 'x\n', expected: 'old a\n' }],
    })
    const missing = await rawRequest(
      baseUrl,
      'POST',
      '/__studio/fs/write',
      { 'Content-Type': 'application/json' },
      body,
    )
    expect(missing.status).toBe(403)
    const foreign = await post([{ path: 'news/a.md', text: 'x\n', expected: 'old a\n' }], {
      Origin: 'https://evil.example',
    })
    expect(foreign.status).toBe(403)
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
  })

  test('a non-JSON content type is refused with 415 and an oversized body with 413', async () => {
    const wrongType = await post([], { 'Content-Type': 'text/plain' })
    expect(wrongType.status).toBe(415)

    const huge = await post([
      { path: 'news/a.md', text: 'x'.repeat(1024 * 1024), expected: 'old a\n' },
    ])
    expect(huge.status).toBe(413)
    expect(readFileSync(join(root, 'news', 'a.md'), 'utf8')).toBe('old a\n')
  })

  it('the client write() resolves ok, conflict and network failure without throwing', async () => {
    const client = createBridgeClient((input, init) =>
      fetch(`${baseUrl}${input as string}`, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN },
      }),
    )
    expect(await client.write([{ path: 'news/a.md', text: 'n\n', expected: 'old a\n' }])).toEqual({
      ok: true,
      written: ['news/a.md'],
    })
    const conflict = await client.write([{ path: 'news/a.md', text: 'm\n', expected: 'old a\n' }])
    expect(conflict).toMatchObject({ ok: false, status: 409, path: 'news/a.md', current: 'n\n' })

    const offline = createBridgeClient(() => Promise.reject(new Error('down')))
    expect(await offline.write([])).toEqual({ ok: false, status: 0, error: 'down' })
  })

  function create(path: string, text: string) {
    return rawRequest(
      baseUrl,
      'POST',
      '/__studio/fs/write',
      { Origin: ORIGIN, 'Content-Type': 'application/json' },
      JSON.stringify({ writes: [{ path, text, expected: null }], createOnly: true }),
    )
  }

  test('create-only writes a new file under news/', async () => {
    const response = await create('news/new.md', 'new\n')
    expect(response.status).toBe(200)
    expect(readFileSync(join(root, 'news', 'new.md'), 'utf8')).toBe('new\n')
    expect(readdirSync(join(root, 'news')).sort()).toEqual([
      '_templates',
      'a.md',
      'b.md',
      'img',
      'new.md',
    ])
  })

  test('create-only refuses an existing file and leaves it byte-identical', async () => {
    const before = readFileSync(join(root, 'news', 'a.md'))
    const response = await create('news/a.md', 'overwritten\n')
    expect(response.status).toBe(409)
    expect(String(response.json.error)).toContain('news/a.md')
    expect(readFileSync(join(root, 'news', 'a.md')).equals(before)).toBe(true)
  })

  test('create-only refuses a path outside the declared directories', async () => {
    for (const path of ['engines/x.md', 'README.md', 'news/../studio/x.md', 'news/missing/x.md']) {
      const response = await create(path, 'x\n')
      expect(response.status, path).toBeGreaterThanOrEqual(400)
    }
    expect(existsSync(join(root, 'engines', 'x.md'))).toBe(false)
    expect(existsSync(join(root, 'studio', 'x.md'))).toBe(false)
    expect(existsSync(join(root, 'news', 'missing'))).toBe(false)
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('readme\n')
  })

  test('create-only leaves index.json byte-identical', async () => {
    const index = '{"entries":[]}' + String.fromCharCode(13, 10)
    writeFileSync(join(root, 'news', 'index.json'), index)
    const before = readFileSync(join(root, 'news', 'index.json'))
    expect((await create('news/new.md', 'new\n')).status).toBe(200)
    expect((await create('news/index.json', '{}\n')).status).toBe(409)
    expect(readFileSync(join(root, 'news', 'index.json')).equals(before)).toBe(true)
  })

  it('the client createFile() resolves ok, conflict and network failure without throwing', async () => {
    const client = createBridgeClient((input, init) =>
      fetch(`${baseUrl}${input as string}`, {
        ...init,
        headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN },
      }),
    )
    expect(await client.createFile('news/n.md', 'n\n')).toEqual({ ok: true })
    expect(await client.createFile('news/n.md', 'm\n')).toMatchObject({ ok: false, status: 409 })
    expect(readFileSync(join(root, 'news', 'n.md'), 'utf8')).toBe('n\n')
    const offline = createBridgeClient(() => Promise.reject(new Error('down')))
    expect(await offline.createFile('news/n.md', 'x')).toEqual({
      ok: false,
      status: 0,
      message: 'down',
    })
  })
})
