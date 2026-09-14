import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { launcherCoreManifest } from '../scripts/launcher-core.manifest'
import launcherCoreLock from '../launcher-core.lock.json'

// `studio/` is one level up from `studio/tests/`.
const studioRoot = fileURLToPath(new URL('..', import.meta.url))

const newlyMirroredFiles = [
  'studio/src/launcher-core/src/renderer/src/modules/home/components/SlideButtons.tsx',
  'studio/src/launcher-core/src/renderer/src/components/ui/Button.tsx',
  'studio/src/launcher-core/src/renderer/src/lib/cn.ts',
  'studio/src/launcher-core/src/renderer/src/styles/surfaces.css',
  'studio/src/launcher-core/src/renderer/src/styles/controls-grid.css',
  'studio/src/launcher-core/src/renderer/src/styles/config-syntax.css',
  'studio/src/launcher-core/src/renderer/src/styles/dashboard.css',
]

describe('mirror set', () => {
  it('declares every newly mirrored rendering file in the manifest', () => {
    const manifestMirrors = launcherCoreManifest.map((entry) => entry.mirror)

    for (const mirror of newlyMirroredFiles) {
      expect(manifestMirrors).toContain(mirror)
    }
  })

  it('records a sha256 lock entry for every newly mirrored file that matches the file on disk', () => {
    // A hash that is merely well-formed is not proof the mirror is faithful (review finding
    // F12) - `mirrorDrift.test.ts` (D6) re-checks this for every mirrored file via `check:drift`,
    // but this file's own claim ("has a lock entry with a hash") is worth backing with an actual
    // content comparison rather than a format check alone.
    for (const mirror of newlyMirroredFiles) {
      const recorded = launcherCoreLock.files.find((entry) => entry.mirror === mirror)
      expect(recorded, `missing lock entry for ${mirror}`).toBeDefined()
      expect(recorded?.sha256).toMatch(/^[0-9a-f]{64}$/)

      const bytes = readFileSync(join(studioRoot, '..', mirror))
      const actualHash = createHash('sha256').update(bytes).digest('hex')
      expect(actualHash, `${mirror}: disk contents no longer match the recorded lock hash`).toBe(
        recorded?.sha256,
      )
    }
  })
})
