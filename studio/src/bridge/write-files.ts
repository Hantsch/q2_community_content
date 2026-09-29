/**
 * The guarded write behind `POST /__studio/fs/write`. Plain `node:fs` only: no subprocess, no git,
 * no network client (checked by `tests/save-no-git-no-network.test.ts`).
 *
 * Everything is validated before any file is touched: every path must resolve inside a writable
 * directory and be a content file (`<dir>/index.json` or a `.md` outside `_templates/` and `img/`),
 * and every `expected` must match the normalised disk text. Only then are the files written, in
 * request order, each through a hidden sibling temp file renamed over the target.
 */
import { lstatSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

import { normaliseText } from '../content-repo/text'
import type { BridgeWriteItem } from './bridge-protocol'
import { resolveBridgePath } from './resolve-bridge-path'

const BOM = String.fromCharCode(0xfeff)

export interface WriteFilesOptions {
  readonly repoRoot: string
  /** Repository-relative directories that may be written, e.g. `['news']`. */
  readonly writableDirectories: readonly string[]
  readonly writes: readonly BridgeWriteItem[]
}

export type WriteFilesResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | { readonly ok: false; readonly status: 400 | 403; readonly error: string }
  | {
      readonly ok: false
      readonly status: 409
      readonly error: string
      readonly path: string
      readonly current: string | null
    }
  | {
      readonly ok: false
      readonly status: 500
      readonly error: string
      readonly written: readonly string[]
      readonly failed: string
    }

interface Planned {
  readonly item: BridgeWriteItem
  readonly absolutePath: string
  readonly disk: string | null
}

/** True for `<dir>/index.json`, or a `.md` under `<dir>/` outside `_templates/` and `img/`. */
function isWritableContentPath(relativePath: string, directories: readonly string[]): boolean {
  const lower = relativePath.toLowerCase()
  return directories.some((directory) => {
    const prefix = `${directory.toLowerCase()}/`
    if (!lower.startsWith(prefix)) {
      return false
    }
    if (lower === `${prefix}index.json`) {
      return true
    }
    return (
      lower.endsWith('.md') &&
      !lower.startsWith(`${prefix}_templates/`) &&
      !lower.startsWith(`${prefix}img/`)
    )
  })
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Restores the disk file's CRLF/BOM conventions on LF text; a new file stays LF without BOM. */
function restoreConventions(text: string, disk: string | null): string {
  const lf = normaliseText(text)
  if (disk === null) {
    return lf
  }
  const body = disk.includes('\r\n') ? lf.replace(/\n/g, '\r\n') : lf
  return disk.startsWith(BOM) ? BOM + body : body
}

export function writeFiles({
  repoRoot,
  writableDirectories,
  writes,
}: WriteFilesOptions): WriteFilesResult {
  let realRoot: string
  try {
    realRoot = realpathSync(resolve(repoRoot))
  } catch {
    return { ok: false, status: 403, error: `${repoRoot}: repository root could not be resolved` }
  }

  const planned: Planned[] = []
  const seen = new Set<string>()
  for (const item of writes) {
    const resolved = resolveBridgePath({
      repoRoot,
      directories: writableDirectories,
      requestPath: item.path,
    })
    let absolutePath: string
    let disk: string | null
    if (resolved.ok) {
      absolutePath = resolved.absolutePath
      disk = readFileSync(absolutePath, 'utf8')
    } else if (resolved.reason.endsWith(': not found')) {
      // `resolveBridgePath` runs its containment checks before it looks for the file, so this
      // refusal means "confined, but nothing there yet". A dangling symlink at the leaf is not
      // "nothing there": `lstat` sees it and it is refused.
      absolutePath = resolve(realRoot, item.path)
      if (lstatSync(absolutePath, { throwIfNoEntry: false }) !== undefined) {
        return { ok: false, status: 403, error: `${item.path}: not a regular file` }
      }
      disk = null
    } else {
      return { ok: false, status: 403, error: resolved.reason }
    }

    const relativePath = relative(realRoot, absolutePath).split(sep).join('/')
    if (!isWritableContentPath(relativePath, writableDirectories)) {
      return { ok: false, status: 403, error: `${item.path}: not a writable content path` }
    }
    if (seen.has(relativePath.toLowerCase())) {
      return { ok: false, status: 400, error: `${item.path}: listed more than once` }
    }
    seen.add(relativePath.toLowerCase())
    planned.push({ item, absolutePath, disk })
  }

  for (const { item, disk } of planned) {
    const current = disk === null ? null : normaliseText(disk)
    if (current !== item.expected) {
      return {
        ok: false,
        status: 409,
        error: `${item.path}: changed on disk since it was read`,
        path: item.path,
        current,
      }
    }
  }

  const written: string[] = []
  for (const { item, absolutePath, disk } of planned) {
    const temp = join(dirname(absolutePath), `.${basename(absolutePath)}.${process.pid}.tmp`)
    try {
      writeFileSync(temp, restoreConventions(item.text, disk), { encoding: 'utf8', flag: 'w' })
      renameSync(temp, absolutePath)
      written.push(item.path)
    } catch (cause) {
      rmSync(temp, { force: true })
      return {
        ok: false,
        status: 500,
        error: `${item.path}: ${messageOf(cause)}`,
        written,
        failed: item.path,
      }
    }
  }
  return { ok: true, written }
}

export interface CreateFileOptions {
  readonly repoRoot: string
  readonly writableDirectories: readonly string[]
  readonly path: string
  readonly text: string
}

export type CreateFileResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | { readonly ok: false; readonly status: 400 | 403 | 409 | 500; readonly error: string }

/**
 * Create-only write: the same path guard and content-path rule as `writeFiles`, but the file is
 * made with an exclusive create (`wx`), so an existing file is never touched (409) and no parent
 * directory is ever created (the target must sit directly under an existing directory).
 */
export function createFile({
  repoRoot,
  writableDirectories,
  path,
  text,
}: CreateFileOptions): CreateFileResult {
  let realRoot: string
  try {
    realRoot = realpathSync(resolve(repoRoot))
  } catch {
    return { ok: false, status: 403, error: `${repoRoot}: repository root could not be resolved` }
  }
  const resolved = resolveBridgePath({
    repoRoot,
    directories: writableDirectories,
    requestPath: path,
  })
  let absolutePath: string
  if (resolved.ok) {
    absolutePath = resolved.absolutePath
  } else if (resolved.reason.endsWith(': not found')) {
    absolutePath = resolve(realRoot, path)
  } else {
    return { ok: false, status: 403, error: resolved.reason }
  }
  const relativePath = relative(realRoot, absolutePath).split(sep).join('/')
  if (!isWritableContentPath(relativePath, writableDirectories)) {
    return { ok: false, status: 403, error: `${path}: not a writable content path` }
  }
  try {
    writeFileSync(absolutePath, restoreConventions(text, null), { encoding: 'utf8', flag: 'wx' })
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code
    if (code === 'EEXIST') {
      return { ok: false, status: 409, error: `${path}: already exists` }
    }
    if (code === 'ENOENT') {
      return { ok: false, status: 400, error: `${path}: parent directory does not exist` }
    }
    return { ok: false, status: 500, error: `${path}: ${messageOf(cause)}` }
  }
  return { ok: true, written: [path] }
}
