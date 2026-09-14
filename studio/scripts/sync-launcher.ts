/**
 * `npm run sync:launcher -- --launcher <path>` — copies the declared launcher files
 * (`launcher-core.manifest.ts`) verbatim into `studio/src/launcher-core/` and records the copy
 * in `studio/launcher-core.lock.json`.
 *
 * Three properties this file exists to guarantee (story 005):
 *
 * - **Nothing is written unless everything validated.** Preflight runs first, then every source
 *   file is read into memory; only after that does the mutation phase start, and it contains no
 *   step that can reasonably fail. A failing checkout therefore leaves the tree untouched (AC4).
 * - **Writes stay inside the mirror.** Every path this command writes or deletes is asserted to
 *   resolve inside `studio/src/launcher-core/` (the lock file inside `studio/`) before the first
 *   mutation, so a bad manifest entry aborts instead of escaping the repository (AC7).
 * - **A second run changes nothing.** Bytes are copied raw (never through a string, which would
 *   invite CRLF/BOM rewriting), files are only written when their content differs, and the lock
 *   carries `syncedAt` over from the previous lock when commit and hashes are unchanged (AC6).
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { launcherCoreManifest, type LauncherCoreManifestEntry } from './launcher-core.manifest'
import {
  buildLauncherCoreLock,
  parseLauncherCoreLock,
  serialiseLauncherCoreLock,
  type LauncherCoreLock,
  type LauncherCoreLockFileEntry,
} from './launcher-core-lock'
import { runPreflight } from './launcher-preflight'

const USAGE = 'usage: npm run sync:launcher -- --launcher <path to a q2-launcher checkout>'
const MIRROR_ROOT_RELATIVE_PATH = 'studio/src/launcher-core'
const LOCK_RELATIVE_PATH = 'studio/launcher-core.lock.json'

type Result<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string }

function ok<T>(value: T): Result<T> {
  return { ok: true, value }
}

function err<T>(error: string): Result<T> {
  return { ok: false, error }
}

/** Parses `--launcher <path>` / `--launcher=<path>`. Anything else is a usage error. */
export function parseArguments(argv: readonly string[]): Result<string> {
  let launcherPath: string | undefined

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--launcher') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return err(`--launcher needs a path.\n${USAGE}`)
      }
      launcherPath = value
      index += 1
      continue
    }

    if (argument.startsWith('--launcher=')) {
      const value = argument.slice('--launcher='.length)
      if (value.length === 0) return err(`--launcher needs a path.\n${USAGE}`)
      launcherPath = value
      continue
    }

    return err(`unknown argument "${argument}".\n${USAGE}`)
  }

  if (launcherPath === undefined) return err(`--launcher is required.\n${USAGE}`)
  return ok(launcherPath)
}

/**
 * Resolves the repository root the mirror is written into from the current working directory, so
 * the command works both from the repository root and from `studio/` (where `npm run` puts it).
 */
export function resolveRepoRoot(cwd: string): Result<string> {
  const root = basename(cwd) === 'studio' ? dirname(cwd) : cwd
  const studioDir = join(root, 'studio')

  if (!existsSync(studioDir) || !statSync(studioDir).isDirectory()) {
    return err(`${cwd}: is not a q2_community_content checkout (no studio/ directory)`)
  }

  return ok(root)
}

/**
 * True when `candidate` lies strictly inside `root`. Uses `path.relative` rather than a string
 * prefix, so neither `..` segments nor a sibling such as `launcher-core-evil` can pass.
 */
function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

interface WriteTarget {
  readonly entry: LauncherCoreManifestEntry
  readonly destination: string
  readonly contents: Buffer
  readonly sha256: string
}

interface SyncPaths {
  readonly mirrorRoot: string
  readonly lockPath: string
}

/** Confines every path this run may touch to `studio/`, before anything is written. */
function resolveSyncPaths(repoRoot: string): Result<SyncPaths> {
  const studioRoot = resolve(repoRoot, 'studio')
  const mirrorRoot = resolve(repoRoot, MIRROR_ROOT_RELATIVE_PATH)
  const lockPath = resolve(repoRoot, LOCK_RELATIVE_PATH)

  if (!isInside(studioRoot, mirrorRoot)) {
    return err(`${mirrorRoot}: mirror root resolves outside studio/`)
  }
  if (!isInside(studioRoot, lockPath)) {
    return err(`${lockPath}: lock file resolves outside studio/`)
  }
  if (existsSync(mirrorRoot) && !statSync(mirrorRoot).isDirectory()) {
    return err(`${mirrorRoot}: exists but is not a directory`)
  }
  if (existsSync(lockPath) && !statSync(lockPath).isFile()) {
    return err(`${lockPath}: exists but is not a file`)
  }

  return ok({ mirrorRoot, lockPath })
}

/** Reads every declared source file's raw bytes. A single failure aborts before any write. */
function readSources(
  launcherPath: string,
  repoRoot: string,
  mirrorRoot: string,
): Result<WriteTarget[]> {
  const targets: WriteTarget[] = []

  for (const entry of launcherCoreManifest) {
    const destination = resolve(repoRoot, entry.mirror)
    if (!isInside(mirrorRoot, destination)) {
      return err(
        `${entry.mirror}: declared mirror path resolves outside ${MIRROR_ROOT_RELATIVE_PATH}/`,
      )
    }

    const sourcePath = join(launcherPath, entry.source)
    let contents: Buffer
    try {
      contents = readFileSync(sourcePath)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause)
      return err(`${sourcePath}: could not be read (${reason})`)
    }

    targets.push({
      entry,
      destination,
      contents,
      sha256: createHash('sha256').update(contents).digest('hex'),
    })
  }

  return ok(targets)
}

/** Reads the previous lock, if there is a readable one; a corrupt lock is simply replaced. */
function readPreviousLock(lockPath: string): LauncherCoreLock | undefined {
  if (!existsSync(lockPath)) return undefined
  try {
    return parseLauncherCoreLock(readFileSync(lockPath, 'utf8'))
  } catch {
    return undefined
  }
}

/** Writes only when the bytes on disk differ, so an unchanged re-run touches no file (AC6). */
function writeIfChanged(destination: string, contents: Buffer): boolean {
  if (existsSync(destination) && readFileSync(destination).equals(contents)) return false

  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
  return true
}

/**
 * Deletes everything under `mirrorRoot` that the manifest does not declare, so a file dropped
 * from the manifest does not linger. Symlinks are removed rather than followed, and directories
 * that end up empty are removed too. Every deletion is inside `mirrorRoot` by construction and
 * asserted again before it happens.
 */
function pruneUndeclared(mirrorRoot: string, declared: ReadonlySet<string>): number {
  if (!existsSync(mirrorRoot)) return 0

  let pruned = 0

  function walk(directory: string): number {
    let remaining = 0

    for (const dirent of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, dirent.name)
      if (!isInside(mirrorRoot, entryPath)) {
        remaining += 1
        continue
      }

      if (dirent.isDirectory() && !dirent.isSymbolicLink()) {
        const kept = walk(entryPath)
        if (kept === 0) {
          rmdirSync(entryPath)
          continue
        }
        remaining += kept
        continue
      }

      if (declared.has(entryPath)) {
        remaining += 1
        continue
      }

      // `recursive` also covers a symlinked directory, which plain unlink cannot remove on
      // Windows; `fs.rm` never follows the link, so only the link itself goes.
      rmSync(entryPath, { force: true, recursive: true })
      pruned += 1
    }

    return remaining
  }

  walk(mirrorRoot)
  return pruned
}

export interface SyncSummary {
  readonly commit: string
  readonly copied: number
  readonly unchanged: number
  readonly pruned: number
  readonly lockPath: string
  readonly lockChanged: boolean
}

/**
 * Runs one sync. Everything fallible happens before the mutation phase at the bottom; by then
 * the launcher checkout is validated, every source file is in memory and every destination is
 * known to be inside `studio/src/launcher-core/`.
 */
export function sync(launcherPath: string, repoRoot: string, now: Date): Result<SyncSummary> {
  const paths = resolveSyncPaths(repoRoot)
  if (!paths.ok) return paths
  const { mirrorRoot, lockPath } = paths.value

  const preflight = runPreflight(launcherPath)
  if (!preflight.ok) return err(`${preflight.path}: ${preflight.problem}`)

  const sources = readSources(launcherPath, repoRoot, mirrorRoot)
  if (!sources.ok) return sources
  const targets = sources.value

  const previousLock = readPreviousLock(lockPath)
  const lockFiles: LauncherCoreLockFileEntry[] = targets.map((target) => ({
    source: target.entry.source,
    mirror: target.entry.mirror,
    sha256: target.sha256,
  }))
  const lock = buildLauncherCoreLock({
    commit: preflight.commit,
    files: lockFiles,
    syncedAt: now.toISOString(),
    previousLock,
  })
  const lockText = serialiseLauncherCoreLock(lock)

  // --- mutation phase ---
  const pruned = pruneUndeclared(mirrorRoot, new Set(targets.map((target) => target.destination)))

  let copied = 0
  for (const target of targets) {
    if (writeIfChanged(target.destination, target.contents)) copied += 1
  }

  const lockChanged = writeIfChanged(lockPath, Buffer.from(lockText, 'utf8'))

  return ok({
    commit: preflight.commit,
    copied,
    unchanged: targets.length - copied,
    pruned,
    lockPath,
    lockChanged,
  })
}

function main(): void {
  const parsed = parseArguments(process.argv.slice(2))
  if (!parsed.ok) {
    console.error(parsed.error)
    process.exitCode = 1
    return
  }

  const repoRoot = resolveRepoRoot(process.cwd())
  if (!repoRoot.ok) {
    console.error(repoRoot.error)
    process.exitCode = 1
    return
  }

  const result = sync(parsed.value, repoRoot.value, new Date())
  if (!result.ok) {
    console.error(result.error)
    process.exitCode = 1
    return
  }

  const { commit, copied, unchanged, pruned, lockPath, lockChanged } = result.value
  console.log(
    `Synced ${MIRROR_ROOT_RELATIVE_PATH}/ from launcher commit ${commit}: ` +
      `${copied} written, ${unchanged} unchanged, ${pruned} pruned.`,
  )
  console.log(`Lock: ${lockPath} (${lockChanged ? 'updated' : 'unchanged'}).`)
}

main()
