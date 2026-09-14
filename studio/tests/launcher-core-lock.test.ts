import { describe, expect, it } from 'vitest'
import {
  buildLauncherCoreLock,
  parseLauncherCoreLock,
  serialiseLauncherCoreLock,
  type LauncherCoreLockFileEntry,
} from '../scripts/launcher-core-lock'

const commit = 'a'.repeat(40)
const otherCommit = 'b'.repeat(40)

const files: LauncherCoreLockFileEntry[] = [
  {
    source: 'src/shared/modules/home.ts',
    mirror: 'studio/src/launcher-core/src/shared/modules/home.ts',
    sha256: '1'.repeat(64),
  },
  {
    source: 'src/main/modules/home/news/feed-pipeline.ts',
    mirror: 'studio/src/launcher-core/src/main/modules/home/news/feed-pipeline.ts',
    sha256: '2'.repeat(64),
  },
]

describe('launcher-core-lock', () => {
  it('the lock records both paths, a SHA-256, the launcher commit and the sync date', () => {
    const syncedAt = '2026-09-13T00:00:00.000Z'
    const lock = buildLauncherCoreLock({ commit, files, syncedAt })

    expect(lock.launcher.commit).toBe(commit)
    expect(lock.launcher.syncedAt).toBe(syncedAt)
    expect(lock.files).toHaveLength(files.length)

    for (const original of files) {
      const recorded = lock.files.find((entry) => entry.mirror === original.mirror)
      expect(recorded).toBeDefined()
      expect(recorded?.source).toBe(original.source)
      expect(recorded?.sha256).toBe(original.sha256)
      expect(recorded?.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('serialises byte-identically for identical input', () => {
    const syncedAt = '2026-09-13T00:00:00.000Z'
    const lockA = buildLauncherCoreLock({ commit, files, syncedAt })
    const lockB = buildLauncherCoreLock({ commit, files: [...files].reverse(), syncedAt })

    const serialisedA = serialiseLauncherCoreLock(lockA)
    const serialisedB = serialiseLauncherCoreLock(lockB)

    expect(serialisedA).toBe(serialisedB)
    expect(serialisedA.endsWith('\n')).toBe(true)
    expect(serialisedA.endsWith('\n\n')).toBe(false)
  })

  it('files are sorted by mirror path in the serialised output', () => {
    const syncedAt = '2026-09-13T00:00:00.000Z'
    const lock = buildLauncherCoreLock({ commit, files: [...files].reverse(), syncedAt })
    const mirrors = lock.files.map((entry) => entry.mirror)
    expect(mirrors).toEqual([...mirrors].sort((a, b) => a.localeCompare(b)))
  })

  it('preserves syncedAt across an unchanged rebuild', () => {
    const firstSyncedAt = '2026-09-13T00:00:00.000Z'
    const lockA = buildLauncherCoreLock({ commit, files, syncedAt: firstSyncedAt })

    const secondSyncedAt = '2026-09-14T00:00:00.000Z'
    const rebuilt = buildLauncherCoreLock({
      commit,
      files,
      syncedAt: secondSyncedAt,
      previousLock: lockA,
    })

    expect(rebuilt.launcher.syncedAt).toBe(firstSyncedAt)
    expect(serialiseLauncherCoreLock(rebuilt)).toBe(serialiseLauncherCoreLock(lockA))
  })

  it('a changed hash produces a new syncedAt', () => {
    const firstSyncedAt = '2026-09-13T00:00:00.000Z'
    const lockA = buildLauncherCoreLock({ commit, files, syncedAt: firstSyncedAt })

    const changedFiles = files.map((file, index) =>
      index === 0 ? { ...file, sha256: '9'.repeat(64) } : file,
    )
    const secondSyncedAt = '2026-09-14T00:00:00.000Z'
    const rebuilt = buildLauncherCoreLock({
      commit,
      files: changedFiles,
      syncedAt: secondSyncedAt,
      previousLock: lockA,
    })

    expect(rebuilt.launcher.syncedAt).toBe(secondSyncedAt)
    expect(rebuilt.launcher.syncedAt).not.toBe(firstSyncedAt)
  })

  it('a changed commit produces a new syncedAt', () => {
    const firstSyncedAt = '2026-09-13T00:00:00.000Z'
    const lockA = buildLauncherCoreLock({ commit, files, syncedAt: firstSyncedAt })

    const secondSyncedAt = '2026-09-14T00:00:00.000Z'
    const rebuilt = buildLauncherCoreLock({
      commit: otherCommit,
      files,
      syncedAt: secondSyncedAt,
      previousLock: lockA,
    })

    expect(rebuilt.launcher.syncedAt).toBe(secondSyncedAt)
    expect(rebuilt.launcher.syncedAt).not.toBe(firstSyncedAt)
  })

  it('serialise and parse round-trip to an equivalent lock', () => {
    const syncedAt = '2026-09-13T00:00:00.000Z'
    const lock = buildLauncherCoreLock({ commit, files, syncedAt })
    const parsed = parseLauncherCoreLock(serialiseLauncherCoreLock(lock))

    expect(parsed).toEqual(lock)
  })
})
