// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as homeClientStub from './homeClientStub'
import { launcherBoundaryPlugin, resolveLauncherBoundary } from './launcherBoundary'

const here = dirname(fileURLToPath(import.meta.url))
const mirrorRoot = resolve(here, '../launcher-core')
const slideButtonsPath = resolve(
  mirrorRoot,
  'src/renderer/src/modules/home/components/SlideButtons.tsx',
)

/**
 * Loaded through a runtime specifier on purpose, so this test exercises the same dynamic
 * resolution Vite performs at request time (the D2 acceptance path: "importing the mirrored
 * SlideButtons in a jsdom test does not throw"), not a `tsc`-time static import.
 *
 * A literal `import ... from '../launcher-core/.../SlideButtons'` also works today - D3 later
 * added `tsconfig.json`'s `rootDirs` mapping and widened `eslint.config.js`'s exemption to
 * `src/mirror-runtime/**`, so static imports of the mirror from this directory now typecheck and
 * lint cleanly too - but this file keeps the dynamic form because it is testing the boundary
 * plugin's own runtime resolution, not merely that the module compiles.
 */
const slideButtonsSpecifier =
  '../launcher-core/src/renderer/src/modules/home/components/SlideButtons.tsx'

/** Every `from '../x'` / `import './x.css'` specifier in a mirrored source file. */
function relativeSpecifiers(source: string): string[] {
  const patterns = [/from\s+['"](\.[^'"]*)['"]/g, /^\s*import\s+['"](\.[^'"]*)['"]/gm]
  return patterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[1]))
}

/**
 * The import clauses the mirrored source uses against `'../client'`, verbatim. The clause may span
 * lines, but may not swallow a preceding statement - hence the `import`/`from` guard.
 */
function clientImportClauses(source: string): string[] {
  const pattern = /import\s+((?:(?!\bimport\b|\bfrom\b)[\s\S])*?)\s+from\s+['"]\.\.\/client['"]/g
  return [...source.matchAll(pattern)].map((match) => match[1].trim())
}

/** `{ a, type B, c as d }` -> `['a', 'B', 'c']` - the names the stub has to provide. */
function namedBindings(clause: string): string[] {
  return clause
    .slice(1, -1)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) =>
      part
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim(),
    )
}

function mirroredSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) return mirroredSourceFiles(entryPath)
    return /\.tsx?$/.test(entry.name) ? [entryPath] : []
  })
}

function resolvesToAMirroredFile(importerPath: string, specifier: string): boolean {
  const target = resolve(dirname(importerPath), specifier)
  const candidates = ['', '.ts', '.tsx', '.js', '.css', '/index.ts', '/index.tsx']
  return candidates.some((suffix) => existsSync(`${target}${suffix}`))
}

describe('the launcher IPC boundary', () => {
  it('stubs exactly the bindings the mirrored SlideButtons imports from the home client', () => {
    const clauses = clientImportClauses(readFileSync(slideButtonsPath, 'utf8'))

    expect(
      clauses,
      'the mirrored SlideButtons.tsx must import from ../client exactly once',
    ).toEqual([expect.stringMatching(/^\{[^{}]*\}$/)])
    expect(Object.keys(homeClientStub).sort()).toEqual(namedBindings(clauses[0]).sort())
  })

  it('imports the mirrored SlideButtons in jsdom without an Electron bridge on window', async () => {
    expect((window as unknown as Record<string, unknown>).q2).toBeUndefined()

    const loaded = (await import(slideButtonsSpecifier)) as Record<string, unknown>

    expect(typeof loaded.SlideButtons).toBe('function')
  })

  it('redirects the home client import of a mirrored importer to the studio stub', () => {
    const stub = resolve(here, 'homeClientStub.ts')

    expect(resolveLauncherBoundary('../client', slideButtonsPath)).toBe(stub)
    // Vite ids may carry a query suffix, and a re-sync may spell the extension out.
    expect(resolveLauncherBoundary('../client', `${slideButtonsPath}?t=1`)).toBe(stub)
    expect(resolveLauncherBoundary('../client.js', slideButtonsPath)).toBe(stub)
  })

  it('leaves every other importer, specifier and module id alone', () => {
    const outsideMirror = resolve(here, 'mirrorCheck.tsx')
    const siblingDirectory = resolve(
      here,
      '../launcher-core-evil/src/renderer/src/modules/home/components/SlideButtons.tsx',
    )

    expect(resolveLauncherBoundary('../client', outsideMirror)).toBeNull()
    expect(resolveLauncherBoundary('../client', siblingDirectory)).toBeNull()
    expect(resolveLauncherBoundary('../client', undefined)).toBeNull()
    expect(resolveLauncherBoundary('../client', '\0virtual:anything')).toBeNull()
    expect(resolveLauncherBoundary('./SlideButtons', slideButtonsPath)).toBeNull()
    expect(resolveLauncherBoundary('../../../components/ui/Button', slideButtonsPath)).toBeNull()
    expect(resolveLauncherBoundary('@shared/modules/home', slideButtonsPath)).toBeNull()
  })

  it('is wired as a named Vite plugin with a resolveId hook', () => {
    const plugin = launcherBoundaryPlugin()

    expect(plugin.name).toBe('studio:launcher-boundary')
    expect(typeof plugin.resolveId).toBe('function')
  })

  it('has no mirrored file importing outside the mirrored set', () => {
    const unresolved = mirroredSourceFiles(mirrorRoot).flatMap((filePath) =>
      relativeSpecifiers(readFileSync(filePath, 'utf8'))
        .filter(
          (specifier) =>
            resolveLauncherBoundary(specifier, filePath) === null &&
            !resolvesToAMirroredFile(filePath, specifier),
        )
        .map((specifier) => `${relative(mirrorRoot, filePath)} -> ${specifier}`),
    )

    expect(unresolved).toEqual([])
  })
})
