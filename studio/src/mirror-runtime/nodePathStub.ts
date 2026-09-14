/**
 * Studio-owned stand-in for the bare `node:path` specifier, for importers inside the mirrored
 * `src/launcher-core/` tree only.
 *
 * `fs-utils.ts`, `images/paths.ts`, `images/resolve-feed-images.ts` and `images/image-cache.ts`
 * import `node:path` at module top level. Under Vite's browser build, a Node built-in is not
 * missing - it resolves to a `Proxy` (`__vite-browser-external`) that throws on *any* property
 * access, so the plain destructuring import (`const { join } = require('node:path')`, in effect)
 * throws the moment the module is evaluated, before any of its functions are ever called. That
 * blanks the whole React app the instant one of those files is reachable from browser code
 * (story 014's regression). `launcherBoundary.ts` redirects the bare specifier to this stub, the
 * same way it already redirects the three unmirrorable relative imports.
 *
 * Unlike the throw-on-call stubs next to this file, path arithmetic is pure string manipulation -
 * it needs no filesystem, no OS, nothing the browser lacks - so this is a real, correct
 * reimplementation of exactly the named exports the mirror imports, POSIX-style (the mirror's own
 * path data is repository-relative and always `/`-separated). Everything here mirrors
 * `path.posix`'s documented behaviour.
 */

export const sep = '/'

/** Splits on any run of slashes and drops empty segments (leading/trailing/doubled slashes). */
function splitSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0)
}

/**
 * Resolves `.`/`..` segments against a stack, the way `path.posix.normalize` does. `hadRoot`
 * governs whether a leading `..` is kept (relative path) or dropped (absolute path can't go above
 * root).
 */
function resolveSegments(segments: string[], hadRoot: boolean): string[] {
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '.') continue
    if (segment === '..') {
      if (resolved.length > 0 && resolved[resolved.length - 1] !== '..') {
        resolved.pop()
      } else if (!hadRoot) {
        resolved.push('..')
      }
      continue
    }
    resolved.push(segment)
  }
  return resolved
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/')
}

/** Joins path segments and normalizes the result, exactly like `path.posix.join`. */
export function join(...paths: string[]): string {
  if (paths.length === 0) return '.'
  const joined = paths.filter((part) => part.length > 0).join('/')
  if (joined.length === 0) return '.'
  return normalize(joined)
}

function normalize(path: string): string {
  const absolute = isAbsolute(path)
  const trailingSlash = path.length > 1 && path.endsWith('/')
  const resolved = resolveSegments(splitSegments(path), absolute)
  let result = resolved.join('/')
  if (absolute) result = `/${result}`
  if (result.length === 0) result = absolute ? '/' : '.'
  if (trailingSlash && !result.endsWith('/')) result += '/'
  return result
}

/**
 * Resolves a sequence of paths to an absolute path, right to left, stopping at the first absolute
 * segment. There is no real "current working directory" in the browser, so a lone `/` stands in
 * for it - matching the mirror's own repository-root-relative usage.
 */
export function resolve(...paths: string[]): string {
  let resolved = ''
  let resolvedAbsolute = false

  for (let index = paths.length - 1; index >= 0 && !resolvedAbsolute; index--) {
    const path = paths[index]
    if (path.length === 0) continue
    resolved = `${path}/${resolved}`
    resolvedAbsolute = isAbsolute(path)
  }

  if (!resolvedAbsolute) resolved = `/${resolved}`

  const normalized = normalize(resolved)
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
}

export function dirname(path: string): string {
  if (path.length === 0) return '.'
  const absolute = isAbsolute(path)
  const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
  const lastSlash = trimmed.lastIndexOf('/')
  if (lastSlash === -1) return '.'
  if (lastSlash === 0) return absolute ? '/' : '.'
  return trimmed.slice(0, lastSlash)
}

export function basename(path: string, ext?: string): string {
  const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path
  const lastSlash = trimmed.lastIndexOf('/')
  const base = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1)
  if (ext !== undefined && ext.length > 0 && base.endsWith(ext) && base !== ext) {
    return base.slice(0, -ext.length)
  }
  return base
}
