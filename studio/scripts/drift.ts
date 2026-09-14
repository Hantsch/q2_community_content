/**
 * Drift check for the `studio/src/launcher-core/` mirror (story 006, D1 + D2).
 *
 * Re-hashes every mirrored file recorded in `studio/launcher-core.lock.json` and compares it
 * against what is actually on disk and — when a launcher checkout is given — against that
 * checkout's current source. Read-only in both repositories, and never throws: every failure
 * mode becomes a finding.
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { parseLauncherCoreLock, type LauncherCoreLock } from './launcher-core-lock'
import { launcherCoreManifest } from './launcher-core.manifest'
import { launcherCheckoutProblem } from './launcher-preflight'

export type DriftFindingKind =
  | 'locally-edited'
  | 'stale'
  | 'not-in-lock'
  | 'not-on-disk'
  | 'lock-unreadable'
  | 'launcher-invalid'
  | 'launcher-source-missing'

export interface DriftFinding {
  /**
   * The path this finding is about, repository-relative — except for `launcher-invalid`, whose
   * subject is the launcher checkout path itself.
   */
  readonly file: string
  /**
   * The launcher-checkout-relative source path, set on every finding that came out of a
   * comparison against a launcher checkout. Together with `file` this names the file in both
   * repositories (AC2).
   */
  readonly launcherFile?: string
  readonly kind: DriftFindingKind
  readonly message: string
}

export interface DriftReport {
  readonly ok: boolean
  readonly skippedLauncherCompare: boolean
  readonly lock?: {
    readonly commit: string
    readonly syncedAt: string
    readonly fileCount: number
  }
  readonly findings: readonly DriftFinding[]
}

export interface CheckDriftInput {
  /** Repository root; the lock is read from `<repoRoot>/studio/launcher-core.lock.json`. */
  readonly repoRoot: string
  /**
   * Path to a launcher checkout. Left undefined, only the mirror-integrity checks run and
   * `skippedLauncherCompare` is set — that is the contributor-without-a-checkout path (AC3).
   */
  readonly launcherPath?: string
}

const LOCK_RELATIVE_PATH = 'studio/launcher-core.lock.json'
const MIRROR_ROOT_RELATIVE_PATH = 'studio/src/launcher-core'

function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Recursively lists every file under `root`, returned as paths relative to `root` with `/` separators. */
function listFilesRecursive(root: string): string[] {
  if (!existsSync(root)) return []

  const results: string[] = []

  function walk(dir: string): void {
    for (const entryName of readdirSync(dir)) {
      const fullPath = join(dir, entryName)
      const stats = statSync(fullPath)
      if (stats.isDirectory()) {
        walk(fullPath)
      } else if (stats.isFile()) {
        results.push(relative(root, fullPath).split(sep).join('/'))
      }
    }
  }

  walk(root)
  return results
}

/**
 * Checks the mirror under `studio/src/launcher-core/` against `studio/launcher-core.lock.json`
 * for drift: locally edited files, files on disk the lock doesn't know about, and lock entries
 * with no file on disk. With a `launcherPath`, each untouched mirrored file is additionally
 * compared against the launcher's current source, which is what tells a stale mirror apart from
 * an edited one. Read-only in both repositories — never writes, never throws (failures become
 * findings).
 */
export function checkDrift(input: CheckDriftInput): DriftReport {
  const { repoRoot } = input
  const skippedLauncherCompare = input.launcherPath === undefined

  const findings: DriftFinding[] = []

  // A path the caller gave is an assertion that a checkout is there: if it is not, that is a
  // hard failure, not a skip. Only the three checkout-level checks apply — a launcher with
  // uncommitted work is still worth comparing against, and a missing source file is a per-file
  // finding below, not a reason to abandon the whole run.
  let launcherRoot: string | undefined
  if (input.launcherPath !== undefined) {
    const problem = launcherCheckoutProblem(input.launcherPath)
    if (problem === undefined) {
      launcherRoot = input.launcherPath
    } else {
      findings.push({
        file: input.launcherPath,
        kind: 'launcher-invalid',
        message: `The launcher checkout at ${input.launcherPath} ${problem}.`,
      })
    }
  }

  const lockPath = join(repoRoot, ...LOCK_RELATIVE_PATH.split('/'))

  let lock: LauncherCoreLock
  try {
    if (!existsSync(lockPath)) {
      return {
        ok: false,
        skippedLauncherCompare,
        lock: undefined,
        findings: [
          ...findings,
          {
            file: LOCK_RELATIVE_PATH,
            kind: 'lock-unreadable',
            message: `Lock file not found at ${LOCK_RELATIVE_PATH}.`,
          },
        ],
      }
    }
    const lockText = readFileSync(lockPath, 'utf8')
    lock = parseLauncherCoreLock(lockText)
  } catch (error) {
    return {
      ok: false,
      skippedLauncherCompare,
      lock: undefined,
      findings: [
        ...findings,
        {
          file: LOCK_RELATIVE_PATH,
          kind: 'lock-unreadable',
          message: `Lock file at ${LOCK_RELATIVE_PATH} could not be parsed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    }
  }

  const lockMirrorPaths = new Set(lock.files.map((entry) => entry.mirror))
  const manifestSourceByMirror = new Map(
    launcherCoreManifest.map((entry) => [entry.mirror, entry.source]),
  )

  for (const entry of lock.files) {
    const mirrorAbsolutePath = join(repoRoot, ...entry.mirror.split('/'))
    if (!existsSync(mirrorAbsolutePath)) {
      findings.push({
        file: entry.mirror,
        kind: 'not-on-disk',
        message: `${entry.mirror} is in the lock but not on disk.`,
      })
      continue
    }

    const actualHash = sha256OfFile(mirrorAbsolutePath)
    if (actualHash !== entry.sha256) {
      // Disk having drifted from the lock proves a local edit, wherever the launcher stands:
      // this takes precedence over `stale`, and the two carry opposite remedies (AC6).
      findings.push({
        file: entry.mirror,
        kind: 'locally-edited',
        message: `${entry.mirror} has been locally edited: its hash no longer matches the lock.`,
      })
      continue
    }

    // The mirrored file is untouched. The only remaining question is whether the launcher has
    // moved on without it.
    const source = manifestSourceByMirror.get(entry.mirror)
    if (launcherRoot === undefined || source === undefined) continue

    const launcherSourcePath = join(launcherRoot, ...source.split('/'))
    if (!existsSync(launcherSourcePath)) {
      findings.push({
        file: entry.mirror,
        launcherFile: source,
        kind: 'launcher-source-missing',
        message: `${entry.mirror} cannot be compared: its source ${source} does not exist in the launcher checkout.`,
      })
      continue
    }

    if (sha256OfFile(launcherSourcePath) !== entry.sha256) {
      findings.push({
        file: entry.mirror,
        launcherFile: source,
        kind: 'stale',
        message: `${entry.mirror} is stale: it still matches the lock, but the launcher's ${source} has moved ahead.`,
      })
    }
  }

  const mirrorRootAbsolutePath = join(repoRoot, ...MIRROR_ROOT_RELATIVE_PATH.split('/'))
  const filesOnDisk = listFilesRecursive(mirrorRootAbsolutePath)
  for (const relativeFile of filesOnDisk) {
    const mirrorPath = `${MIRROR_ROOT_RELATIVE_PATH}/${relativeFile}`
    if (!lockMirrorPaths.has(mirrorPath)) {
      findings.push({
        file: mirrorPath,
        kind: 'not-in-lock',
        message: `${mirrorPath} is on disk but not in the lock.`,
      })
    }
  }

  return {
    ok: findings.length === 0,
    skippedLauncherCompare,
    lock: {
      commit: lock.launcher.commit,
      syncedAt: lock.launcher.syncedAt,
      fileCount: lock.files.length,
    },
    findings,
  }
}
