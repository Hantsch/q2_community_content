/**
 * Story 010, D4: proof that `readContentRepo` / `readTemplateFile` never write to the working
 * tree they read (AC5). A throwaway git fixture proves it for a seeded repo, and a second case
 * proves the same for the real checkout these tests run in.
 */
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { readContentRepo, readTemplateFile } from '../src/content-repo/read-content-repo'
import { resolveRepoRoot } from '../src/content-repo/paths'
import { createGitFixture, type GitFixture } from './git-fixture'

function gitStatusPorcelain(cwd: string): string {
  return execFileSync('git', ['status', '--porcelain'], { cwd, encoding: 'utf8' })
}

let fixture: GitFixture | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
})

describe('reading leaves the working tree untouched', () => {
  it('a seeded fixture repo reports the same git status before and after a full read', () => {
    fixture = createGitFixture()

    fixture.writeFile(
      'news/index.json',
      JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            { id: 'first-post', file: '2026-01-01-first-post.md', order: 10 },
            { id: 'nested-post', file: 'nested/2026-01-02-nested-post.md', order: 20 },
          ],
        },
        null,
        2,
      ),
    )
    fixture.writeFile('news/2026-01-01-first-post.md', '# First post\n')
    fixture.writeFile('news/nested/2026-01-02-nested-post.md', '# Nested post\n')
    fixture.writeFile('news/2026-01-03-unnamed-draft.md', '# Draft\n')
    fixture.writeFile('news/nested/2026-01-04-nested-draft.md', '# Nested draft\n')
    fixture.writeFile('news/img/notes.md', '# Not walked, lives under img/\n')
    fixture.writeFile('news/_templates/text/template.md', '# Template\n')
    fixture.commitAll()

    const before = gitStatusPorcelain(fixture.dir)

    const read = readContentRepo({ repoRoot: fixture.dir })
    expect(read.findings).toEqual([])
    const template = readTemplateFile('text/template.md', { repoRoot: fixture.dir })
    expect(template.ok).toBe(true)

    const after = gitStatusPorcelain(fixture.dir)

    expect(after).toBe(before)
  })

  it('the real repository root reports the same git status before and after a default read', () => {
    const repoRoot = resolveRepoRoot()

    const before = gitStatusPorcelain(repoRoot)

    readContentRepo()

    const after = gitStatusPorcelain(repoRoot)

    expect(after).toBe(before)
  })
})
