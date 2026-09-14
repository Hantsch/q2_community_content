/**
 * Toolchain checks for the mirrored launcher contract under `studio/src/launcher-core/`
 * (story 007, D1). The mirror must compile and lint with zero edits to its own contents —
 * everything needed for that is toolchain configuration (tsconfig `paths`, the `zod` pin,
 * vite/vitest aliases, `.prettierignore`). This test invokes the real toolchain rather than
 * re-reading source and guessing.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

// studio/ is one level up from studio/tests/.
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))

const SPAWN_TIMEOUT_MS = 60_000

function readStudioFile(relativePath: string): string {
  return readFileSync(join(studioDir, relativePath), 'utf8')
}

describe('launcher-core mirror toolchain', () => {
  it('tsc -p tsconfig.json --noEmit exits 0 with the mirror present', () => {
    // TypeScript's package.json restricts its `exports`, so `typescript/bin/tsc` cannot be
    // resolved directly; resolve the package root instead and follow its declared `bin` field.
    const typescriptPackageJsonPath = require.resolve('typescript/package.json')
    const typescriptPackage = JSON.parse(readFileSync(typescriptPackageJsonPath, 'utf8')) as {
      bin: { tsc: string }
    }
    const tscCliPath = join(dirname(typescriptPackageJsonPath), typescriptPackage.bin.tsc)

    const result = spawnSync(process.execPath, [tscCliPath, '-p', 'tsconfig.json', '--noEmit'], {
      cwd: studioDir,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
    })

    expect(result.status, `tsc failed:\n${result.stdout}\n${result.stderr}`).toBe(0)
  })

  it('zod is declared as an exact version matching the installed one', () => {
    const studioPackage = JSON.parse(readStudioFile('package.json')) as {
      dependencies: Record<string, string>
    }
    const declaredVersion = studioPackage.dependencies.zod

    expect(declaredVersion).toBeDefined()
    expect(declaredVersion).toMatch(/^\d+\.\d+\.\d+$/)

    const installedPackage = JSON.parse(readStudioFile('node_modules/zod/package.json')) as {
      version: string
    }

    expect(declaredVersion).toBe(installedPackage.version)
  })
})
