/**
 * Story 024, D4 (AC8): saving touches the working tree and nothing else.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, test } from 'vitest'

import { createFileBridge } from '../src/bridge/create-file-bridge'
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

const FORBIDDEN = /^(node:)?(child_process|http|https|net)$|git/i

describe('save path isolation', () => {
  let fixture: GitFixture | undefined
  afterEach(() => fixture?.cleanup())

  test('a save runs no git operation and opens no network client', async () => {
    // The scan covers the write path only: write-files.ts, the browser client and the authoring
    // modules. `create-file-bridge.ts` and `file-bridge-plugin.ts` are the dev-server side and
    // legitimately import `node:http` types (and vite), so they are outside this scan.
    const scanned = [
      join(srcRoot, 'bridge', 'write-files.ts'),
      join(srcRoot, 'bridge', 'client.ts'),
      ...sourceFiles(join(srcRoot, 'authoring')),
    ]
    expect(scanned.length).toBeGreaterThanOrEqual(2)
    for (const file of scanned) {
      const offending = importedModules(readFileSync(file, 'utf8')).filter((specifier) =>
        FORBIDDEN.test(specifier),
      )
      expect(offending, relative(srcRoot, file)).toEqual([])
    }

    // Driving a real save against a real git repo leaves every git state untouched except the
    // one working-tree file.
    fixture = createGitFixture()
    fixture.writeFile('news/a.md', 'old\n')
    fixture.writeFile('news/b.md', 'other\n')
    fixture.commitAll()
    const git = (...args: string[]): string =>
      execFileSync('git', args, { cwd: fixture?.dir, encoding: 'utf8' })
    const state = () => [git('rev-parse', 'HEAD'), git('diff', '--cached'), git('stash', 'list')]
    const before = state()

    const middleware = createFileBridge({
      repoRoot: fixture.dir,
      directories: ['news'],
      writableDirectories: ['news'],
    })
    const server = createServer((req, res) => middleware(req, res, () => res.end()))
    await new Promise<void>((resolvePromise) => server.listen(0, '127.0.0.1', resolvePromise))
    try {
      const port = (server.address() as AddressInfo).port
      const response = await fetch(`http://127.0.0.1:${port}/__studio/fs/write`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: JSON.stringify({ writes: [{ path: 'news/a.md', text: 'new\n', expected: 'old\n' }] }),
      })
      expect(response.status).toBe(200)
    } finally {
      await new Promise<void>((resolvePromise) => server.close(() => resolvePromise()))
    }

    expect(state()).toEqual(before)
    expect(git('status', '--porcelain').trim()).toBe('M news/a.md')
  })
})
