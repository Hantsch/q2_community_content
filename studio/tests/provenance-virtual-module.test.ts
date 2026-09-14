import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { readMirrorProvenance } from '../src/mirror/read-provenance'

const studioRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

// A real server boot is slower than vitest's 5s default, but a hung boot must still fail
// the run instead of stalling it.
const SERVER_TIMEOUT_MS = 20_000

let server: ViteDevServer | undefined

beforeAll(async () => {
  server = await createServer({ root: studioRoot, logLevel: 'warn' })
  await server.listen()
}, SERVER_TIMEOUT_MS)

afterAll(async () => {
  // Runs even when an assertion threw - an open listening socket would keep the vitest
  // process alive forever.
  await server?.close()
}, SERVER_TIMEOUT_MS)

test(
  'the studio surface imports mirror provenance as structured data',
  async () => {
    if (server === undefined) {
      throw new Error('the dev server did not start')
    }

    const mod = await server.ssrLoadModule('virtual:mirror-provenance')
    const provenance = mod.default as Record<string, unknown>

    expect(typeof provenance.verdict).toBe('string')
    expect(typeof provenance.launcherCommit).toBe('string')
    expect(typeof provenance.launcherCommitShort).toBe('string')
    expect(typeof provenance.syncedAt).toBe('string')
    expect(typeof provenance.ageInDays).toBe('number')
    expect(typeof provenance.fileCount).toBe('number')
    expect(Array.isArray(provenance.mismatchedFiles)).toBe(true)

    const direct = readMirrorProvenance(repoRoot)
    expect(provenance.verdict).toBe(direct.verdict)
    expect(provenance.launcherCommit).toBe(direct.launcherCommit)
  },
  SERVER_TIMEOUT_MS,
)
