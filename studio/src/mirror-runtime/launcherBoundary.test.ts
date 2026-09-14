// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
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

/**
 * The relative specifiers a source imports with `import type`. TypeScript erases those entirely, so
 * they emit no runtime import: the boundary plugin has nothing to redirect, and `tsconfig.json`'s
 * `rootDirs` merge with this directory is the whole mechanism. Story 013 D5's `./harness` is the
 * case - `news/harness.ts` reaches `electron` and is deliberately not mirrored, so only the
 * `NewsSource` type it declares is restated in `harness.ts` next to this file.
 *
 * A mixed clause (`import { a, type B } from './x'`) is not matched, and rightly so: it keeps its
 * runtime import and still needs a real target.
 */
function typeOnlySpecifiers(source: string): Set<string> {
  const pattern = /import\s+type\s+[^'"]*?\bfrom\s+['"](\.[^'"]*)['"]/g
  return new Set([...source.matchAll(pattern)].map((match) => match[1]))
}

/** The `rootDirs` counterpart such an erased import falls through to, which has to actually exist. */
function resolvesToAMirrorRuntimeStub(specifier: string): boolean {
  return existsSync(join(here, `${basename(specifier)}.ts`))
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

  it('redirects the mirrored image resolver’s two unmirrorable imports to the studio stubs', () => {
    // Story 013 D5: `resolve-feed-images.ts` carries `isSafeDeclaredImagePath()` and is mirrored,
    // but two of its imports are not - `images/fetch-image.ts` reaches `electron`, and
    // `lib/renderer-source.ts` does not type-check under this repository's browser `lib`.
    const resolveFeedImagesPath = resolve(
      mirrorRoot,
      'src/main/modules/home/images/resolve-feed-images.ts',
    )

    const fetchImageStub = resolve(here, 'fetchImageStub.ts')
    expect(resolveLauncherBoundary('./fetch-image', resolveFeedImagesPath)).toBe(fetchImageStub)
    expect(resolveLauncherBoundary('./fetch-image.js', resolveFeedImagesPath)).toBe(fetchImageStub)

    const rendererSourceStub = resolve(here, 'rendererSourceStub.ts')
    expect(resolveLauncherBoundary('../../../lib/renderer-source', resolveFeedImagesPath)).toBe(
      rendererSourceStub,
    )

    // The same specifiers from anywhere else in the mirror name different modules, and stay untouched.
    expect(resolveLauncherBoundary('./fetch-image', slideButtonsPath)).toBeNull()
    expect(resolveLauncherBoundary('../../../lib/renderer-source', slideButtonsPath)).toBeNull()
  })

  it('redirects the four Node built-ins imported by mirrored files, importer-guarded', () => {
    // `fs-utils.ts` imports all three of node:fs, node:fs/promises and node:path; `images/paths.ts`
    // pulls in node:crypto too, so it doubles as a plausible importer for that one.
    const fsUtilsPath = resolve(mirrorRoot, 'src/main/lib/fs-utils.ts')
    const pathsPath = resolve(mirrorRoot, 'src/main/modules/home/images/paths.ts')

    expect(resolveLauncherBoundary('node:crypto', pathsPath)).toBe(
      resolve(here, 'nodeCryptoStub.ts'),
    )
    expect(resolveLauncherBoundary('node:fs', fsUtilsPath)).toBe(resolve(here, 'nodeFsStub.ts'))
    expect(resolveLauncherBoundary('node:fs/promises', fsUtilsPath)).toBe(
      resolve(here, 'nodeFsPromisesStub.ts'),
    )
    expect(resolveLauncherBoundary('node:path', fsUtilsPath)).toBe(resolve(here, 'nodePathStub.ts'))

    // A non-mirror importer must keep resolving the real built-ins - only imports made *from
    // within* the mirrored tree are redirected.
    const outsideMirror = resolve(here, 'mirrorCheck.tsx')
    expect(resolveLauncherBoundary('node:crypto', outsideMirror)).toBeNull()
    expect(resolveLauncherBoundary('node:fs', outsideMirror)).toBeNull()
    expect(resolveLauncherBoundary('node:fs/promises', outsideMirror)).toBeNull()
    expect(resolveLauncherBoundary('node:path', outsideMirror)).toBeNull()
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
    const unresolved = mirroredSourceFiles(mirrorRoot).flatMap((filePath) => {
      const source = readFileSync(filePath, 'utf8')
      const typeOnly = typeOnlySpecifiers(source)
      return relativeSpecifiers(source)
        .filter(
          (specifier) =>
            resolveLauncherBoundary(specifier, filePath) === null &&
            !resolvesToAMirroredFile(filePath, specifier) &&
            !(typeOnly.has(specifier) && resolvesToAMirrorRuntimeStub(specifier)),
        )
        .map((specifier) => `${relative(mirrorRoot, filePath)} -> ${specifier}`)
    })

    expect(unresolved).toEqual([])
  })
})
