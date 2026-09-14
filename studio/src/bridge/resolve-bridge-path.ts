/**
 * The path guard of the local file bridge (story 015, D1).
 *
 * This is the whole security argument of the bridge: it is what keeps a browser-supplied string
 * from reaching a file outside the repository checkout. It follows the never-throws,
 * result-object discipline of `src/content-repo/paths.ts`'s `resolveInsideNews`, but is stricter
 * in two ways that matter here:
 *
 *   - it knows about a *set* of declared directories (the published surface), so a path that
 *     stays inside the repository but outside that surface (`.git/`, `docs/`, `studio/`) is
 *     refused as well;
 *   - it compares *real* paths (`fs.realpathSync`), not string prefixes, so a symlink or a
 *     Windows directory junction placed inside a declared directory cannot point out of the
 *     checkout. String prefixing alone cannot see that.
 *
 * A path that does not exist yet is still checked: the nearest existing ancestor is realpathed
 * and the remaining segments are rejoined. That is what lets a not-yet-written file resolve while
 * an escaping symlink on one of its ancestors is still caught.
 *
 * On success the caller must open exactly the returned `absolutePath` - it is the verified real
 * path. Re-deriving it from `requestPath` would reopen the window this function closes.
 */
import { realpathSync, statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'

export type ResolveBridgePathResult =
  | { readonly ok: true; readonly absolutePath: string }
  | { readonly ok: false; readonly reason: string }

export interface ResolveBridgePathOptions {
  /** Absolute path to the repository checkout root (e.g. from `resolveRepoRoot()`). */
  readonly repoRoot: string
  /** Repository-relative directory names declared reachable, e.g. `['news', 'engines']`. */
  readonly directories: readonly string[]
  /** Repository-relative path as supplied by the browser, e.g. `news/index.json`. */
  readonly requestPath: string
}

/**
 * How often a request is decoded looking for a hidden traversal. The caller decodes once; this
 * guard keeps decoding until the string stops changing, so `%252e%252e%252f` is caught too. The
 * cap only bounds a pathological input - a real path reaches its fixed point after one round.
 */
const MAX_DECODE_ROUNDS = 5

/** True for a UNC path (`\\server\share\...` or `//server/share/...`). */
function isUncPath(candidate: string): boolean {
  return /^(\\\\|\/\/)/.test(candidate)
}

/** True when `candidate` starts with a Windows drive letter, e.g. `C:` or `C:\...`. */
function hasWindowsDriveLetter(candidate: string): boolean {
  return /^[a-zA-Z]:/.test(candidate)
}

/**
 * True for an absolute path on either platform. `path.isAbsolute` only knows the host's rules, so
 * the leading-separator form is tested explicitly as well - a POSIX host must still refuse `\foo`.
 */
function isAbsolutePath(candidate: string): boolean {
  return isAbsolute(candidate) || /^[/\\]/.test(candidate)
}

/** True when any segment of `candidate` is `..`, on either separator. */
function hasTraversalSegment(candidate: string): boolean {
  return candidate.split(/[/\\]/).includes('..')
}

type DecodeResult =
  | { readonly ok: true; readonly forms: readonly string[] }
  | { readonly ok: false; readonly reason: string }

/**
 * Returns `requestPath` together with every form it decodes into, up to its fixed point. Every
 * one of those forms has to survive the shape checks: an input is only as safe as the most
 * decoded reading of it that something downstream might take.
 */
function decodeForms(requestPath: string): DecodeResult {
  const forms: string[] = [requestPath]
  let current = requestPath

  for (let round = 0; round < MAX_DECODE_ROUNDS && current.includes('%'); round += 1) {
    let next: string
    try {
      next = decodeURIComponent(current)
    } catch {
      return { ok: false, reason: `${requestPath}: undecodable percent-escape` }
    }
    if (next === current) {
      break
    }
    forms.push(next)
    current = next
  }

  return { ok: true, forms }
}

type RealPathResult =
  { readonly ok: true; readonly realPath: string } | { readonly ok: false; readonly reason: string }

/**
 * Resolves the real path of `absolutePath`. When it does not exist (or an ancestor is not a
 * directory), the nearest existing ancestor is realpathed and the remaining segments are rejoined,
 * so a not-yet-existing file still gets a real, symlink-free answer for its existing part.
 */
function realPathAllowingMissing(absolutePath: string): RealPathResult {
  const pending: string[] = []
  let current = absolutePath

  for (;;) {
    try {
      const realAncestor = realpathSync(current)
      return {
        ok: true,
        realPath: pending.length === 0 ? realAncestor : join(realAncestor, ...pending),
      }
    } catch {
      const parent = dirname(current)
      if (parent === current) {
        return { ok: false, reason: `${absolutePath}: no existing ancestor could be resolved` }
      }
      pending.unshift(current.slice(parent.length).replace(/^[/\\]+/, ''))
      current = parent
    }
  }
}

/** True when `child` is `parent` itself or lies beneath it. Both must already be real paths. */
function isInside(parent: string, child: string): boolean {
  if (child === parent) {
    return true
  }
  const prefix = parent.endsWith(sep) ? parent : parent + sep
  return child.startsWith(prefix)
}

/**
 * Resolves a browser-supplied repository-relative path to an absolute path inside one of the
 * declared directories, or refuses it with a reason. Never throws.
 */
export function resolveBridgePath({
  repoRoot,
  directories,
  requestPath,
}: ResolveBridgePathOptions): ResolveBridgePathResult {
  if (requestPath.includes('\0')) {
    return { ok: false, reason: `${JSON.stringify(requestPath)}: NUL byte in path` }
  }

  const decoded = decodeForms(requestPath)
  if (!decoded.ok) {
    return { ok: false, reason: decoded.reason }
  }
  const forms = decoded.forms

  for (const form of forms) {
    if (form.includes('\0')) {
      return { ok: false, reason: `${requestPath}: encoded NUL byte in path` }
    }
  }
  // Only the *decoded* readings are pattern-matched for `..`; a plain `..` is left to the
  // realpath containment check below, which is the authority on where a path actually lands.
  for (const form of forms.slice(1)) {
    if (hasTraversalSegment(form)) {
      return { ok: false, reason: `${requestPath}: percent-encoded traversal` }
    }
  }
  for (const form of forms) {
    if (isUncPath(form)) {
      return { ok: false, reason: `${requestPath}: UNC paths are not allowed` }
    }
  }
  for (const form of forms) {
    if (hasWindowsDriveLetter(form)) {
      return { ok: false, reason: `${requestPath}: Windows drive-letter paths are not allowed` }
    }
  }
  for (const form of forms) {
    if (isAbsolutePath(form)) {
      return { ok: false, reason: `${requestPath}: absolute paths are not allowed` }
    }
  }

  let realRepoRoot: string
  try {
    realRepoRoot = realpathSync(resolve(repoRoot))
  } catch {
    return { ok: false, reason: `${repoRoot}: repository root could not be resolved` }
  }

  const candidate = realPathAllowingMissing(resolve(realRepoRoot, requestPath))
  if (!candidate.ok) {
    return { ok: false, reason: `${requestPath}: ${candidate.reason}` }
  }
  const realCandidate = candidate.realPath

  if (!isInside(realRepoRoot, realCandidate)) {
    return { ok: false, reason: `${requestPath}: resolves outside the repository root` }
  }

  const insideDeclaredDirectory = directories.some((directory) => {
    const declared = realPathAllowingMissing(resolve(realRepoRoot, directory))
    return declared.ok && isInside(declared.realPath, realCandidate)
  })
  if (!insideDeclaredDirectory) {
    return { ok: false, reason: `${requestPath}: resolves outside every declared directory` }
  }

  try {
    const stats = statSync(realCandidate, { throwIfNoEntry: false })
    if (stats === undefined) {
      return { ok: false, reason: `${requestPath}: not found` }
    }
    if (!stats.isFile()) {
      return { ok: false, reason: `${requestPath}: not a regular file` }
    }
  } catch {
    return { ok: false, reason: `${requestPath}: not found` }
  }

  return { ok: true, absolutePath: realCandidate }
}
