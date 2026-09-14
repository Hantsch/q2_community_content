import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildMirrorFixture, createFixtureRoot } from './__fixtures__/build-mirror-fixture'
import { readMirrorProvenance } from './read-provenance'

describe('readMirrorProvenance', () => {
  let repoRoot: string | undefined

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true })
      repoRoot = undefined
    }
  })

  it('produces provenance from a lock copy with no git history and no launcher checkout', () => {
    repoRoot = createFixtureRoot()
    buildMirrorFixture(
      repoRoot,
      [
        {
          mirror: 'studio/src/launcher-core/src/shared/modules/home.ts',
          content: 'export const home = 1\n',
        },
        {
          mirror: 'studio/src/launcher-core/src/renderer/src/styles/index.css',
          content: 'body { margin: 0; }\n',
        },
      ],
      { commit: 'a41b3acab4bd3a089f8a04594fff81556fbd6f8a', syncedAt: '2026-09-01T00:00:00.000Z' },
    )

    const provenance = readMirrorProvenance(repoRoot)

    expect(provenance.verdict).toBe('in-sync')
    expect(provenance.launcherCommit).toBe('a41b3acab4bd3a089f8a04594fff81556fbd6f8a')
    expect(provenance.launcherCommitShort).toBe('a41b3acab4bd')
    expect(provenance.fileCount).toBe(2)
    expect(provenance.mismatchedFiles).toEqual([])

    // Proves the read path never looked for a git repository: there is none anywhere in the
    // fixture, and yet provenance was produced.
    expect(existsSync(join(repoRoot, '.git'))).toBe(false)
  })

  it('a missing lock file is provenance unknown, not a clean mirror', () => {
    repoRoot = createFixtureRoot()
    mkdirSync(join(repoRoot, 'studio'), { recursive: true })

    const provenance = readMirrorProvenance(repoRoot)

    expect(provenance.verdict).toBe('unknown')
    expect(provenance.reason).toBeTruthy()
  })

  it('a truncated/unparseable lock file is provenance unknown, not a clean mirror', () => {
    repoRoot = createFixtureRoot()
    mkdirSync(join(repoRoot, 'studio'), { recursive: true })
    writeFileSync(
      join(repoRoot, 'studio', 'launcher-core.lock.json'),
      '{ "schemaVersion": 1, "launcher": { "commit": "abc"',
    )

    const provenance = readMirrorProvenance(repoRoot)

    expect(provenance.verdict).toBe('unknown')
    expect(provenance.reason).toBeTruthy()
  })
})
