import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { launcherCoreManifest } from '../scripts/launcher-core.manifest'
import { runPreflight } from '../scripts/launcher-preflight'
import { createGitFixture, type GitFixture } from './git-fixture'

// One representative declared entry is enough to exercise "declared file missing" and
// "declared file dirty" generically; a real sync iterates the full list (D3's job).
const [firstDeclared] = launcherCoreManifest

function toNativePath(launcherRelativePath: string): string {
  return join(...launcherRelativePath.split('/'))
}

let fixture: GitFixture | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
})

describe('launcher preflight', () => {
  it('a missing path, a non-git path and a missing declared file each fail naming the path', () => {
    const missingPath = join(process.cwd(), 'does-not-exist-launcher-checkout')
    const missingResult = runPreflight(missingPath)
    expect(missingResult.ok).toBe(false)
    if (!missingResult.ok) {
      expect(missingResult.path).toBe(missingPath)
      expect(missingResult.problem).toMatch(/exist/)
    }

    // The OS temp root is not, in practice, itself a git work tree.
    const nonGitResult = runPreflight(tmpdir())
    expect(nonGitResult.ok).toBe(false)
    if (!nonGitResult.ok) {
      expect(nonGitResult.problem).toMatch(/git/)
    }

    fixture = createGitFixture()
    for (const { source } of launcherCoreManifest) {
      if (source !== firstDeclared.source) fixture.writeFile(source, 'declared file content')
    }
    fixture.commitAll()
    // firstDeclared is never written, so it is missing.
    const missingDeclaredResult = runPreflight(fixture.dir)
    expect(missingDeclaredResult.ok).toBe(false)
    if (!missingDeclaredResult.ok) {
      expect(missingDeclaredResult.path).toContain(toNativePath(firstDeclared.source))
      expect(missingDeclaredResult.problem).toMatch(/missing/)
    }
  })

  it('a non-directory path fails naming the path', () => {
    fixture = createGitFixture()
    fixture.writeFile('a-file.txt', 'not a directory')
    fixture.commitAll()

    const notDirectoryPath = join(fixture.dir, 'a-file.txt')
    const result = runPreflight(notDirectoryPath)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.path).toBe(notDirectoryPath)
      expect(result.problem).toMatch(/directory/)
    }
  })

  it('an uncommitted change to a mirrored file aborts the sync', () => {
    fixture = createGitFixture()
    for (const { source } of launcherCoreManifest) {
      fixture.writeFile(source, `content for ${source}`)
    }
    fixture.commitAll()

    fixture.dirtyFile(firstDeclared.source, 'uncommitted edit')

    const result = runPreflight(fixture.dir)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.path).toContain(toNativePath(firstDeclared.source))
      expect(result.problem).toMatch(/uncommitted/)
    }
  })

  it('a clean checkout with every declared file present passes and returns the HEAD commit', () => {
    fixture = createGitFixture()
    for (const { source } of launcherCoreManifest) {
      fixture.writeFile(source, `content for ${source}`)
    }
    fixture.commitAll()

    const result = runPreflight(fixture.dir)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.commit).toBe(fixture.headSha())
      expect(result.commit).toMatch(/^[0-9a-f]{40}$/)
    }
  })
})
