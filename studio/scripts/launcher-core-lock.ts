/**
 * Builds, serialises and parses `studio/launcher-core.lock.json` — the record of which launcher
 * commit the mirror under `studio/src/launcher-core/` was copied from, and the SHA-256 of every
 * copied file.
 *
 * Determinism matters here: the sync command (story 005, D3) re-runs against an unchanged
 * launcher checkout and must leave the working tree untouched (AC6), so the lock has to
 * serialise byte-identically for identical input, and `syncedAt` has to carry over from the
 * previous lock whenever nothing else changed.
 */

export const LAUNCHER_CORE_LOCK_SCHEMA_VERSION = 1

export interface LauncherCoreLockFileEntry {
  readonly source: string
  readonly mirror: string
  readonly sha256: string
}

export interface LauncherCoreLock {
  readonly schemaVersion: number
  readonly launcher: {
    readonly commit: string
    readonly syncedAt: string
  }
  readonly files: readonly LauncherCoreLockFileEntry[]
}

export interface BuildLauncherCoreLockInput {
  /** The launcher's git HEAD sha the copy came from. */
  readonly commit: string
  /** Per-file record: source path, mirror path, and the SHA-256 of the copied bytes. */
  readonly files: readonly LauncherCoreLockFileEntry[]
  /**
   * ISO date string to use for `syncedAt` if this build turns out to differ from
   * `previousLock` (new commit, or any changed/added/removed file). Ignored otherwise.
   */
  readonly syncedAt: string
  /** The previously written lock, if any — used to decide whether `syncedAt` carries over. */
  readonly previousLock?: LauncherCoreLock
}

function sortByMirrorPath(
  files: readonly LauncherCoreLockFileEntry[],
): LauncherCoreLockFileEntry[] {
  return [...files].sort((a, b) => a.mirror.localeCompare(b.mirror))
}

function filesAreUnchanged(
  a: readonly LauncherCoreLockFileEntry[],
  b: readonly LauncherCoreLockFileEntry[],
): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (entry, index) =>
      entry.source === b[index].source &&
      entry.mirror === b[index].mirror &&
      entry.sha256 === b[index].sha256,
  )
}

/**
 * Builds the lock content for a sync run. Carries `syncedAt` over from `previousLock` when the
 * commit and every file entry (source, mirror, sha256) are unchanged from it — that is what
 * lets an idempotent re-run leave the working tree untouched (AC6).
 */
export function buildLauncherCoreLock(input: BuildLauncherCoreLockInput): LauncherCoreLock {
  const sortedFiles = sortByMirrorPath(input.files)

  const unchanged =
    input.previousLock !== undefined &&
    input.previousLock.launcher.commit === input.commit &&
    filesAreUnchanged(input.previousLock.files, sortedFiles)

  const syncedAt = unchanged ? input.previousLock.launcher.syncedAt : input.syncedAt

  return {
    schemaVersion: LAUNCHER_CORE_LOCK_SCHEMA_VERSION,
    launcher: {
      commit: input.commit,
      syncedAt,
    },
    files: sortedFiles,
  }
}

/**
 * Serialises the lock to the exact bytes written to disk: stable key order, files sorted by
 * mirror path, two-space indent, trailing newline.
 */
export function serialiseLauncherCoreLock(lock: LauncherCoreLock): string {
  const ordered = {
    schemaVersion: lock.schemaVersion,
    launcher: {
      commit: lock.launcher.commit,
      syncedAt: lock.launcher.syncedAt,
    },
    files: sortByMirrorPath(lock.files).map((file) => ({
      source: file.source,
      mirror: file.mirror,
      sha256: file.sha256,
    })),
  }

  return `${JSON.stringify(ordered, null, 2)}\n`
}

/** Parses a previously written lock file's text back into a {@link LauncherCoreLock}. */
export function parseLauncherCoreLock(text: string): LauncherCoreLock {
  const parsed = JSON.parse(text) as LauncherCoreLock
  return parsed
}
