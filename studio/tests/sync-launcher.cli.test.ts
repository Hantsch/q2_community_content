/**
 * Integration tests for the `sync:launcher` CLI. They spawn the real command as a child process
 * against a throwaway git fixture, exactly as a contributor would run it.
 *
 * The CLI resolves its write targets from its working directory, so every run here happens in a
 * disposable sandbox that contains nothing but an empty `studio/` directory — this repository's
 * own `studio/src/launcher-core/` and `studio/launcher-core.lock.json` are never touched.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { launcherCoreManifest } from '../scripts/launcher-core.manifest'
import { parseLauncherCoreLock } from '../scripts/launcher-core-lock'
import { createGitFixture, type GitFixture } from './git-fixture'

const require = createRequire(import.meta.url)
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(studioDir)
const cliPath = join(studioDir, 'scripts', 'sync-launcher.ts')
const tsxCliPath = require.resolve('tsx/cli')

const MIRROR_RELATIVE_ROOT = join('studio', 'src', 'launcher-core')
const LOCK_RELATIVE_PATH = join('studio', 'launcher-core.lock.json')
const SPAWN_TIMEOUT_MS = 60_000

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

/**
 * Deliberately awkward bytes: CRLF, a lone LF, a BOM and a non-ASCII character. A copy that goes
 * through a string or through git's line-ending conversion would not survive them (AC2).
 */
function sourceContentFor(source: string): string {
  return `${BYTE_ORDER_MARK}// mirrored ${source}\r\nconst greeting = 'grüß dich'\nexport default greeting\r\n`
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

/** A sandbox repository root: an empty `studio/` and nothing else. */
function createSandbox(): string {
  const sandbox = mkdtempSync(join(tmpdir(), 'q2-sync-launcher-sandbox-'))
  mkdirSync(join(sandbox, 'studio'))
  return sandbox
}

function createPopulatedLauncher(): GitFixture {
  const fixture = createGitFixture()
  for (const { source } of launcherCoreManifest) {
    fixture.writeFile(source, sourceContentFor(source))
  }
  fixture.commitAll()
  return fixture
}

/** Every file under `root`, as `relative path -> sha256 of its bytes`, sorted by path. */
function snapshotTree(root: string): Map<string, string> {
  const snapshot = new Map<string, string>()
  if (!existsSync(root)) return snapshot

  function walk(directory: string): void {
    for (const dirent of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const entryPath = join(directory, dirent.name)
      if (dirent.isDirectory()) {
        walk(entryPath)
        continue
      }
      snapshot.set(
        relative(root, entryPath).split(sep).join('/'),
        createHash('sha256').update(readFileSync(entryPath)).digest('hex'),
      )
    }
  }

  walk(root)
  return snapshot
}

function mirrorPathIn(sandbox: string, source: string): string {
  return join(sandbox, MIRROR_RELATIVE_ROOT, ...source.split('/'))
}

let fixture: GitFixture | undefined
let sandbox: string | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
  sandbox = undefined
})

describe('sync:launcher CLI', () => {
  it('copies every declared file into studio/src/launcher-core/', () => {
    fixture = createPopulatedLauncher()
    sandbox = createSandbox()

    const run = runCli(sandbox, ['--launcher', fixture.dir])

    expect(run.status).toBe(0)
    for (const { source } of launcherCoreManifest) {
      expect(existsSync(mirrorPathIn(sandbox, source))).toBe(true)
    }
    expect(snapshotTree(join(sandbox, MIRROR_RELATIVE_ROOT)).size).toBe(launcherCoreManifest.length)
  })

  it('every copied file is byte-identical to its source', () => {
    fixture = createPopulatedLauncher()
    sandbox = createSandbox()

    expect(runCli(sandbox, ['--launcher', fixture.dir]).status).toBe(0)

    for (const { source } of launcherCoreManifest) {
      const sourceBytes = readFileSync(join(fixture.dir, ...source.split('/')))
      const mirroredBytes = readFileSync(mirrorPathIn(sandbox, source))
      expect(mirroredBytes.equals(sourceBytes)).toBe(true)
    }
  })

  it('a real run writes that lock', () => {
    fixture = createPopulatedLauncher()
    const sandboxDir = createSandbox()
    sandbox = sandboxDir

    expect(runCli(sandboxDir, ['--launcher', fixture.dir]).status).toBe(0)

    const lock = parseLauncherCoreLock(readFileSync(join(sandboxDir, LOCK_RELATIVE_PATH), 'utf8'))
    expect(lock.launcher.commit).toBe(fixture.headSha())
    expect(Date.parse(lock.launcher.syncedAt)).not.toBeNaN()
    expect(lock.files).toHaveLength(launcherCoreManifest.length)

    for (const entry of launcherCoreManifest) {
      const recorded = lock.files.find((file) => file.mirror === entry.mirror)
      expect(recorded?.source).toBe(entry.source)
      expect(recorded?.sha256).toBe(
        createHash('sha256')
          .update(readFileSync(mirrorPathIn(sandboxDir, entry.source)))
          .digest('hex'),
      )
    }
  })

  it('a failed preflight writes nothing at all', () => {
    // A launcher checkout that is missing one declared file: preflight fails on it.
    fixture = createGitFixture()
    const [firstDeclared, ...rest] = launcherCoreManifest
    for (const { source } of rest) fixture.writeFile(source, sourceContentFor(source))
    fixture.commitAll()

    sandbox = createSandbox()
    // Pre-existing state the command must leave alone, including a file it would otherwise prune.
    mkdirSync(join(sandbox, MIRROR_RELATIVE_ROOT), { recursive: true })
    writeFileSync(join(sandbox, MIRROR_RELATIVE_ROOT, 'leftover.txt'), 'stale mirror file')
    writeFileSync(join(sandbox, LOCK_RELATIVE_PATH), 'previous lock bytes')
    const before = snapshotTree(join(sandbox, 'studio'))

    const run = runCli(sandbox, ['--launcher', fixture.dir])

    expect(run.status).toBe(1)
    expect(run.stderr).toContain(firstDeclared.source.split('/').join(sep))
    expect(run.stderr.trim().split('\n')).toHaveLength(1)
    expect(snapshotTree(join(sandbox, 'studio'))).toEqual(before)
  })

  it('a missing --launcher argument is a usage error that writes nothing', () => {
    sandbox = createSandbox()

    const run = runCli(sandbox, [])

    expect(run.status).toBe(1)
    expect(run.stderr).toContain('--launcher')
    expect(existsSync(join(sandbox, MIRROR_RELATIVE_ROOT))).toBe(false)
    expect(existsSync(join(sandbox, LOCK_RELATIVE_PATH))).toBe(false)
  })

  it('a second run leaves the working tree unchanged', () => {
    fixture = createPopulatedLauncher()
    sandbox = createSandbox()

    expect(runCli(sandbox, ['--launcher', fixture.dir]).status).toBe(0)
    const afterFirstRun = snapshotTree(join(sandbox, 'studio'))
    const lockPath = join(sandbox, LOCK_RELATIVE_PATH)
    const lockModifiedAt = statSync(lockPath).mtimeMs
    const mirroredModifiedAt = statSync(
      mirrorPathIn(sandbox, launcherCoreManifest[0].source),
    ).mtimeMs

    expect(runCli(sandbox, ['--launcher', fixture.dir]).status).toBe(0)

    expect(snapshotTree(join(sandbox, 'studio'))).toEqual(afterFirstRun)
    // Unchanged content is not rewritten at all, so even the timestamps stand still.
    expect(statSync(lockPath).mtimeMs).toBe(lockModifiedAt)
    expect(statSync(mirrorPathIn(sandbox, launcherCoreManifest[0].source)).mtimeMs).toBe(
      mirroredModifiedAt,
    )
  })

  it('prunes files under the mirror that the manifest does not declare', () => {
    fixture = createPopulatedLauncher()
    sandbox = createSandbox()

    const orphan = join(sandbox, MIRROR_RELATIVE_ROOT, 'src', 'shared', 'dropped-file.ts')
    mkdirSync(dirname(orphan), { recursive: true })
    writeFileSync(orphan, 'a file that left the manifest')

    expect(runCli(sandbox, ['--launcher', fixture.dir]).status).toBe(0)

    expect(existsSync(orphan)).toBe(false)
    expect(snapshotTree(join(sandbox, MIRROR_RELATIVE_ROOT)).size).toBe(launcherCoreManifest.length)
  })

  it('writes only inside studio/ and leaves the launcher checkout untouched', () => {
    fixture = createPopulatedLauncher()
    sandbox = createSandbox()
    // `.git` is left out: preflight's own `git status` may refresh the index, which is not a
    // working-tree change — the porcelain assertion below covers that side.
    const launcherBefore = snapshotTree(join(fixture.dir, 'src'))

    expect(runCli(sandbox, ['--launcher', fixture.dir]).status).toBe(0)

    // The launcher checkout is only read: same bytes, and git sees no change.
    expect(snapshotTree(join(fixture.dir, 'src'))).toEqual(launcherBefore)
    expect(
      execFileSync('git', ['status', '--porcelain'], { cwd: fixture.dir, encoding: 'utf8' }),
    ).toBe('')

    // In the sandbox, only studio/ exists, and inside it only the mirror and the lock.
    expect(readdirSync(sandbox)).toEqual(['studio'])
    expect(readdirSync(join(sandbox, 'studio')).sort()).toEqual(['launcher-core.lock.json', 'src'])
    expect(readdirSync(join(sandbox, 'studio', 'src'))).toEqual(['launcher-core'])
  })

  it('the sync:launcher npm script points at studio/scripts/sync-launcher.ts', () => {
    const studioPackage = JSON.parse(readFileSync(join(studioDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(studioPackage.scripts['sync:launcher']).toContain('scripts/sync-launcher.ts')
    expect(rootPackage.scripts['sync:launcher']).toContain('sync:launcher --workspace studio')
  })
})
