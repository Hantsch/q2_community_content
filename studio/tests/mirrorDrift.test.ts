/**
 * Story 008 D6 (last deliverable of the story): proves that nothing D1-D5 (or this deliverable's
 * own `studioStylesheets.test.ts`) added was made to work by hand-editing a mirrored file.
 * `studio/src/launcher-core/` is mirrored, never hand-edited (CLAUDE.md); `npm run check:drift`
 * (story 006) is the CLI that catches that, and `launcher-core-unmodified.test.ts` (story 007 D5)
 * already runs it the same way — this file follows that exact pattern for consistency.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const studioDir = fileURLToPath(new URL('..', import.meta.url))

const SPAWN_TIMEOUT_MS = 60_000

describe('story 008 leaves the launcher-core mirror byte-for-byte faithful', () => {
  it('npm run check:drift exits 0 after every story 008 deliverable', () => {
    const result = spawnSync('npm run check:drift', {
      cwd: studioDir,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
      shell: true,
    })

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0)
  })
})
