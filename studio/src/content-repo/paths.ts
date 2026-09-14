/**
 * Repo-root resolution and a path guard for the content-repo reader (story 010, D1).
 *
 * `resolveRepoRoot` mirrors the rule in `studio/scripts/sync-launcher.ts`'s `resolveRepoRoot`
 * exactly, so this reader works both from the repository root and from `studio/` (where
 * `npm run` puts it): if the current directory is called `studio`, its parent is the root;
 * otherwise the current directory itself is the root. That rule is confirmed by checking for a
 * `studio/` directory beneath the candidate root.
 */
import { existsSync, statSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'

/** Resolves the q2_community_content checkout root from `cwd` (defaults to `process.cwd()`). */
export function resolveRepoRoot(cwd: string = process.cwd()): string {
  const root = basename(cwd) === 'studio' ? dirname(cwd) : cwd
  const studioDir = join(root, 'studio')

  if (!existsSync(studioDir) || !statSync(studioDir).isDirectory()) {
    throw new Error(`${cwd}: is not a q2_community_content checkout (no studio/ directory)`)
  }

  return root
}

export type ResolveInsideNewsResult =
  | { readonly ok: true; readonly absolutePath: string }
  | { readonly ok: false; readonly reason: string }

/** True for a UNC path (`\\server\share\...` or `//server/share/...`). */
function isUncPath(candidate: string): boolean {
  return /^(\\\\|\/\/)/.test(candidate)
}

/** True when `candidate` starts with a Windows drive letter, e.g. `C:` or `C:\...`. */
function hasWindowsDriveLetter(candidate: string): boolean {
  return /^[a-zA-Z]:/.test(candidate)
}

/**
 * Resolves `relativePath` against `newsDir` and refuses anything that is not a genuine relative
 * path staying inside `newsDir`: absolute paths, Windows drive letters, UNC paths, and `..`
 * escapes (checked after resolution, by prefix-comparing the resolved paths, not by pattern
 * matching the input).
 */
export function resolveInsideNews(newsDir: string, relativePath: string): ResolveInsideNewsResult {
  if (isUncPath(relativePath)) {
    return { ok: false, reason: `${relativePath}: UNC paths are not allowed` }
  }
  if (hasWindowsDriveLetter(relativePath)) {
    return { ok: false, reason: `${relativePath}: Windows drive-letter paths are not allowed` }
  }
  if (isAbsolute(relativePath)) {
    return { ok: false, reason: `${relativePath}: absolute paths are not allowed` }
  }

  const resolvedNewsDir = resolve(newsDir)
  const absolutePath = resolve(resolvedNewsDir, relativePath)

  if (absolutePath !== resolvedNewsDir && !absolutePath.startsWith(resolvedNewsDir + sep)) {
    return { ok: false, reason: `${relativePath}: resolves outside news/` }
  }

  return { ok: true, absolutePath }
}
