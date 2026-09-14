/**
 * Pure provenance reporting for the `studio/src/launcher-core/` mirror: given the committed lock
 * file (story 005) and the SHA-256 of every mirrored file as found on disk, states which launcher
 * commit the mirror came from and whether it still matches.
 *
 * This file must not import `node:fs`, `node:crypto` or anything else Node-only — it is imported
 * by browser code (the studio surface, story 009 D4) as well as the CLI (D3). Hashing the mirror
 * on disk is the caller's job (see `read-provenance.ts`).
 */

import type { LauncherCoreLock } from '../../scripts/launcher-core-lock'

/** The one vocabulary for mirror state: hash-based, never age-based. */
export type MirrorVerdict = 'in-sync' | 'out-of-sync' | 'unknown'

/**
 * The single place the printable wording for each verdict lives. Every place provenance is shown
 * (the drift CLI in D3, the studio surface in D4) imports these labels rather than restating them,
 * so AC4's "same wording in every place" holds by construction.
 */
export const VERDICT_LABELS: Record<MirrorVerdict, string> = {
  'in-sync': 'in sync',
  'out-of-sync': 'out of sync',
  unknown: 'unknown',
}

/** Length of {@link MirrorProvenance.launcherCommitShort} — decided (Decisions/Sprint), not configurable. */
const SHORT_COMMIT_LENGTH = 12

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface MirrorProvenance {
  readonly verdict: MirrorVerdict
  /** Full launcher commit SHA the mirror was copied from. */
  readonly launcherCommit: string
  /** First 12 characters of {@link launcherCommit}. */
  readonly launcherCommitShort: string
  /** ISO 8601 date string, passed through unchanged from the lock. */
  readonly syncedAt: string
  /** Whole days between `syncedAt` and now. A plain fact — never feeds into `verdict`. */
  readonly ageInDays: number
  readonly fileCount: number
  /** Mirror-relative paths of lock entries whose hash no longer matches, in lock file order. */
  readonly mismatchedFiles: string[]
  /** Set only for `verdict: 'unknown'`, e.g. "lock file missing". */
  readonly reason?: string
}

/**
 * Derives {@link MirrorProvenance} from a parsed lock and the SHA-256 hashes found on disk for its
 * mirrored files. Pure: no filesystem access, no throwing. The verdict is hash-based only — a lock
 * always yields `in-sync` or `out-of-sync` here, never `unknown` (that verdict is produced only by
 * the D2 reader when the lock itself can't be read).
 *
 * @param diskHashes Maps each lock entry's `mirror` path to the SHA-256 actually found on disk.
 *   A path absent from this map counts as a mismatch (file not found).
 */
export function describeMirror(
  lock: LauncherCoreLock,
  diskHashes: Record<string, string>,
): MirrorProvenance {
  const mismatchedFiles = lock.files
    .filter((entry) => diskHashes[entry.mirror] !== entry.sha256)
    .map((entry) => entry.mirror)

  const syncedAtMs = Date.parse(lock.launcher.syncedAt)
  const ageInDays = Number.isNaN(syncedAtMs)
    ? 0
    : Math.floor((Date.now() - syncedAtMs) / MS_PER_DAY)

  return {
    verdict: mismatchedFiles.length === 0 ? 'in-sync' : 'out-of-sync',
    launcherCommit: lock.launcher.commit,
    launcherCommitShort: lock.launcher.commit.slice(0, SHORT_COMMIT_LENGTH),
    syncedAt: lock.launcher.syncedAt,
    ageInDays,
    fileCount: lock.files.length,
    mismatchedFiles,
  }
}

/** Renders {@link MirrorProvenance} as plain text lines (no ANSI, no markup) for CLI output. */
export function formatProvenance(p: MirrorProvenance): string[] {
  const lines = [
    `Launcher mirror: commit ${p.launcherCommitShort}, synced ${p.syncedAt} (${p.ageInDays}d ago)`,
    `Mirrored files: ${p.fileCount}`,
    `Status: ${VERDICT_LABELS[p.verdict]}`,
  ]

  if (p.mismatchedFiles.length > 0) {
    lines.push(
      `${p.mismatchedFiles.length} file(s) out of sync (see findings below): ${p.mismatchedFiles.join(', ')}`,
    )
  }

  if (p.reason !== undefined) {
    lines.push(`Reason: ${p.reason}`)
  }

  return lines
}
