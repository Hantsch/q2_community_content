import { dirname, extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

/**
 * The imports the mirrored set cannot resolve in this repository, because the file each one names
 * cannot live in this mirror and is therefore deliberately not mirrored:
 *   - `SlideButtons.tsx` imports `openSlideUrl` from `../client`, the launcher's Electron IPC
 *     client (story 008, Decisions) -> `homeClientStub.ts`.
 *   - `images/resolve-feed-images.ts` imports `fetchImage` and three types from `./fetch-image`,
 *     which does `await import('electron')` for `nativeImage` (story 013 D5) -> `fetchImageStub.ts`.
 *   - the same file imports two constants from `../../../lib/renderer-source`, which builds a
 *     `Response` from a Node `Buffer` and so does not type-check under this repository's browser
 *     `lib` (story 013 D5) -> `rendererSourceStub.ts`.
 * This plugin points those imports at the studio-owned stubs instead, so the mirror stays a verbatim
 * copy and no studio-authored file is placed under `src/launcher-core/`.
 *
 * (Story 013 D5's other missing file, `news/harness.ts`, needs no entry here: `feed-fetcher.ts`
 * reaches it through an erased `import type`, so `tsconfig.json`'s `rootDirs` merge is the whole
 * mechanism there. `./fetch-image` binds a *value*, which is why it needs this runtime arm too.)
 *
 * The substitution is deliberately narrow, because a broad one would silently rewrite mirrored
 * code and the mirror would stop being one. It fires only when both hold:
 *   - the *importer* lives inside `studio/src/launcher-core/` (checked with `path.relative`, like
 *     `scripts/sync-launcher.ts`, so neither `..` segments nor a sibling such as
 *     `launcher-core-evil` can pass a prefix test), and
 *   - the specifier resolves, against that importer's directory, to exactly one of the launcher
 *     modules listed below - not to any other `../client` or `./fetch-image`.
 * Everything else falls through to Vite's own resolution untouched.
 */

const mirrorRuntimeDirectory = dirname(fileURLToPath(import.meta.url))

/** `studio/src/launcher-core/` - the mirrored tree, and the only importer zone served here. */
const MIRROR_ROOT = resolve(mirrorRuntimeDirectory, '../launcher-core')

/**
 * Every unresolvable launcher module, and the studio-owned module that takes its place. The keys are
 * extensionless because none of them has a file on disk here - that is the whole point of the entry.
 */
const REDIRECTS: readonly { readonly mirrored: string; readonly stub: string }[] = [
  {
    mirrored: resolve(MIRROR_ROOT, 'src/renderer/src/modules/home/client'),
    stub: resolve(mirrorRuntimeDirectory, 'homeClientStub.ts'),
  },
  {
    mirrored: resolve(MIRROR_ROOT, 'src/main/modules/home/images/fetch-image'),
    stub: resolve(mirrorRuntimeDirectory, 'fetchImageStub.ts'),
  },
  {
    mirrored: resolve(MIRROR_ROOT, 'src/main/lib/renderer-source'),
    stub: resolve(mirrorRuntimeDirectory, 'rendererSourceStub.ts'),
  },
]

/** Extensions a re-synced mirror might spell out (`../client.js` under NodeNext, say). */
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** True when `candidate` lies strictly inside `root` - a path check, not a string prefix check. */
function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

/** True when both paths denote the same file, honouring the platform's path semantics. */
function isSamePath(left: string, right: string): boolean {
  return relative(left, right) === ''
}

/**
 * A Vite module id is not always a file path: it can carry a `?v=`/`?import` suffix, and virtual
 * modules are prefixed with a NUL byte. Anything that is not a plain file path is not a mirrored
 * importer and is not served here.
 */
function toFilePath(id: string): string | null {
  if (id.startsWith('\0')) return null
  const filePath = id.split('?')[0].split('#')[0]
  return filePath.length > 0 ? filePath : null
}

function withoutSourceExtension(filePath: string): string {
  const extension = extname(filePath)
  return SOURCE_EXTENSIONS.has(extension) ? filePath.slice(0, -extension.length) : filePath
}

/**
 * The plugin's whole decision, as a plain function so it can be asserted directly.
 * Returns the stub's absolute path, or `null` to leave resolution alone.
 */
export function resolveLauncherBoundary(
  source: string,
  importer: string | undefined,
): string | null {
  if (importer === undefined) return null
  if (!source.startsWith('.')) return null

  const importerPath = toFilePath(importer)
  if (importerPath === null || !isInside(MIRROR_ROOT, importerPath)) return null

  const target = withoutSourceExtension(resolve(dirname(importerPath), source))
  return REDIRECTS.find((redirect) => isSamePath(target, redirect.mirrored))?.stub ?? null
}

/** Wired into `vite.config.ts` and `vitest.config.ts`, so dev, build, preview and Vitest agree. */
export function launcherBoundaryPlugin(): Plugin {
  return {
    name: 'studio:launcher-boundary',
    resolveId(source, importer) {
      return resolveLauncherBoundary(source, importer)
    },
  }
}
