/**
 * Story 007, D5: proves that `npm run check:drift` still passes against this repository's own
 * mirror after everything D1-D4 added, and that the contract boundary (the one studio file
 * allowed to import the mirror, and the `@shared/*` alias that makes it compile unmodified) is
 * written down in `studio/README.md`.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const studioDir = fileURLToPath(new URL('..', import.meta.url))

const SPAWN_TIMEOUT_MS = 60_000

describe('launcher-core mirror stays unmodified', () => {
  it('npm run check:drift exits 0 against this repository own mirror', () => {
    const result = spawnSync('npm run check:drift', {
      cwd: studioDir,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
      shell: true,
    })

    expect(result.status, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`).toBe(0)
  })

  it('README.md names the contract boundary module and the @shared/* alias', () => {
    const readme = readFileSync(join(studioDir, 'README.md'), 'utf8')

    expect(readme).toContain('src/contract/launcher-contract.ts')
    expect(readme).toContain('@shared/*')
  })
})
