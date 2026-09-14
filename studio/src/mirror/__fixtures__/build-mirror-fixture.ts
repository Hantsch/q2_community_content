/**
 * Test fixture helper for `read-provenance.test.ts`: builds a plain temp directory containing
 * `studio/launcher-core.lock.json` and matching `studio/src/launcher-core/...` files — no `.git`
 * anywhere — so tests can prove the reader needs neither git history nor a launcher checkout.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface FixtureFile {
  /** Repo-relative mirror path, e.g. `studio/src/launcher-core/src/shared/modules/home.ts`. */
  readonly mirror: string
  readonly content: string
}

export interface MirrorFixtureLock {
  readonly commit?: string
  readonly syncedAt?: string
}

/** Creates a fresh temp directory to use as a fixture `repoRoot`. */
export function createFixtureRoot(): string {
  return mkdtempSync(join(tmpdir(), 'read-provenance-fixture-'))
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Writes `studio/launcher-core.lock.json` plus every mirrored file's bytes into `repoRoot`, with
 * hashes computed from the given content so the lock and the disk always start out matching.
 */
export function buildMirrorFixture(
  repoRoot: string,
  files: readonly FixtureFile[],
  lock: MirrorFixtureLock = {},
): void {
  for (const file of files) {
    const absolutePath = join(repoRoot, ...file.mirror.split('/'))
    mkdirSync(join(absolutePath, '..'), { recursive: true })
    writeFileSync(absolutePath, file.content)
  }

  const lockContent = {
    schemaVersion: 1,
    launcher: {
      commit: lock.commit ?? 'a'.repeat(40),
      syncedAt: lock.syncedAt ?? '2026-09-13T00:00:00.000Z',
    },
    files: files.map((file) => ({
      source: file.mirror.replace('studio/src/launcher-core/', ''),
      mirror: file.mirror,
      sha256: sha256(file.content),
    })),
  }

  mkdirSync(join(repoRoot, 'studio'), { recursive: true })
  writeFileSync(
    join(repoRoot, 'studio', 'launcher-core.lock.json'),
    JSON.stringify(lockContent, null, 2),
  )
}
