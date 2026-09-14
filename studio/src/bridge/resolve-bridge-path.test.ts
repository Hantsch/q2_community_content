/**
 * Story 015, AC2. The fixture tree is built at runtime under `os.tmpdir()` - nothing here touches
 * the real checkout, and the escape link cannot be committed anyway (git on Windows cannot
 * represent a symlink, so it is created here as a directory junction on Windows and a symlink
 * elsewhere, which is the one form that needs no elevation on Windows).
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'

import { resolveBridgePath, type ResolveBridgePathResult } from './resolve-bridge-path'

let tmpRoot: string
let repoRoot: string
let outsideDir: string

const directories = ['news'] as const

function resolve(requestPath: string): ResolveBridgePathResult {
  return resolveBridgePath({ repoRoot, directories, requestPath })
}

/** Asserts the request was refused and hands back the reason, so each case can name what it hit. */
function refusalReason(requestPath: string): string {
  const result = resolve(requestPath)
  expect(result, `${requestPath} should have been refused`).toMatchObject({ ok: false })
  return result.ok ? '' : result.reason
}

beforeAll(() => {
  tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'bridge-path-')))
  repoRoot = join(tmpRoot, 'repo')
  outsideDir = join(tmpRoot, 'outside')

  mkdirSync(join(repoRoot, 'news', 'sub'), { recursive: true })
  mkdirSync(join(repoRoot, 'other'), { recursive: true })
  mkdirSync(outsideDir, { recursive: true })

  writeFileSync(join(repoRoot, 'news', 'index.json'), '[]', 'utf8')
  writeFileSync(join(repoRoot, 'news', 'sub', 'nested.json'), '{}', 'utf8')
  writeFileSync(join(repoRoot, 'other', 'file.md'), 'not published\n', 'utf8')
  writeFileSync(join(outsideDir, 'secret.md'), 'secret\n', 'utf8')

  // The escape: a link *inside* a declared directory pointing *outside* the repository root.
  // Only a realpath comparison can see this - `news/escape/...` prefixes `news/` just fine.
  symlinkSync(outsideDir, join(repoRoot, 'news', 'escape'), 'junction')
})

afterAll(() => {
  try {
    rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    // Best effort - a leftover temp directory is harmless and must not fail the suite.
  }
})

test('every path that resolves outside the repository root is refused, including symlink escapes', () => {
  // Plain `..` traversal, caught by the realpath containment check rather than by pattern.
  expect(refusalReason('../outside/secret.md')).toContain('resolves outside the repository root')
  expect(refusalReason('..')).toContain('resolves outside the repository root')
  expect(refusalReason('news/../../outside/secret.md')).toContain(
    'resolves outside the repository root',
  )

  // Percent-encoded and double-encoded traversal.
  expect(refusalReason('%2e%2e%2foutside.md')).toContain('percent-encoded traversal')
  expect(refusalReason('%252e%252e%252foutside.md')).toContain('percent-encoded traversal')
  expect(refusalReason('news/%2e%2e/%2e%2e/outside/secret.md')).toContain(
    'percent-encoded traversal',
  )

  // Absolute paths, drive letters and UNC paths never get as far as the filesystem.
  expect(refusalReason('/etc/passwd')).toContain('absolute paths are not allowed')
  expect(refusalReason('C:\\Windows\\system32\\config')).toContain(
    'Windows drive-letter paths are not allowed',
  )
  expect(refusalReason('C:')).toContain('Windows drive-letter paths are not allowed')
  expect(refusalReason('\\\\server\\share\\file')).toContain('UNC paths are not allowed')
  expect(refusalReason('//server/share/file')).toContain('UNC paths are not allowed')

  // NUL byte, raw and percent-encoded.
  expect(refusalReason('news/index.json\0.png')).toContain('NUL byte in path')
  expect(refusalReason('news/index.json%00.png')).toContain('NUL byte in path')

  // An undecodable percent-escape is refused rather than silently passed through.
  expect(refusalReason('news/%zz.json')).toContain('undecodable percent-escape')

  // The symlink/junction escape: the link sits inside the declared directory `news/`, so every
  // string-prefix check would accept it. Both the existing and the not-yet-existing target are
  // refused - the latter proves the nearest-existing-ancestor walk still realpaths the link.
  expect(refusalReason('news/escape/secret.md')).toContain('resolves outside the repository root')
  expect(refusalReason('news/escape/not-written-yet.md')).toContain(
    'resolves outside the repository root',
  )
})

test('a path inside the repository but outside every declared directory is refused', () => {
  expect(refusalReason('other/file.md')).toContain('resolves outside every declared directory')
  expect(refusalReason('docs/requirements/015-local-file-bridge.md')).toContain(
    'resolves outside every declared directory',
  )
})

test('a directory is refused with a reason distinct from a missing file', () => {
  expect(refusalReason('news/sub')).toContain('not a regular file')
  expect(refusalReason('news')).toContain('not a regular file')
  expect(refusalReason('news/missing.json')).toContain('not found')
  expect(refusalReason('news/sub/missing.json')).toContain('not found')
})

test('a legitimate path inside a declared directory resolves', () => {
  expect(resolve('news/index.json')).toEqual({
    ok: true,
    absolutePath: join(repoRoot, 'news', 'index.json'),
  })
  expect(resolve('news/sub/nested.json')).toEqual({
    ok: true,
    absolutePath: join(repoRoot, 'news', 'sub', 'nested.json'),
  })
})

test('only the declared directories are reachable', () => {
  const request = { repoRoot, requestPath: 'news/index.json' }

  expect(resolveBridgePath({ ...request, directories: ['engines'] }).ok).toBe(false)
  expect(resolveBridgePath({ ...request, directories: [] }).ok).toBe(false)
  expect(resolveBridgePath({ ...request, directories: ['engines', 'news'] }).ok).toBe(true)
})
