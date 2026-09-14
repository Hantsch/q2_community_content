import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { checkDrift } from '../scripts/drift'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

interface FixtureFile {
  readonly mirror: string
  readonly content: string
}

/** Builds `<tmp>/studio/launcher-core.lock.json` and `<tmp>/studio/src/launcher-core/...` for the given files. */
function buildFixture(repoRoot: string, files: readonly FixtureFile[]): void {
  const mirrorRoot = join(repoRoot, 'studio', 'src', 'launcher-core')
  mkdirSync(mirrorRoot, { recursive: true })

  for (const file of files) {
    const absolutePath = join(repoRoot, ...file.mirror.split('/'))
    mkdirSync(join(absolutePath, '..'), { recursive: true })
    writeFileSync(absolutePath, file.content)
  }

  const lock = {
    schemaVersion: 1,
    launcher: { commit: 'a'.repeat(40), syncedAt: '2026-09-13T00:00:00.000Z' },
    files: files.map((file) => ({
      source: file.mirror.replace('studio/src/launcher-core/', ''),
      mirror: file.mirror,
      sha256: sha256(file.content),
    })),
  }

  mkdirSync(join(repoRoot, 'studio'), { recursive: true })
  writeFileSync(join(repoRoot, 'studio', 'launcher-core.lock.json'), JSON.stringify(lock, null, 2))
}

describe('checkDrift', () => {
  let repoRoot: string | undefined

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true })
      repoRoot = undefined
    }
  })

  it('a clean mirror matching the lock returns ok: true with no findings', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-core-clean-'))
    buildFixture(repoRoot, [
      {
        mirror: 'studio/src/launcher-core/src/shared/modules/home.ts',
        content: 'export const home = 1\n',
      },
      {
        mirror: 'studio/src/launcher-core/src/renderer/src/styles/index.css',
        content: 'body { margin: 0; }\n',
      },
    ])

    const report = checkDrift({ repoRoot })

    expect(report.ok).toBe(true)
    expect(report.findings).toEqual([])
    expect(report.skippedLauncherCompare).toBe(true)
    expect(report.lock?.fileCount).toBe(2)
  })

  it('a locally edited mirrored file is reported by name', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-core-edited-'))
    const editedMirror = 'studio/src/launcher-core/src/shared/modules/home.ts'
    buildFixture(repoRoot, [{ mirror: editedMirror, content: 'export const home = 1\n' }])

    // Edit the mirrored file's bytes after the lock was built, so its hash no longer matches.
    writeFileSync(
      join(repoRoot, ...editedMirror.split('/')),
      'export const home = 2 // edited locally\n',
    )

    const report = checkDrift({ repoRoot })

    expect(report.ok).toBe(false)
    const finding = report.findings.find((f) => f.file === editedMirror)
    expect(finding).toBeDefined()
    expect(finding?.kind).toBe('locally-edited')
  })

  it('a file on disk that the lock does not list, and a lock entry with no file, are both reported', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-core-mismatch-'))
    const trackedMirror = 'studio/src/launcher-core/src/shared/modules/home.ts'
    const missingMirror = 'studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts'
    const untrackedMirror = 'studio/src/launcher-core/src/renderer/src/styles/index.css'

    // Build the fixture with the tracked file and the entry whose file we deliberately never create.
    buildFixture(repoRoot, [{ mirror: trackedMirror, content: 'export const home = 1\n' }])

    // Manually add a lock entry that has no corresponding file on disk.
    const lockPath = join(repoRoot, 'studio', 'launcher-core.lock.json')
    const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as {
      files: { source: string; mirror: string; sha256: string }[]
    }
    lock.files.push({
      source: 'src/main/modules/home/news/frontmatter.ts',
      mirror: missingMirror,
      sha256: 'f'.repeat(64),
    })
    writeFileSync(lockPath, JSON.stringify(lock, null, 2))

    // Add a file on disk that is not listed in the lock at all.
    const untrackedAbsolutePath = join(repoRoot, ...untrackedMirror.split('/'))
    mkdirSync(join(untrackedAbsolutePath, '..'), { recursive: true })
    writeFileSync(untrackedAbsolutePath, 'body { margin: 0; }\n')

    const report = checkDrift({ repoRoot })

    expect(report.ok).toBe(false)

    const notOnDisk = report.findings.find((f) => f.file === missingMirror)
    expect(notOnDisk).toBeDefined()
    expect(notOnDisk?.kind).toBe('not-on-disk')

    const notInLock = report.findings.find((f) => f.file === untrackedMirror)
    expect(notInLock).toBeDefined()
    expect(notInLock?.kind).toBe('not-in-lock')
  })
})
