/**
 * Story 015, D2: the local file bridge's HTTP surface. Every test here drives
 * `createFileBridge` over a real `node:http` server and real `fetch()` calls — the middleware's
 * whole point is to sit on the wire between the browser and the working tree, so nothing here
 * calls it as a plain function.
 */
import { execFileSync } from 'node:child_process'
import {
  type Dirent,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createServer, request as httpRequest, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, afterEach, beforeAll, describe, expect, it, test } from 'vitest'

import type {
  BridgeErrorResponse,
  BridgeFileResponse,
  BridgeProvenanceResponse,
  BridgeReadResponse,
} from '../src/bridge/bridge-protocol'
import { createFileBridge } from '../src/bridge/create-file-bridge'
import { readContentRepo } from '../src/content-repo/read-content-repo'
import { readMirrorProvenance } from '../src/mirror/read-provenance'
import { createGitFixture, type GitFixture } from './git-fixture'

const okFixtureRoot = fileURLToPath(new URL('./fixtures/content-repo/ok', import.meta.url))

const SERVER_TIMEOUT_MS = 20_000

interface RunningBridge {
  readonly baseUrl: string
  close(): Promise<void>
}

/** Boots a plain `node:http` server whose handler is `createFileBridge(options)`, on a free port. */
async function startBridge(options: {
  readonly repoRoot: string
  readonly directories: readonly string[]
}): Promise<RunningBridge> {
  const middleware = createFileBridge(options)
  const server: Server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('not handled')
    })
  })

  await new Promise<void>((resolvePromise) => {
    server.listen(0, '127.0.0.1', resolvePromise)
  })

  const { port } = server.address() as AddressInfo
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((err) => (err ? rejectPromise(err) : resolvePromise()))
      }),
  }
}

/**
 * A raw `node:http` GET, bypassing `fetch()`'s forbidden-header rules — `fetch()` silently
 * refuses to let a caller override the `Host` header, so the Host-guard test needs this instead.
 */
function rawGet(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const url = new URL(path, baseUrl)
  return new Promise((resolvePromise, rejectPromise) => {
    const req = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, body: data }))
      },
    )
    req.on('error', rejectPromise)
    req.end()
  })
}

/**
 * Sends a raw HTTP/1.0 request with no `Host` header at all, over a plain `net.Socket`. Node's own
 * `http` client always adds a `Host` header itself, so the only way to exercise the "header
 * entirely absent" branch of the Host guard is to speak HTTP by hand.
 */
function rawRequestWithoutHostHeader(
  baseUrl: string,
  path: string,
): Promise<{ status: number; body: string }> {
  const url = new URL(baseUrl)
  return new Promise((resolvePromise, rejectPromise) => {
    const socket = connect(Number(url.port), url.hostname, () => {
      socket.write(`GET ${path} HTTP/1.0\r\n\r\n`)
    })
    let data = ''
    socket.on('data', (chunk) => (data += chunk.toString()))
    socket.on('end', () => {
      const [head, ...bodyParts] = data.split('\r\n\r\n')
      const statusLine = head.split('\r\n')[0] ?? ''
      const status = Number(statusLine.split(' ')[1] ?? '0')
      resolvePromise({ status, body: bodyParts.join('\r\n\r\n') })
    })
    socket.on('error', rejectPromise)
  })
}

/** `Response.json()` types as `any`; every caller here knows the bridge's own response shape. */
async function asJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

function gitStatusPorcelain(cwd: string): string {
  return execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
}

describe('file bridge over the ok fixture', () => {
  let bridge: RunningBridge

  beforeAll(async () => {
    bridge = await startBridge({ repoRoot: okFixtureRoot, directories: ['news'] })
  }, SERVER_TIMEOUT_MS)

  afterAll(async () => {
    await bridge?.close()
  }, SERVER_TIMEOUT_MS)

  test('the read route returns the story 010 reader shape verbatim for the ok fixture', async () => {
    const response = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=news`)
    expect(response.status).toBe(200)
    const body = await asJson<BridgeReadResponse>(response)

    const expected = readContentRepo({ repoRoot: okFixtureRoot })
    expect(body).toEqual(expected)
  })

  test('the file route returns a guarded file as text', async () => {
    const response = await fetch(`${bridge.baseUrl}/__studio/fs/file?path=news/index.json`)
    expect(response.status).toBe(200)
    const body = await asJson<BridgeFileResponse>(response)
    expect(body).toEqual({
      path: 'news/index.json',
      text: readFileSync(join(okFixtureRoot, 'news', 'index.json'), 'utf8'),
    })
  })

  test('only directories a registered descriptor declares are reachable', async () => {
    const undeclaredType = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=engines`)
    expect(undeclaredType.status).toBe(404)
    const undeclaredBody = await asJson<BridgeErrorResponse>(undeclaredType)
    expect(typeof undeclaredBody.error).toBe('string')
    // The refusal must not leak which directories are valid.
    expect(undeclaredBody.error).not.toContain('news')

    const outsideDeclared = await fetch(`${bridge.baseUrl}/__studio/fs/file?path=docs/something.md`)
    expect(outsideDeclared.status).toBeGreaterThanOrEqual(400)
    expect(outsideDeclared.status).toBeLessThan(500)

    const declared = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=news`)
    expect(declared.status).toBe(200)
  })

  test('the provenance route returns the same MirrorProvenance readMirrorProvenance would', async () => {
    const response = await fetch(`${bridge.baseUrl}/__studio/fs/provenance`)
    expect(response.status).toBe(200)
    const body = await asJson<BridgeProvenanceResponse>(response)

    const expected = readMirrorProvenance(okFixtureRoot)
    expect(body).toEqual(expected)
  })

  test('the provenance route ignores any query string, proving it reads no path from the request', async () => {
    const plain = await fetch(`${bridge.baseUrl}/__studio/fs/provenance`)
    const plainBody = await asJson<BridgeProvenanceResponse>(plain)

    const withPathLikeQuery = await fetch(
      `${bridge.baseUrl}/__studio/fs/provenance?path=../../../etc/passwd&type=news`,
    )
    expect(withPathLikeQuery.status).toBe(200)
    const withQueryBody = await asJson<BridgeProvenanceResponse>(withPathLikeQuery)

    expect(withQueryBody).toEqual(plainBody)
    expect(withQueryBody).toEqual(readMirrorProvenance(okFixtureRoot))
  })

  test('a repoRoot/root query parameter anywhere is ignored', async () => {
    const withEvilRoot = await fetch(
      `${bridge.baseUrl}/__studio/fs/file?path=news/index.json&repoRoot=/tmp/evil&root=/tmp/also-evil`,
    )
    expect(withEvilRoot.status).toBe(200)
    const body = await asJson<BridgeFileResponse>(withEvilRoot)
    expect(body).toEqual({
      path: 'news/index.json',
      text: readFileSync(join(okFixtureRoot, 'news', 'index.json'), 'utf8'),
    })
  })

  test('every write method is refused on both routes', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const readResponse = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=news`, { method })
      expect(readResponse.status).toBe(405)
      expect(await asJson<BridgeErrorResponse>(readResponse)).toEqual({
        error: 'method not allowed',
      })

      const fileResponse = await fetch(`${bridge.baseUrl}/__studio/fs/file?path=news/index.json`, {
        method,
      })
      expect(fileResponse.status).toBe(405)
      expect(await asJson<BridgeErrorResponse>(fileResponse)).toEqual({
        error: 'method not allowed',
      })
    }
  })

  test('non-loopback Host and cross-origin Origin headers are refused', async () => {
    // `fetch()` treats `Host` as a forbidden header and silently drops an override, so this uses
    // a raw `node:http` request to actually send a non-loopback `Host`.
    const badHost = await rawGet(bridge.baseUrl, '/__studio/fs/read?type=news', {
      host: 'evil.example.com',
    })
    expect(badHost.status).toBe(403)
    expect(JSON.parse(badHost.body) as BridgeErrorResponse).toEqual({ error: 'non-loopback host' })

    const badOrigin = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=news`, {
      headers: { origin: 'https://evil.example.com' },
    })
    expect(badOrigin.status).toBe(403)
    expect(await asJson<BridgeErrorResponse>(badOrigin)).toEqual({
      error: 'cross-origin request refused',
    })
  })

  test('a request with no Host header at all is refused, same as a non-loopback one', async () => {
    // A real browser always sends `Host`; this is the default-deny defence-in-depth case for a
    // raw client that omits it entirely.
    const response = await rawRequestWithoutHostHeader(
      bridge.baseUrl,
      '/__studio/fs/read?type=news',
    )
    expect(response.status).toBe(403)
    expect(JSON.parse(response.body) as BridgeErrorResponse).toEqual({ error: 'non-loopback host' })
  })

  test('the read route refuses a declared-but-unimplemented content type instead of returning news', async () => {
    const unimplemented = await startBridge({
      repoRoot: okFixtureRoot,
      directories: ['news', 'engines'],
    })
    try {
      const response = await fetch(`${unimplemented.baseUrl}/__studio/fs/read?type=engines`)
      expect(response.status).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
      const body = await asJson<BridgeErrorResponse>(response)
      expect(body.error).not.toEqual('engines: not a declared content-type directory')
      expect(body.error).toContain('engines')

      // The news read on the same bridge instance must still work, and must not be what an
      // unimplemented type silently falls back to.
      const newsResponse = await fetch(`${unimplemented.baseUrl}/__studio/fs/read?type=news`)
      expect(newsResponse.status).toBe(200)
    } finally {
      await unimplemented.close()
    }
  })

  test('the image route confines traversal to news/img, not just news', async () => {
    const tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'bridge-img-confine-')))
    const repoRoot = join(tmpRoot, 'repo')
    try {
      mkdirSync(join(repoRoot, 'news', 'img'), { recursive: true })
      writeFileSync(join(repoRoot, 'news', 'img', 'pic.png'), 'real-image-bytes', 'utf8')
      // A sibling .png directly under news/ (not news/img/) - a raster extension, so this proves
      // the path guard's containment check, not the extension allowlist.
      writeFileSync(join(repoRoot, 'news', 'sibling.png'), 'should-not-be-reachable', 'utf8')

      const imageBridge = await startBridge({ repoRoot, directories: ['news'] })
      try {
        const ok = await fetch(`${imageBridge.baseUrl}/news-img/pic.png`)
        expect(ok.status).toBe(200)

        const escape = await fetch(`${imageBridge.baseUrl}/news-img/..%2fsibling.png`)
        expect(escape.status).toBeGreaterThanOrEqual(400)
        expect(escape.status).toBeLessThan(500)
      } finally {
        await imageBridge.close()
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true })
    }
  })

  test('requests outside the bridge prefix fall through to next()', async () => {
    const response = await fetch(`${bridge.baseUrl}/some/other/path`)
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('not handled')
  })
})

describe('file bridge path-guard escapes over HTTP', () => {
  let tmpRoot: string
  let repoRoot: string
  let bridge: RunningBridge

  beforeAll(async () => {
    tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'bridge-http-')))
    repoRoot = join(tmpRoot, 'repo')
    const outsideDir = join(tmpRoot, 'outside')

    mkdirSync(join(repoRoot, 'news'), { recursive: true })
    mkdirSync(outsideDir, { recursive: true })
    writeFileSync(join(repoRoot, 'news', 'index.json'), '[]', 'utf8')
    writeFileSync(join(outsideDir, 'secret.md'), 'secret\n', 'utf8')

    // The escape: a link inside the declared directory pointing outside the repository root —
    // same technique `resolve-bridge-path.test.ts` (D1) uses, so it needs no elevation on Windows.
    symlinkSync(outsideDir, join(repoRoot, 'news', 'escape'), 'junction')

    bridge = await startBridge({ repoRoot, directories: ['news'] })
  }, SERVER_TIMEOUT_MS)

  afterAll(async () => {
    await bridge?.close()
    try {
      rmSync(tmpRoot, { recursive: true, force: true })
    } catch {
      // Best effort — a leftover temp directory is harmless.
    }
  }, SERVER_TIMEOUT_MS)

  test('the bridge refuses traversal, absolute paths and a symlink escape over HTTP', async () => {
    const cases = [
      '../outside/secret.md',
      '/etc/passwd',
      'C:\\Windows\\system32\\config',
      '\\\\server\\share\\file',
      'news/%2e%2e/%2e%2e/outside/secret.md',
      'news/escape/secret.md',
    ]

    for (const requestPath of cases) {
      const response = await fetch(
        `${bridge.baseUrl}/__studio/fs/file?path=${encodeURIComponent(requestPath)}`,
      )
      expect(response.status, `${requestPath} should have been refused`).toBeGreaterThanOrEqual(400)
      expect(response.status).toBeLessThan(500)
      const body = await asJson<BridgeErrorResponse>(response)
      expect(typeof body.error, `${requestPath} should name a refusal reason`).toBe('string')
      expect(body.error.length).toBeGreaterThan(0)
    }
  })
})

describe('file bridge leaves the working tree unchanged', () => {
  let fixture: GitFixture | undefined

  afterEach(() => {
    fixture?.cleanup()
    fixture = undefined
  })

  it('every write method is refused and the working tree is unchanged after a full read', async () => {
    fixture = createGitFixture()
    fixture.writeFile(
      'news/index.json',
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [{ id: 'first-post', file: '2026-01-01-first-post.md', order: 10 }],
        },
        null,
        2,
      ),
    )
    fixture.writeFile('news/2026-01-01-first-post.md', '# First post\n')
    fixture.writeFile('news/img/pic.png', 'not-a-real-png-but-bytes-are-fine')
    fixture.commitAll()

    const before = gitStatusPorcelain(fixture.dir)

    const bridge = await startBridge({ repoRoot: fixture.dir, directories: ['news'] })
    try {
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const readResponse = await fetch(`${bridge.baseUrl}/__studio/fs/read?type=news`, { method })
        expect(readResponse.status).toBe(405)
        const fileResponse = await fetch(
          `${bridge.baseUrl}/__studio/fs/file?path=news/index.json`,
          { method },
        )
        expect(fileResponse.status).toBe(405)
      }

      const battery = [
        '/__studio/fs/read?type=news',
        '/__studio/fs/file?path=news/index.json',
        '/__studio/fs/file?path=news/2026-01-01-first-post.md',
        '/__studio/fs/file?path=news/img/pic.png',
        '/__studio/fs/file?path=../outside.md',
        '/__studio/fs/read?type=engines',
        '/__studio/fs/unknown-route',
      ]
      for (const route of battery) {
        await fetch(`${bridge.baseUrl}${route}`)
      }
    } finally {
      await bridge.close()
    }

    const after = gitStatusPorcelain(fixture.dir)
    expect(after).toBe(before)
  })
})

describe('no write API is imported under studio/src/bridge/', () => {
  const bannedNames = [
    'writeFileSync',
    'writeFile',
    'appendFileSync',
    'appendFile',
    'rmSync',
    'rm',
    'unlinkSync',
    'unlink',
    'mkdirSync',
    'mkdir',
    'renameSync',
    'rename',
    'copyFileSync',
    'copyFile',
  ]

  function listTsFiles(dir: string): string[] {
    const entries: Dirent[] = readdirSync(dir, { withFileTypes: true })
    const files: string[] = []
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...listTsFiles(full))
      } else if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.test.ts')) {
        // Test files legitimately create fixture files/symlinks with `node:fs` write APIs (e.g.
        // `resolve-bridge-path.test.ts`, D1). This scan is about the bridge's own runtime code.
        files.push(full)
      }
    }
    return files
  }

  it('scans every .ts file under studio/src/bridge/ for a banned fs write import', () => {
    const bridgeDir = fileURLToPath(new URL('../src/bridge', import.meta.url))
    const files = listTsFiles(bridgeDir)
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const importBlocks = text.match(/import[^;]*from\s+['"]node:fs(\/promises)?['"]/g) ?? []
      for (const block of importBlocks) {
        for (const banned of bannedNames) {
          const pattern = new RegExp(`[{,]\\s*${banned}\\s*[,}]`)
          expect(
            pattern.test(block),
            `${file} imports ${banned} from node:fs — a write API must not appear under studio/src/bridge/`,
          ).toBe(false)
        }
      }
    }
  })
})
