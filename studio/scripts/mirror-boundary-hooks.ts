/**
 * The Node arm of the mirror boundary (story 017, D1).
 *
 * `src/contract/launcher-safe-names.ts` re-exports three predicates from the mirrored
 * `images/resolve-feed-images.ts`, and that mirrored module imports two launcher files this
 * repository deliberately does not mirror (story 013 D5): `./fetch-image`, which does
 * `await import('electron')`, and `../../../lib/renderer-source`, which does not type-check against
 * this repository's browser `lib`. Both imports are therefore resolved to studio-owned stubs
 * instead — until now by exactly two mechanisms:
 *   - `src/mirror-runtime/launcherBoundary.ts`, a Vite plugin, for Vite and Vitest;
 *   - `tsconfig.json`'s `rootDirs` merge, for `tsc`.
 * Neither covers plain Node. `npm run validate` runs through `tsx`, which honours `paths` but has
 * no equivalent of `rootDirs` and runs no Vite plugin, so the moment the CLI reaches story 013's
 * `collectRepositoryFindings()` (and through it `launcher-safe-names.ts`) those two imports have
 * nothing to resolve to and the command dies with `ERR_MODULE_NOT_FOUND`. This module is that
 * missing third arm, registered by `scripts/validate.ts` itself so every way of invoking the CLI
 * (`npm run validate`, a spawned `tsx scripts/validate.ts`, a future e2e run) gets it.
 *
 * Deliberately narrower than the Vite arm: it redirects only the two unresolvable *relative*
 * imports, never the `node:*` built-ins `launcherBoundary.ts` also redirects. Those redirects exist
 * because Vite externalises Node built-ins into a throwing proxy in the browser bundle; in a Node
 * CLI the real built-ins are both available and the correct answer, so swapping them for browser
 * stubs here would be a silent behaviour change rather than a boundary fix.
 *
 * The guard is the same one `launcherBoundary.ts` documents: the redirect fires only for an
 * importer that lies inside `src/launcher-core/` (a path check, not a string prefix), and only when
 * the specifier resolves to exactly one of the two launcher modules named above.
 */
import { dirname, extname, isAbsolute, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptsDirectory = dirname(fileURLToPath(import.meta.url))
const STUDIO_SRC = resolvePath(scriptsDirectory, '../src')
const MIRROR_ROOT = resolvePath(STUDIO_SRC, 'launcher-core')

/** Extensionless on purpose: neither key has a file on disk here — that is the whole point. The
 * stub targets are the same two `launcherBoundary.ts` points the Vite arm at. */
const REDIRECTS: readonly { readonly mirrored: string; readonly stub: string }[] = [
  {
    mirrored: resolvePath(MIRROR_ROOT, 'src/main/modules/home/images/fetch-image'),
    stub: resolvePath(STUDIO_SRC, 'mirror-runtime/fetchImageStub.ts'),
  },
  {
    mirrored: resolvePath(MIRROR_ROOT, 'src/main/lib/renderer-source'),
    stub: resolvePath(STUDIO_SRC, 'mirror-runtime/rendererSourceStub.ts'),
  },
]

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** True when `candidate` lies strictly inside `root` - a path check, not a string prefix check. */
function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

function withoutSourceExtension(filePath: string): string {
  const extension = extname(filePath)
  return SOURCE_EXTENSIONS.has(extension) ? filePath.slice(0, -extension.length) : filePath
}

/** The hook's whole decision, exported as a plain function so it can be asserted directly. Returns
 * the stub's absolute path, or `null` to leave resolution alone. */
export function resolveMirrorBoundary(
  specifier: string,
  parentURL: string | undefined,
): string | null {
  if (parentURL === undefined || !parentURL.startsWith('file:')) return null
  if (!specifier.startsWith('.')) return null

  const importerPath = fileURLToPath(parentURL)
  if (!isInside(MIRROR_ROOT, importerPath)) return null

  const target = withoutSourceExtension(resolvePath(dirname(importerPath), specifier))
  return REDIRECTS.find((redirect) => relative(redirect.mirrored, target) === '')?.stub ?? null
}

/** Node's ESM `resolve` hook (`node:module`'s `register()`), chained ahead of `tsx`'s own: anything
 * this module does not claim falls through to `nextResolve` untouched. */
export function resolve(
  specifier: string,
  context: { parentURL?: string },
  nextResolve: (specifier: string, context: { parentURL?: string }) => unknown,
): unknown {
  const stub = resolveMirrorBoundary(specifier, context.parentURL)
  if (stub !== null) return { url: pathToFileURL(stub).href, shortCircuit: true }
  return nextResolve(specifier, context)
}
