import { describe, expect, it } from 'vitest'

import type { LauncherCoreLock } from '../../scripts/launcher-core-lock'
import { describeMirror } from './provenance'

function buildLock(overrides?: Partial<LauncherCoreLock['launcher']>): LauncherCoreLock {
  return {
    schemaVersion: 1,
    launcher: {
      commit: 'a41b3acab4bd3a089f8a04594fff81556fbd6f8a',
      syncedAt: '2020-01-01T00:00:00.000Z',
      ...overrides,
    },
    files: [
      {
        source: 'src/shared/modules/home.ts',
        mirror: 'studio/src/launcher-core/src/shared/modules/home.ts',
        sha256: 'hash-home',
      },
      {
        source: 'src/renderer/src/styles/index.css',
        mirror: 'studio/src/launcher-core/src/renderer/src/styles/index.css',
        sha256: 'hash-styles',
      },
      {
        source: 'src/main/modules/home/news/frontmatter.ts',
        mirror: 'studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts',
        sha256: 'hash-frontmatter',
      },
    ],
  }
}

describe('describeMirror', () => {
  it('reports launcher commit, sync date, file count and verdict from the lock and the files on disk', () => {
    const lock = buildLock()
    const diskHashes: Record<string, string> = {
      'studio/src/launcher-core/src/shared/modules/home.ts': 'hash-home',
      'studio/src/launcher-core/src/renderer/src/styles/index.css': 'hash-styles',
      'studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts': 'hash-frontmatter',
    }

    const provenance = describeMirror(lock, diskHashes)

    expect(provenance.verdict).toBe('in-sync')
    expect(provenance.launcherCommit).toBe('a41b3acab4bd3a089f8a04594fff81556fbd6f8a')
    expect(provenance.launcherCommitShort).toBe('a41b3acab4bd')
    expect(provenance.syncedAt).toBe('2020-01-01T00:00:00.000Z')
    expect(provenance.fileCount).toBe(3)
    expect(provenance.mismatchedFiles).toEqual([])

    // ageInDays is a plain fact derived from syncedAt (which here is years in the past) and must
    // not gate the verdict — verdict stays in-sync purely because every hash matched.
    expect(typeof provenance.ageInDays).toBe('number')
    expect(provenance.ageInDays).toBeGreaterThan(300)
  })

  it('a mirrored file whose hash changed is reported as out of sync, naming the file', () => {
    const lock = buildLock()
    const diskHashes: Record<string, string> = {
      'studio/src/launcher-core/src/shared/modules/home.ts': 'hash-home-EDITED',
      'studio/src/launcher-core/src/renderer/src/styles/index.css': 'hash-styles',
      'studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts': 'hash-frontmatter',
    }

    const provenance = describeMirror(lock, diskHashes)

    expect(provenance.verdict).toBe('out-of-sync')
    expect(provenance.mismatchedFiles).toEqual([
      'studio/src/launcher-core/src/shared/modules/home.ts',
    ])
  })
})
