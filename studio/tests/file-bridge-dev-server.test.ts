import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

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
