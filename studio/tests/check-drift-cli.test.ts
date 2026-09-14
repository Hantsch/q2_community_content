/**
 * Integration tests for the `check:drift` CLI (story 006, D3). They spawn the real command as a
 * child process against a throwaway sandbox, exactly as a contributor would run it — this
 * repository's own `studio/src/launcher-core/` and `studio/launcher-core.lock.json` are never
 * touched.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { buildLauncherCoreLock, serialiseLauncherCoreLock } from '../scripts/launcher-core-lock'
import { createGitFixture, type GitFixture } from './git-fixture'

const require = createRequire(import.meta.url)
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(studioDir)
const cliPath = join(studioDir, 'scripts', 'check-drift.ts')
const tsxCliPath = require.resolve('tsx/cli')

const SPAWN_TIMEOUT_MS = 60_000

const MIRRORED_SOURCE = 'src/shared/modules/home.ts'
const MIRRORED_PATH = `studio/src/launcher-core/${MIRRORED_SOURCE}`
const CONTENT = 'export const home = 1\n'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

function runCli(sandbox: string, args: readonly string[]): CliRun {
  const result = spawnSync(process.execPath, [tsxCliPath, cliPath, ...args], {
    cwd: sandbox,
    encoding: 'utf8',
    timeout: SPAWN_TIMEOUT_MS,
  })
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** A sandbox repository root with a clean mirror matching the lock for one file. */
function createCleanSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), 'q2-check-drift-sandbox-'))
  mkdirSync(join(sandbox, 'studio'))

  const mirrorPath = join(sandbox, ...MIRRORED_PATH.split('/'))
  mkdirSync(dirname(mirrorPath), { recursive: true })
  writeFileSync(mirrorPath, CONTENT)

  const lock = buildLauncherCoreLock({
    commit: 'a'.repeat(40),
    files: [{ source: MIRRORED_SOURCE, mirror: MIRRORED_PATH, sha256: sha256(CONTENT) }],
    syncedAt: '2026-09-13T00:00:00.000Z',
  })
  writeFileSync(join(sandbox, 'studio', 'launcher-core.lock.json'), serialiseLauncherCoreLock(lock))

  return sandbox
}

let sandbox: string | undefined
let fixture: GitFixture | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
  sandbox = undefined
})

describe('check:drift CLI', () => {
  it('exits 0 on a clean mirror with no --launcher and prints the skip line', () => {
    sandbox = createCleanSandbox()

    const run = runCli(sandbox, [])

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('skipping comparison against the launcher checkout')
    expect(run.stdout.split('\n').filter((line) => line.includes('skipping'))).toHaveLength(1)
    expect(run.stdout).not.toContain('[locally-edited]')
    expect(run.stdout).not.toContain('[stale]')
  })

  it('exits 1 and names the edited file', () => {
    sandbox = createCleanSandbox()
    writeFileSync(join(sandbox, ...MIRRORED_PATH.split('/')), `${CONTENT}// edited locally\n`)

    const run = runCli(sandbox, [])

    expect(run.status).toBe(1)
    expect(run.stdout).toContain(MIRRORED_PATH)
    expect(run.stdout).toContain('[locally-edited]')
  })

  it('a launcher that moved ahead fails the check, naming the path in both repositories', () => {
    sandbox = createCleanSandbox()
    fixture = createGitFixture()
    fixture.writeFile(MIRRORED_SOURCE, `${CONTENT}export const addedUpstream = true\n`)
    fixture.commitAll()

    const run = runCli(sandbox, ['--launcher', fixture.dir])

    expect(run.status).toBe(1)
    expect(run.stdout).toContain(MIRRORED_PATH)
    expect(run.stdout).toContain(MIRRORED_SOURCE)
    expect(run.stdout).toContain('sync:launcher')
    expect(run.stdout).toContain('[stale]')
  })

  it('a stale mirror says re-sync, a locally edited one says move the change into the launcher', () => {
    sandbox = createCleanSandbox()
    fixture = createGitFixture()
    fixture.writeFile(MIRRORED_SOURCE, `${CONTENT}export const addedUpstream = true\n`)
    fixture.commitAll()

    const staleRun = runCli(sandbox, ['--launcher', fixture.dir])
    expect(staleRun.status).toBe(1)
    expect(staleRun.stdout).toContain('sync:launcher')

    writeFileSync(join(sandbox, ...MIRRORED_PATH.split('/')), `${CONTENT}// edited locally\n`)
    const editedRun = runCli(sandbox, ['--launcher', fixture.dir])
    expect(editedRun.status).toBe(1)
    expect(editedRun.stdout).toContain('launcher')
    expect(editedRun.stdout).toContain('re-sync')
    expect(editedRun.stdout).not.toContain('sync:launcher --launcher')
  })

  it('the check:drift npm script points at studio/scripts/check-drift.ts', () => {
    const studioPackage = JSON.parse(readFileSync(join(studioDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(studioPackage.scripts['check:drift']).toContain('scripts/check-drift.ts')
    expect(rootPackage.scripts['check:drift']).toContain('check:drift --workspace studio')
  })
})
