/**
 * Launcher-side tests for `checkDrift` (story 006, D2).
 *
 * The mirror side is a throwaway temp directory shaped like a repository root
 * (`<tmp>/studio/launcher-core.lock.json` plus `<tmp>/studio/src/launcher-core/...`); the
 * launcher side is a real `git init` checkout, because the check reads a foreign git repository
 * and AC5 is proven by looking at that repository afterwards — not by trusting a flag.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { checkDrift } from '../scripts/drift'
import {
  launcherCoreManifest,
  type LauncherCoreManifestEntry,
} from '../scripts/launcher-core.manifest'
import { createGitFixture, type GitFixture } from './git-fixture'

const MIRRORED = launcherCoreManifest[0]
const SYNCED_CONTENT = `// mirrored ${MIRRORED.source}\nexport const home = 1\n`

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Builds a repository root whose mirror and lock agree: every file is written with `content` and
 * the lock records the hash of exactly those bytes.
 */
function buildMirror(
  repoRoot: string,
  files: readonly { entry: LauncherCoreManifestEntry; content: string }[],
): void {
  for (const { entry, content } of files) {
    const absolutePath = join(repoRoot, ...entry.mirror.split('/'))
    mkdirSync(dirname(absolutePath), { recursive: true })
    writeFileSync(absolutePath, content)
  }

  const lock = {
    schemaVersion: 1,
    launcher: { commit: 'a'.repeat(40), syncedAt: '2026-09-13T00:00:00.000Z' },
    files: files.map(({ entry, content }) => ({
      source: entry.source,
      mirror: entry.mirror,
      sha256: sha256(content),
    })),
  }

  mkdirSync(join(repoRoot, 'studio'), { recursive: true })
  writeFileSync(join(repoRoot, 'studio', 'launcher-core.lock.json'), JSON.stringify(lock, null, 2))
}

/** A launcher checkout holding `content` at the mirrored source path, committed. */
function buildLauncher(content: string): GitFixture {
  const launcher = createGitFixture()
  launcher.writeFile(MIRRORED.source, content)
  launcher.commitAll()
  return launcher
}

/** Every file under `root`, as `relative path -> sha256 of its bytes`. */
function snapshotTree(root: string): Map<string, string> {
  const snapshot = new Map<string, string>()
  if (!existsSync(root)) return snapshot

  function walk(directory: string): void {
    for (const dirent of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, dirent.name)
      if (dirent.isDirectory()) {
        walk(entryPath)
        continue
      }
      snapshot.set(
        relative(root, entryPath).split(sep).join('/'),
        createHash('sha256').update(readFileSync(entryPath)).digest('hex'),
      )
    }
  }

  walk(root)
  return snapshot
}

describe('checkDrift against a launcher checkout', () => {
  let repoRoot: string | undefined
  let launcher: GitFixture | undefined

  afterEach(() => {
    launcher?.cleanup()
    launcher = undefined
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true })
      repoRoot = undefined
    }
  })

  it('a launcher that moved ahead fails the check, naming the path in both repositories', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-stale-'))
    // Mirror and lock agree — nothing was edited here. The launcher alone has moved on.
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    launcher = buildLauncher(`${SYNCED_CONTENT}export const addedUpstream = true\n`)

    const report = checkDrift({ repoRoot, launcherPath: launcher.dir })

    expect(report.ok).toBe(false)
    expect(report.skippedLauncherCompare).toBe(false)

    const finding = report.findings.find((f) => f.file === MIRRORED.mirror)
    expect(finding?.kind).toBe('stale')
    expect(finding?.launcherFile).toBe(MIRRORED.source)
    expect(finding?.message).toContain(MIRRORED.mirror)
    expect(finding?.message).toContain(MIRRORED.source)
  })

  it('a mirrored file edited here is locally-edited, not stale, even with a launcher present', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-edited-'))
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    // The launcher still holds exactly what the lock recorded: the only drift is on this side.
    launcher = buildLauncher(SYNCED_CONTENT)

    writeFileSync(
      join(repoRoot, ...MIRRORED.mirror.split('/')),
      `${SYNCED_CONTENT}// edited locally\n`,
    )

    const report = checkDrift({ repoRoot, launcherPath: launcher.dir })

    expect(report.ok).toBe(false)
    expect(report.findings.map((f) => f.kind)).toEqual(['locally-edited'])
  })

  it('a file edited here AND moved ahead upstream is still locally-edited, not stale', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-both-'))
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    // The launcher genuinely moved ahead too — a third, distinct content, not what the lock
    // recorded. Only the lock-vs-disk comparison proves the local edit, so that must still win.
    launcher = buildLauncher(`${SYNCED_CONTENT}export const addedUpstream = true\n`)

    writeFileSync(
      join(repoRoot, ...MIRRORED.mirror.split('/')),
      `${SYNCED_CONTENT}// edited locally\n`,
    )

    const report = checkDrift({ repoRoot, launcherPath: launcher.dir })

    expect(report.ok).toBe(false)
    const finding = report.findings.find((f) => f.file === MIRRORED.mirror)
    expect(finding?.kind).toBe('locally-edited')
    expect(report.findings.map((f) => f.kind)).toEqual(['locally-edited'])
  })

  it('an invalid launcher path is a hard failure, not a skip', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-invalid-'))
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    const notACheckout = join(repoRoot, 'no-launcher-here')

    const report = checkDrift({ repoRoot, launcherPath: notACheckout })

    expect(report.ok).toBe(false)
    expect(report.skippedLauncherCompare).toBe(false)
    const finding = report.findings.find((f) => f.kind === 'launcher-invalid')
    expect(finding?.file).toBe(notACheckout)
    expect(finding?.message).toContain('does not exist')
  })

  it('without a path the run is ok: true with the skip flag set', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-skipped-'))
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    // A launcher that has moved ahead exists on the machine, but is never handed to the check.
    launcher = buildLauncher(`${SYNCED_CONTENT}export const addedUpstream = true\n`)

    const report = checkDrift({ repoRoot })

    expect(report.ok).toBe(true)
    expect(report.skippedLauncherCompare).toBe(true)
    expect(report.findings).toEqual([])
  })

  it('the check writes to neither repository', () => {
    repoRoot = mkdtempSync(join(tmpdir(), 'drift-launcher-readonly-'))
    buildMirror(repoRoot, [{ entry: MIRRORED, content: SYNCED_CONTENT }])
    launcher = buildLauncher(SYNCED_CONTENT)

    const mirrorBefore = snapshotTree(repoRoot)
    // `.git` is left out on purpose: git's own bookkeeping is not a working-tree change, and the
    // porcelain assertion below is what proves the checkout was only read.
    const launcherBefore = snapshotTree(join(launcher.dir, 'src'))

    const report = checkDrift({ repoRoot, launcherPath: launcher.dir })

    // Mirror, lock and launcher all agree here, so this also covers the clean three-way case.
    expect(report.ok).toBe(true)
    expect(report.findings).toEqual([])

    expect(snapshotTree(repoRoot)).toEqual(mirrorBefore)
    expect(snapshotTree(join(launcher.dir, 'src'))).toEqual(launcherBefore)
    expect(
      execFileSync('git', ['status', '--porcelain'], { cwd: launcher.dir, encoding: 'utf8' }),
    ).toBe('')
  })
})
