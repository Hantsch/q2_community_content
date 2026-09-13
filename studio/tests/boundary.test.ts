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

describe('repository boundary', () => {
  it('the README distinguishes the published surface from local tooling and names studio/ as never fetched', () => {
    const readme = readRepoFile('README.md')

    expect(readme).toContain('published surface')
    expect(readme).toContain('content only')
    expect(readme).toContain('studio/')
    expect(readme.toLowerCase()).toMatch(/never fetche?s?/)
  })

  it('the top-level layout block lists studio/ with a description', () => {
    const readme = readRepoFile('README.md')
    const layoutBlock = readme.split('## Top-level layout')[1]?.split(/\n## /)[0]
    expect(layoutBlock).toBeDefined()

    const studioLine = layoutBlock.split('\n').find((line) => line.trim().startsWith('studio/'))
    expect(studioLine, 'expected a "studio/" line in the top-level layout block').toBeDefined()
    expect(studioLine!.toLowerCase()).toContain('never fetched')
  })

  it('no repository-wide content-only claim remains in the README', () => {
    const readme = readRepoFile('README.md')

    expect(readme).not.toContain('carries no CSS, HTML, colours or layout of its own')

    const contentOnlySection = readme.split('### Content only')[1]?.split(/\n## /)[0]
    expect(contentOnlySection).toBeDefined()
    expect(contentOnlySection).toContain('published surface')
    expect(contentOnlySection).toContain('news/')
  })

  it('the contributor-facing rule still lists title, body, image, button labels and URLs and the visibility/order fields', () => {
    const readme = readRepoFile('README.md')
    const contentOnlySection = readme.split('### Content only')[1]?.split(/\n## /)[0]
    expect(contentOnlySection).toBeDefined()

    for (const anchor of ['title', 'body', 'image', 'button', 'URLs', 'visibility', 'order']) {
      expect(contentOnlySection.toLowerCase()).toContain(anchor.toLowerCase())
    }
  })

  it('the boundary statement is present in README.md, AGENTS.md and CLAUDE.md', () => {
    const readme = readRepoFile('README.md')
    const agents = readRepoFile('AGENTS.md')
    const claude = readRepoFile('CLAUDE.md')

    for (const doc of [readme, agents, claude]) {
      expect(doc).toContain('studio/')
      expect(doc.toLowerCase()).toMatch(/never fetche?s?/)
    }

    expect(agents).toContain('# Repository boundary')
  })

  it('the news contract is unchanged', () => {
    const readme = readRepoFile('README.md')

    for (const field of [
      'schemaVersion',
      'entries',
      'id',
      'file',
      'order',
      'visibleFrom',
      'visibleUntil',
    ]) {
      expect(readme).toContain(field)
    }

    for (const template of ['split', 'banner', 'text', 'cover']) {
      expect(readme).toContain(template)
    }

    expect(readme).toContain('Maximum 3 buttons')
    expect(readme).toContain('github.com')
    expect(readme).toContain('raw.githubusercontent.com')
    expect(readme).toContain('sorts entries ascending')
    expect(readme).toContain('is dropped on its own')

    const mergeBase = git(['merge-base', 'HEAD', 'feature/studio']).trim()
    expect(mergeBase).toMatch(/^[0-9a-f]{40}$/)

    const publishedDirs = ['news', 'engines', 'gamedata', 'packs', 'mods', 'config_templates']

    const diffOutput = git(['diff', '--name-only', mergeBase, '--', ...publishedDirs])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    expect(diffOutput).toEqual([])

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
