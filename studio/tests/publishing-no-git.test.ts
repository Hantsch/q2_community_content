/**
 * Story 027 D2 (AC8): reordering, publishing and unpublishing touch the working tree and nothing
 * else. Mirrors `save-no-git-no-network.test.ts`: a static import scan plus real batches through
 * the real bridge against a real git repository.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'

import type { BridgeWriteItem } from '../src/bridge/bridge-protocol'
import { createFileBridge } from '../src/bridge/create-file-bridge'
import * as imageRules from '../src/contract/launcher-safe-names'
import { createGitFixture, type GitFixture } from './git-fixture'

const srcRoot = fileURLToPath(new URL('../src', import.meta.url))

function sourceFiles(directory: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return []
  }
  return entries.flatMap((entry) => {
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) {
      return sourceFiles(full)
    }
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

function importedModules(source: string): string[] {
  const specifiers: string[] = []
  const pattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm
  for (let match = pattern.exec(source); match !== null; match = pattern.exec(source)) {
    specifiers.push(match[1] ?? '')
  }
  return specifiers
}

/** No subprocess and no git library. (The dev-server side of the bridge legitimately imports
 * `node:http` types, so network modules are not part of this scan; see the save test.) */
const FORBIDDEN = /^(node:)?child_process$|git/i

const INDEX = (...ids: string[]): string =>
  `${JSON.stringify({ entries: ids.map((id) => ({ id, file: `${id}.md` })) }, null, 2)}\n`

describe('publishing path isolation', () => {
  let fixture: GitFixture | undefined
  afterEach(() => fixture?.cleanup())

  test('reorder, publish and unpublish leave HEAD, the git index and the remotes untouched', async () => {
    const bridgeFiles = sourceFiles(join(srcRoot, 'bridge'))
    const publishingFiles = sourceFiles(join(srcRoot, 'publishing'))
    expect(bridgeFiles.map((file) => relative(srcRoot, file))).toContain(
      join('bridge', 'client.ts'),
    )
    expect(publishingFiles.length).toBeGreaterThan(0)
    for (const file of [...bridgeFiles, ...publishingFiles]) {
      const offending = importedModules(readFileSync(file, 'utf8')).filter((specifier) =>
        FORBIDDEN.test(specifier),
      )
      expect(offending, relative(srcRoot, file)).toEqual([])
    }

    fixture = createGitFixture()
    fixture.writeFile('news/index.json', INDEX('a', 'b'))
    fixture.writeFile('news/a.md', '---\ntitle: A\n---\nold a\n')
    fixture.writeFile('news/b.md', '---\ntitle: B\n---\nold b\n')
    fixture.writeFile('news/c.md', '---\ntitle: C\n---\ndraft c\n')
    fixture.commitAll()
    const dir = fixture.dir
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
    git('remote', 'add', 'origin', 'https://example.invalid/q2_community_content.git')
    const state = () => ({
      head: git('rev-parse', 'HEAD'),
      index: git('ls-files', '--stage'),
      cached: git('diff', '--cached', '--name-only'),
      stash: git('stash', 'list'),
      remotes: git('remote', '-v'),
    })
    const before = state()

    const middleware = createFileBridge({
      repoRoot: dir,
      directories: ['news'],
      writableDirectories: ['news'],
      imageRules,
    })
    const server = createServer((req, res) => middleware(req, res, () => res.end()))
    await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
    const port = (server.address() as AddressInfo).port
    const batch = async (files: BridgeWriteItem[]): Promise<number> => {
      const response = await fetch(`http://127.0.0.1:${port}/__studio/fs/write-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ files }),
      })
      return response.status
    }
    const read = (path: string): string => readFileSync(join(dir, path), 'utf8')

    try {
      // Reorder: index + two .md.
      expect(
        await batch([
          { path: 'news/index.json', text: INDEX('b', 'a'), expected: read('news/index.json') },
          {
            path: 'news/a.md',
            text: '---\ntitle: A\norder: 2\n---\nold a\n',
            expected: read('news/a.md'),
          },
          {
            path: 'news/b.md',
            text: '---\ntitle: B\norder: 1\n---\nold b\n',
            expected: read('news/b.md'),
          },
        ]),
      ).toBe(200)
      // Publish: index + .md.
      expect(
        await batch([
          {
            path: 'news/index.json',
            text: INDEX('b', 'a', 'c'),
            expected: read('news/index.json'),
          },
          {
            path: 'news/c.md',
            text: '---\ntitle: C\npublished: true\n---\ndraft c\n',
            expected: read('news/c.md'),
          },
        ]),
      ).toBe(200)
      // Unpublish: index only.
      expect(
        await batch([
          { path: 'news/index.json', text: INDEX('b', 'c'), expected: read('news/index.json') },
        ]),
      ).toBe(200)
    } finally {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
    }

    expect(state()).toEqual(before)
    const porcelain = git('status', '--porcelain')
      .split('\n')
      .filter((line) => line !== '')
    // Staged column (first character) is blank for every entry: nothing was added to the index.
    expect(porcelain.map((line) => line[0])).toEqual([' ', ' ', ' ', ' '])
    expect(porcelain.map((line) => line.slice(3)).sort()).toEqual([
      'news/a.md',
      'news/b.md',
      'news/c.md',
      'news/index.json',
    ])
  })
})
