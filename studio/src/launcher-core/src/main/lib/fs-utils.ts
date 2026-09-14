import { constants as FS } from 'node:fs'
import { access, mkdir, readdir, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, resolve, sep } from 'node:path'

export async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target, FS.F_OK)
    return true
  } catch {
    return false
  }
}

export async function isDirectory(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isDirectory()
  } catch {
    return false
  }
}

export async function isFile(target: string): Promise<boolean> {
  try {
    return (await stat(target)).isFile()
  } catch {
    return false
  }
}

export async function isWritableDir(target: string): Promise<boolean> {
  try {
    await access(target, FS.W_OK)
    return true
  } catch {
    return false
  }
}

export async function fileSize(target: string): Promise<number | null> {
  try {
    return (await stat(target)).size
  } catch {
    return null
  }
}

/**
 * Writes `content` to `filePath` atomically: the bytes go to `<filePath>.tmp`
 * first and are then renamed over the target, so a crash mid-write can never
 * leave a truncated file behind - the same tmp+rename pattern `JsonStore.flush()`
 * uses, minus the `.bak` copy (keeping a previous version is the caller's
 * decision here, not this helper's). The parent directory is created if it does
 * not exist yet.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string,
  encoding: BufferEncoding,
): Promise<void> {
  const tmpPath = `${filePath}.tmp`
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(tmpPath, content, encoding)
  await rename(tmpPath, filePath)
}

/**
 * Resolves junctions, symlinks and `..` so that two installations pointing at
 * the same folder are recognised as duplicates. Falls back to a plain resolve
 * for paths that do not exist (yet).
 */
export async function canonicalizePath(target: string): Promise<string> {
  const absolute = isAbsolute(target) ? target : resolve(target)
  try {
    return await realpath(absolute)
  } catch {
    return resolve(absolute)
  }
}

/**
 * Comparison key for "is this the same folder?". Windows and macOS default to
 * case-insensitive filesystems, so the key is lowercased there. Trailing
 * separators are stripped so `C:\Quake2` and `C:\Quake2\` collapse.
 */
export function pathKey(target: string): string {
  let normalized = resolve(target)
  while (normalized.length > 3 && normalized.endsWith(sep)) {
    normalized = normalized.slice(0, -1)
  }
  return process.platform === 'linux' ? normalized : normalized.toLowerCase()
}

export interface DirListing {
  /** Entry names as they appear on disk. */
  names: string[]
  dirs: string[]
  files: string[]
  /** lowercased name -> actual name, for case-insensitive lookups. */
  byLowerName: Map<string, string>
}

export const EMPTY_LISTING: DirListing = {
  names: [],
  dirs: [],
  files: [],
  byLowerName: new Map(),
}

/**
 * Reads a directory once and returns everything the callers need. Quake II
 * folders are traditionally UPPERCASE (`BASEQ2`, `PAK0.PAK`) while modern
 * installs are lowercase, so every lookup in this codebase goes through
 * `byLowerName`.
 */
export async function listDir(dir: string): Promise<DirListing> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return EMPTY_LISTING
  }

  const listing: DirListing = { names: [], dirs: [], files: [], byLowerName: new Map() }
  for (const entry of entries) {
    listing.names.push(entry.name)
    listing.byLowerName.set(entry.name.toLowerCase(), entry.name)
    // Junctions and symlinks report as neither file nor directory here, so ask
    // the filesystem rather than trusting the dirent for those.
    if (entry.isDirectory()) listing.dirs.push(entry.name)
    else if (entry.isFile()) listing.files.push(entry.name)
    else if (entry.isSymbolicLink()) {
      if (await isDirectory(join(dir, entry.name))) listing.dirs.push(entry.name)
      else listing.files.push(entry.name)
    }
  }
  return listing
}

/** Case-insensitive child lookup; returns the real path or null. */
export async function findChild(dir: string, name: string): Promise<string | null> {
  const listing = await listDir(dir)
  const actual = listing.byLowerName.get(name.toLowerCase())
  return actual ? join(dir, actual) : null
}

/**
 * Resolves a `a/b/c` marker path case-insensitively, one segment at a time.
 * Returns the real path or null.
 */
export async function resolveRelaxed(root: string, relativePath: string): Promise<string | null> {
  const segments = relativePath.split(/[\\/]+/).filter(Boolean)
  let current = root
  for (const segment of segments) {
    const child = await findChild(current, segment)
    if (!child) return null
    current = child
  }
  return current
}

/** True when the platform considers `name` an executable file name. */
export function looksExecutable(name: string): boolean {
  if (process.platform === 'win32') return name.toLowerCase().endsWith('.exe')
  return !name.includes('.')
}

export function fileName(target: string): string {
  return basename(target)
}
