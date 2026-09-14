/**
 * Node-side reader for mirror provenance (story 009, D2): reads the committed
 * `studio/launcher-core.lock.json`, hashes every mirrored file it lists as found on disk, and
 * hands both to the pure `describeMirror` (D1).
 *
 * Must work in a fresh clone with only the committed lock file and the committed mirror tree —
 * no git history, no launcher checkout (AC5). Never throws: a missing or unparseable lock is
 * reported as `verdict: 'unknown'` with a `reason`, never a crash and never a false `in-sync`
 * (AC6). A single missing mirrored file is not a reason to fail the whole read either — it is
 * simply left out of `diskHashes`, which `describeMirror` already treats as a mismatch.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { parseLauncherCoreLock } from '../../scripts/launcher-core-lock'
import { describeMirror, type MirrorProvenance } from './provenance'

const LOCK_RELATIVE_PATH = 'studio/launcher-core.lock.json'

function unknownProvenance(reason: string): MirrorProvenance {
  return {
    verdict: 'unknown',
    launcherCommit: '',
    launcherCommitShort: '',
    syncedAt: '',
    ageInDays: 0,
    fileCount: 0,
    mismatchedFiles: [],
    reason,
  }
}

function sha256OfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * Reads mirror provenance from `<repoRoot>/studio/launcher-core.lock.json` and the mirror tree
 * on disk. Pure I/O plus delegation to `describeMirror` — never throws.
 */
export function readMirrorProvenance(repoRoot: string): MirrorProvenance {
  const lockPath = join(repoRoot, ...LOCK_RELATIVE_PATH.split('/'))

  if (!existsSync(lockPath)) {
    return unknownProvenance(`lock file not found at ${LOCK_RELATIVE_PATH}`)
  }

  let lockText: string
  try {
    lockText = readFileSync(lockPath, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return unknownProvenance(`lock file at ${LOCK_RELATIVE_PATH} could not be read: ${reason}`)
  }

  let lock: ReturnType<typeof parseLauncherCoreLock>
  try {
    lock = parseLauncherCoreLock(lockText)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return unknownProvenance(`lock file at ${LOCK_RELATIVE_PATH} could not be parsed: ${reason}`)
  }

  const diskHashes: Record<string, string> = {}
  for (const entry of lock.files) {
    const mirrorAbsolutePath = join(repoRoot, ...entry.mirror.split('/'))
    if (!existsSync(mirrorAbsolutePath)) continue

    try {
      diskHashes[entry.mirror] = sha256OfFile(mirrorAbsolutePath)
    } catch {
      // Unreadable mirrored file (e.g. a race, or a permissions quirk): treat it the same as
      // "not on disk" rather than aborting the whole read.
      continue
    }
  }

  return describeMirror(lock, diskHashes)
}
