import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Repo root is two levels up from studio/tests/.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${repoRoot.replace(/\\/g, '/')}/`), 'utf8')
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' })
}

function isGitIgnored(pathFromRoot: string): boolean {
  try {
    execFileSync('git', ['check-ignore', '--', pathFromRoot], { cwd: repoRoot, encoding: 'utf8' })
    return true
  } catch (error) {
    // `git check-ignore` exits 1 when the path is NOT ignored.
    const status = (error as { status?: number }).status
    if (status === 1) return false
    throw error
  }
}

describe('repository contract', () => {
  it('AC5: the profile Verify block names real commands, and the manifests back them up', () => {
    const profile = readRepoFile('.claude/ai-scrum.md')
    const verifySection = profile.split('## Verify')[1]?.split(/\n## /)[0]
    expect(verifySection).toBeDefined()

    for (const key of ['build', 'test', 'lint', 'typecheck']) {
      const line = verifySection
        .split('\n')
        .find((candidate) => candidate.trim().startsWith(`${key}:`))
      expect(line, `expected a "${key}:" line in the Verify block`).toBeDefined()
      const value = line!.slice(line!.indexOf(':') + 1).trim()
      expect(value).not.toBe('none')
      expect(value.length).toBeGreaterThan(0)
    }

    const studioManifest = JSON.parse(readRepoFile('studio/package.json')) as {
      scripts?: Record<string, string>
    }
    const scripts = studioManifest.scripts ?? {}

    expect(scripts.build).toMatch(/vite/)
    expect(scripts.test).toMatch(/vitest/)
    expect(scripts.lint).toMatch(/eslint|prettier/)
    expect(scripts.typecheck).toMatch(/tsc/)
  })

  it('AC6: node_modules and build output are ignored, and studio/src is tracked', () => {
    expect(isGitIgnored('studio/node_modules')).toBe(true)
    // Trailing slash: the .gitignore entry is directory-only, and the directory does not
    // necessarily exist on disk, so git needs the explicit hint that this is a directory.
    expect(isGitIgnored('studio/dist/')).toBe(true)

    // `--cached` (already tracked) plus `--others --exclude-standard` (trackable, not yet
    // committed) covers both a fresh checkout and a story still in progress before its
    // per-story commit — either way, git's own view of "would this be tracked" is authoritative.
    const trackableSrcFiles = git([
      'ls-files',
      '--cached',
      '--others',
      '--exclude-standard',
      'studio/src',
    ])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(trackableSrcFiles.length).toBeGreaterThan(0)

    for (const file of trackableSrcFiles) {
      expect(isGitIgnored(file)).toBe(false)
    }
  })

  it('AC7: the published surface is unchanged against the branch base', () => {
    const mergeBase = git(['merge-base', 'HEAD', 'feature/studio']).trim()
    expect(mergeBase).toMatch(/^[0-9a-f]{40}$/)

    const publishedDirs = ['news', 'engines', 'gamedata', 'packs', 'mods', 'config_templates']

    const diffOutput = git(['diff', '--name-only', mergeBase, '--', ...publishedDirs])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(diffOutput).toEqual([])

    // `git diff` only reports committed/tracked changes against the merge-base — a brand-new
    // file dropped in one of these directories during the current story would not show up
    // there at all. Untracked additions must be caught too.
    const untrackedInPublishedSurface = git([
      'ls-files',
      '--others',
      '--exclude-standard',
      '--',
      ...publishedDirs,
    ])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(untrackedInPublishedSurface).toEqual([])
  })
})
