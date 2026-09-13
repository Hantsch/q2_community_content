import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

const studioRoot = fileURLToPath(new URL('..', import.meta.url))

// A real server boot is slower than vitest's 5s default, but a hung boot must still fail
// the run instead of stalling it.
const SERVER_TIMEOUT_MS = 20_000

let server: ViteDevServer | undefined

beforeAll(async () => {
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

test(
  'serves the studio app at the local URL it reports',
  async () => {
    const url = server?.resolvedUrls?.local[0]
    if (typeof url !== 'string') {
      throw new Error('the dev server did not report a local URL it is reachable at')
    }

    const response = await fetch(url)
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<title>Q2 Content Studio</title>')
  },
  SERVER_TIMEOUT_MS,
)
