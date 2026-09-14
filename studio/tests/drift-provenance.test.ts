/**
 * Acceptance tests for story 009 D3 (drift CLI header): the CLI must name the launcher commit the
 * mirror came from (AC2), and must reuse `VERDICT_LABELS` rather than inventing its own
 * in-sync/out-of-sync wording (half of AC4). Spawns the real `check-drift.ts` exactly as
 * `check-drift-cli.test.ts` does, against this repository's own committed lock file.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { VERDICT_LABELS } from '../src/mirror/provenance'

const require = createRequire(import.meta.url)
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const cliPath = join(studioDir, 'scripts', 'check-drift.ts')
const tsxCliPath = require.resolve('tsx/cli')

const SPAWN_TIMEOUT_MS = 60_000

interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

function runCli(args: readonly string[]): CliRun {
  const result = spawnSync(process.execPath, [tsxCliPath, cliPath, ...args], {
    cwd: studioDir,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

describe('check:drift CLI provenance header', () => {
  it('npm run check:drift names the launcher commit the mirror came from', () => {
    const lock = JSON.parse(
      readFileSync(join(studioDir, 'launcher-core.lock.json'), 'utf8'),
    ) as { launcher: { commit: string } }
    const shortCommit = lock.launcher.commit.slice(0, 12)

    const run = runCli([])

    expect(run.stdout).toContain(shortCommit)
  })

  it("the CLI prints the module's out-of-sync label, not its own wording", () => {
    const source = readFileSync(cliPath, 'utf8')

    // The CLI must not hardcode its own in-sync/out-of-sync phrasing; it must go through
    // `formatProvenance` (which itself uses VERDICT_LABELS) rather than restating the words.
    expect(source).toContain('formatProvenance')
    expect(source).not.toContain("'in sync'")
    expect(source).not.toContain("'out of sync'")
    expect(source).not.toContain('"in sync"')
    expect(source).not.toContain('"out of sync"')

    const run = runCli([])
    expect(run.stdout).toContain(`Status: ${VERDICT_LABELS['in-sync']}`)
  })
})
