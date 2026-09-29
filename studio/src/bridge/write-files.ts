/**
 * The guarded write behind `POST /__studio/fs/write`. Plain `node:fs` only: no subprocess, no git,
 * no network client (checked by `tests/save-no-git-no-network.test.ts`).
 *
 * Everything is validated before any file is touched: every path must resolve inside a writable
 * directory and be a content file (`<dir>/index.json` or a `.md` outside `_templates/` and `img/`),
 * and every `expected` must match the normalised disk text. Only then are the files written, in
 * request order, each through a hidden sibling temp file renamed over the target.
 *
 * `writeBatch` (story 027 D2) is the multi-file sibling behind `POST /__studio/fs/write-batch`:
 * the same per-file guard, every offender reported, `.md` files first and `index.json` last.
 *
 * `createImageFile` (story 026 D1) is the binary sibling behind `POST /__studio/fs/image`.
 */
import { lstatSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'

import { normaliseText } from '../content-repo/text'
import type { BridgeBatchConflict, BridgeBatchRefusal, BridgeWriteItem } from './bridge-protocol'
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

type PlanStep =
  | { readonly ok: true; readonly planned: Planned; readonly relativePath: string }
  | { readonly ok: false; readonly error: string }

/** The per-file guard shared by `writeFiles` and `writeBatch`: confinement, content-path rule and
 * the current disk text. Touches nothing; a refusal is always a 403. */
function planWrite(
  repoRoot: string,
  realRoot: string,
  writableDirectories: readonly string[],
  item: BridgeWriteItem,
): PlanStep {
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
      return { ok: false, error: `${item.path}: not a regular file` }
    }
    disk = null
  } else {
    return { ok: false, error: resolved.reason }
  }

  const relativePath = relative(realRoot, absolutePath).split(sep).join('/')
  if (!isWritableContentPath(relativePath, writableDirectories)) {
    return { ok: false, error: `${item.path}: not a writable content path` }
  }
  return { ok: true, planned: { item, absolutePath, disk }, relativePath }
}

/** The current LF-normalised disk text when it no longer matches `expected`, else `undefined`. */
function conflictOf({ item, disk }: Planned): { current: string | null } | undefined {
  const current = disk === null ? null : normaliseText(disk)
  return current === item.expected ? undefined : { current }
}

const conflictMessage = (path: string): string => `${path}: changed on disk since it was read`

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
    const step = planWrite(repoRoot, realRoot, writableDirectories, item)
    if (!step.ok) {
      return { ok: false, status: 403, error: step.error }
    }
    if (seen.has(step.relativePath.toLowerCase())) {
      return { ok: false, status: 400, error: `${item.path}: listed more than once` }
    }
    seen.add(step.relativePath.toLowerCase())
    planned.push(step.planned)
  }

  for (const entry of planned) {
    const conflict = conflictOf(entry)
    if (conflict !== undefined) {
      return {
        ok: false,
        status: 409,
        error: conflictMessage(entry.item.path),
        path: entry.item.path,
        current: conflict.current,
      }
    }
  }

  return commit(planned)
}

/** Writes each planned file through a hidden sibling temp file renamed over the target, in order;
 * the first I/O failure stops the run and names what was already written. */
function commit(
  planned: readonly Planned[],
):
  | { readonly ok: true; readonly written: readonly string[] }
  | Extract<WriteFilesResult, { status: 500 }> {
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

export interface WriteBatchOptions {
  readonly repoRoot: string
  readonly writableDirectories: readonly string[]
  readonly files: readonly BridgeWriteItem[]
}

export type WriteBatchResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | {
      readonly ok: false
      readonly status: 400 | 403
      readonly error: string
      readonly refused: readonly BridgeBatchRefusal[]
    }
  | {
      readonly ok: false
      readonly status: 409
      readonly error: string
      readonly conflicts: readonly BridgeBatchConflict[]
    }
  | Extract<WriteFilesResult, { status: 500 }>

const isIndexPath = (relativePath: string): boolean =>
  relativePath.toLowerCase().endsWith('/index.json')

/**
 * Story 027 D2: the guarded multi-file write behind `POST /__studio/fs/write-batch`. Every file
 * passes `writeFiles`'s per-file guard and base-text comparison before the first byte is written;
 * unlike `writeFiles` it collects every offending path instead of stopping at the first, refuses an
 * empty batch, and always writes the `.md` files first and `index.json` last, so an I/O failure
 * part-way never leaves an index row pointing at a file that was not written.
 */
export function writeBatch({
  repoRoot,
  writableDirectories,
  files,
}: WriteBatchOptions): WriteBatchResult {
  if (files.length === 0) {
    return { ok: false, status: 400, error: 'the batch is empty', refused: [] }
  }
  let realRoot: string
  try {
    realRoot = realpathSync(resolve(repoRoot))
  } catch {
    const error = `${repoRoot}: repository root could not be resolved`
    return { ok: false, status: 403, error, refused: files.map(({ path }) => ({ path, error })) }
  }

  const refused: BridgeBatchRefusal[] = []
  let confinementRefused = false
  const markdown: Planned[] = []
  const indexes: Planned[] = []
  const seen = new Set<string>()
  for (const item of files) {
    const step = planWrite(repoRoot, realRoot, writableDirectories, item)
    if (!step.ok) {
      confinementRefused = true
      refused.push({ path: item.path, error: step.error })
      continue
    }
    const key = step.relativePath.toLowerCase()
    if (seen.has(key)) {
      refused.push({ path: item.path, error: `${item.path}: listed more than once` })
      continue
    }
    seen.add(key)
    if (isIndexPath(step.relativePath)) {
      indexes.push(step.planned)
    } else {
      markdown.push(step.planned)
    }
  }
  if (refused.length > 0) {
    return {
      ok: false,
      status: confinementRefused ? 403 : 400,
      error: `batch refused: ${refused.map(({ path }) => path).join(', ')}`,
      refused,
    }
  }

  const planned = [...markdown, ...indexes]
  const conflicts: BridgeBatchConflict[] = []
  for (const entry of planned) {
    const conflict = conflictOf(entry)
    if (conflict !== undefined) {
      conflicts.push({ path: entry.item.path, current: conflict.current })
    }
  }
  if (conflicts.length > 0) {
    return {
      ok: false,
      status: 409,
      error: conflicts.map(({ path }) => conflictMessage(path)).join('; '),
      conflicts,
    }
  }

  return commit(planned)
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

export interface CreateImageFileOptions {
  readonly repoRoot: string
  /** A bare file name the caller has already checked: no separator, safe, allowed extension. */
  readonly fileName: string
  readonly bytes: Uint8Array
}

export type CreateImageFileResult =
  | { readonly ok: true; readonly path: string }
  | {
      readonly ok: false
      readonly status: 403 | 409 | 500
      readonly rule: 'exists' | 'confinement' | 'write-failed'
      readonly error: string
    }

/**
 * Story 026 D1: exclusive create of `news/img/<fileName>` behind `POST /__studio/fs/image`. The
 * target must resolve inside `news/img` (so a symlinked `img/` cannot redirect the write) and must
 * not exist; the write itself uses `wx`, so a file that appears between the check and the write is
 * still never overwritten (409). No directory is ever created.
 */
export function createImageFile({
  repoRoot,
  fileName,
  bytes,
}: CreateImageFileOptions): CreateImageFileResult {
  const path = `news/img/${fileName}`
  let realRoot: string
  try {
    realRoot = realpathSync(resolve(repoRoot))
  } catch {
    return {
      ok: false,
      status: 403,
      rule: 'confinement',
      error: `${repoRoot}: repository root could not be resolved`,
    }
  }
  const resolved = resolveBridgePath({ repoRoot, directories: ['news/img'], requestPath: path })
  if (resolved.ok) {
    return { ok: false, status: 409, rule: 'exists', error: `${path} already exists` }
  }
  if (!resolved.reason.endsWith(': not found')) {
    return { ok: false, status: 403, rule: 'confinement', error: resolved.reason }
  }
  try {
    writeFileSync(resolve(realRoot, 'news', 'img', fileName), bytes, { flag: 'wx' })
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
      return { ok: false, status: 409, rule: 'exists', error: `${path} already exists` }
    }
    return { ok: false, status: 500, rule: 'write-failed', error: `${path}: ${messageOf(cause)}` }
  }
  return { ok: true, path }
}
