import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { SCRATCH_MARKER, SCRATCH_ROOT_ENV } from '../src/bridge/scratch-repo-root'
import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'

/**
 * Story 015, D3: boots a real Vite dev server the same way `dev-server.test.ts` does, against the
 * real repository root, and proves the folded-in image route (AC4) and the loopback-only bind
 * (AC6) both hold with `fileBridgePlugin` wired in via `vite.config.ts`.
 */

const studioRoot = fileURLToPath(new URL('..', import.meta.url))
const repoImagePath = fileURLToPath(
  new URL('../../news/img/cover-community-welcome.png', import.meta.url),
)

// A real server boot is slower than vitest's 5s default, but a hung boot must still fail
// the run instead of stalling it.
const SERVER_TIMEOUT_MS = 20_000

let server: ViteDevServer | undefined

beforeAll(async () => {
  // Confirms the fixture this test relies on (and that `mirrored-rendering.spec.ts` also relies
  // on) actually exists, rather than the request below failing for the wrong reason.
  if (!existsSync(repoImagePath)) {
    throw new Error(`${repoImagePath}: expected the real news/img fixture to exist`)
  }

  // No port is pinned: Vite binds a free one and reports it back through `resolvedUrls`,
  // so a dev server already running on the default port cannot make this test flaky.
  server = await createServer({ root: studioRoot, logLevel: 'warn' })
  await server.listen()
}, SERVER_TIMEOUT_MS)

afterAll(async () => {
  // Runs even when an assertion threw - an open listening socket would keep the vitest
  // process alive forever.
  await server?.close()
}, SERVER_TIMEOUT_MS)

function localUrl(): string {
  const url = server?.resolvedUrls?.local[0]
  if (typeof url !== 'string') {
    throw new Error('the dev server did not report a local URL it is reachable at')
  }
  return url
}

test(
  'the image route serves a raster image with an explicit content type and refuses svg and traversal',
  async () => {
    const base = localUrl()

    const image = await fetch(`${base}news-img/cover-community-welcome.png`)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(image.headers.get('x-content-type-options')).toBe('nosniff')
    const bytes = await image.arrayBuffer()
    expect(bytes.byteLength).toBeGreaterThan(0)

    const svg = await fetch(`${base}news-img/cover-community-welcome.svg`)
    expect(svg.status).not.toBe(200)
    expect(svg.headers.get('x-content-type-options')).toBe('nosniff')

    const traversal = await fetch(`${base}news-img/..%2f..%2fpackage.json`)
    expect(traversal.status).not.toBe(200)
  },
  SERVER_TIMEOUT_MS,
)

test(
  'the dev server listens on the loopback address only',
  () => {
    const resolvedUrls = server?.resolvedUrls
    if (resolvedUrls === undefined || resolvedUrls === null) {
      throw new Error('the dev server did not report resolvedUrls')
    }

    expect(resolvedUrls.local.some((url) => url.includes('127.0.0.1'))).toBe(true)
    expect(resolvedUrls.network).toEqual([])
  },
  SERVER_TIMEOUT_MS,
)

// STUDIO_E2E_REPO_ROOT is read once while the server boots, so these tests start their own servers.
const savedRepoRoot = process.env[SCRATCH_ROOT_ENV]
afterEach(() => {
  if (savedRepoRoot === undefined) delete process.env[SCRATCH_ROOT_ENV]
  else process.env[SCRATCH_ROOT_ENV] = savedRepoRoot
})

test(
  "STUDIO_E2E_REPO_ROOT serves the sandbox's news, not the repository's",
  async () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'studio-sandbox-'))
    let sandboxServer: ViteDevServer | undefined
    try {
      mkdirSync(join(sandbox, 'studio'))
      mkdirSync(join(sandbox, 'news'))
      writeFileSync(join(sandbox, SCRATCH_MARKER), '')
      const sandboxIndex = '{"sandbox":"distinct-sandbox-news"}\n'
      writeFileSync(join(sandbox, 'news', 'index.json'), sandboxIndex)
      const repoIndex = readFileSync(
        fileURLToPath(new URL('../../news/index.json', import.meta.url)),
        'utf8',
      )
      expect(repoIndex).not.toBe(sandboxIndex)

      process.env[SCRATCH_ROOT_ENV] = sandbox
      sandboxServer = await createServer({ root: studioRoot, logLevel: 'warn' })
      await sandboxServer.listen()
      const base = sandboxServer.resolvedUrls?.local[0]
      if (typeof base !== 'string') throw new Error('the sandbox server reported no local URL')

      const response = await fetch(`${base}__studio/fs/file?path=news/index.json`)
      expect(response.status).toBe(200)
      const body = (await response.json()) as { text: string }
      expect(body.text).toBe(sandboxIndex)
    } finally {
      await sandboxServer?.close()
      rmSync(sandbox, { recursive: true, force: true })
    }
  },
  SERVER_TIMEOUT_MS,
)

test(
  'a STUDIO_E2E_REPO_ROOT without the scratch marker is refused',
  async () => {
    const unmarked = mkdtempSync(join(tmpdir(), 'studio-unmarked-'))
    process.env[SCRATCH_ROOT_ENV] = unmarked
    let refused: unknown
    let refusedServer: ViteDevServer | undefined
    try {
      refusedServer = await createServer({ root: studioRoot, logLevel: 'silent' })
    } catch (error) {
      refused = error
    } finally {
      await refusedServer?.close()
      rmSync(unmarked, { recursive: true, force: true })
    }
    expect(refused).toBeInstanceOf(Error)
    expect((refused as Error).message).toContain(SCRATCH_MARKER)
  },
  SERVER_TIMEOUT_MS,
)
