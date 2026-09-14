import { readdir, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { getNewsImagesCacheDir, isSafeNewsImageFileName } from './paths'

/**
 * The news-image cache - story 084 D1 (AC5).
 *
 * Mirrors `src/main/modules/downloads/cache.ts` one-to-one: `planImageEviction()` is pure and
 * decides *what* goes, `enforceKeepSet()` is the only thing that unlinks, and the statement that
 * deletes re-checks the rule itself instead of trusting the plan it was handed - the same "one
 * rule, one code path" discipline, because this is the second (and only other) place in the
 * launcher that deletes files under `userData`.
 *
 * The rule differs from the download cache's in shape, not in spirit: there is no byte budget,
 * because Decisions (Sprint) chose an item-count cap plus a keep-set (the current feed's images)
 * over a disk-size cap. A cached image is either referenced by the current feed (kept,
 * unconditionally, forever) or it is not (evictable, oldest-mtime-first, down to the cap).
 */

/**
 * One file in the cache directory, as far as an eviction decision is concerned. Deliberately just
 * a name to delete by and an mtime to order by - `sizeBytes` has no role here, unlike the download
 * cache, because this cache has no byte budget - so `planImageEviction()` can be exercised without
 * a filesystem.
 */
export interface ImageCacheEntry {
  /** Bare file name inside the cache directory; never a path. */
  fileName: string
  /** Last-modified time in epoch ms. Oldest goes first. */
  mtimeMs: number
}

export interface PlanImageEvictionInput {
  entries: ImageCacheEntry[]
  /** File names the current feed references; never evicted, whatever the cap. */
  keep: ReadonlySet<string>
  /** Item cap for the *unreferenced* part of the cache (Decisions (Sprint): 24). */
  maxItems: number
}

/** Only `warn`/`debug` are used; a module's scoped logger satisfies this structurally. */
export interface ImageCacheLog {
  warn(message: string): void
  debug(message: string): void
}

export interface EnforceKeepSetInput {
  userDataPath: string
  keep: ReadonlySet<string>
  maxItems: number
  log?: ImageCacheLog
}

export interface EnforceKeepSetResult {
  removedCount: number
}

/**
 * Picks the cache entries to evict so that no more than `maxItems` unreferenced images remain:
 * oldest `mtimeMs` first, stopping the moment the remainder is at or under the cap.
 *
 * Pure by design - no `fs`, no clock, no randomness - which is what makes AC5's guarantee ("never
 * removes a currently visible slide's image") provable: every entry in `keep` is excluded from
 * consideration *entirely*, so it can never appear in the returned plan no matter what `maxItems`
 * is. A name `isSafeNewsImageFileName()` rejects is excluded the same way a `.part` file is
 * excluded from the download cache's plan - it is not a name this module would ever have written,
 * so it is not this module's business to delete it.
 *
 * A `maxItems` that is not a finite, comparable number (`NaN`, `Infinity`) must not be read as
 * "evict everything" - the same guard `downloads/cache.ts`'s `planEviction()` applies to a
 * non-finite budget, and for the same reason: an unguarded comparison would treat "no sensible cap
 * was given" as "the cap is zero".
 */
export function planImageEviction({
  entries,
  keep,
  maxItems,
}: PlanImageEvictionInput): ImageCacheEntry[] {
  if (!Number.isFinite(maxItems)) return []
  const cap = Math.max(0, maxItems)

  const candidates = entries.filter(
    (entry) => isSafeNewsImageFileName(entry.fileName) && !keep.has(entry.fileName),
  )

  if (candidates.length <= cap) return []

  // Oldest first; the name breaks a tie so that two files written in the same millisecond still
  // produce one stable, reproducible plan rather than whatever order `readdir` happened to give.
  const oldestFirst = [...candidates].sort(
    (a, b) => a.mtimeMs - b.mtimeMs || a.fileName.localeCompare(b.fileName),
  )

  return oldestFirst.slice(0, oldestFirst.length - cap)
}

/**
 * Reads every regular file in the cache directory with its mtime. A missing directory (or any
 * other read failure) is an empty cache, not an error - the directory is created on the first
 * fetched image, so "not there yet" is the normal state of a fresh install or a feed with no
 * images.
 *
 * Directories and symlinks are skipped: `readdir`'s dirents do not follow links, so a link reports
 * as neither file nor directory here and drops out. Nothing in this file ever removes a directory.
 */
async function readCacheEntries(dir: string, log?: ImageCacheLog): Promise<ImageCacheEntry[]> {
  let dirents
  try {
    dirents = await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }

  const entries: ImageCacheEntry[] = []
  for (const dirent of dirents) {
    if (!dirent.isFile()) continue
    try {
      const stats = await stat(join(dir, dirent.name))
      entries.push({ fileName: dirent.name, mtimeMs: stats.mtimeMs })
    } catch {
      // Vanished between readdir and stat. It is not on disk any more, so it is not part of the
      // cache we are measuring.
      log?.debug(`image cache entry ${dirent.name} disappeared while it was being measured`)
    }
  }
  return entries
}

/**
 * Brings the cache down to `maxItems` unreferenced images by deleting the oldest ones (AC5).
 * Called after every feed refresh, with that feed's image file names as `keep`.
 *
 * The only place in this module that unlinks a file. Every candidate `planImageEviction()` hands
 * back is re-checked here, at the point of deletion, against the same two facts a caller could get
 * wrong: is this actually a name this module would have written, and does it in fact live directly
 * inside the cache directory (no traversal, no nested subdirectory)? A candidate that fails either
 * check is skipped, not fatal - one bad name must not abort the rest of the batch.
 */
export async function enforceKeepSet({
  userDataPath,
  keep,
  maxItems,
  log,
}: EnforceKeepSetInput): Promise<EnforceKeepSetResult> {
  const dir = getNewsImagesCacheDir(userDataPath)
  const entries = await readCacheEntries(dir, log)
  const planned = planImageEviction({ entries, keep, maxItems })

  let removedCount = 0
  const resolvedDir = resolve(dir)
  for (const entry of planned) {
    // Defence in depth. `planImageEviction` has already applied both carve-outs and every name
    // came from a `readdir` of this very directory - but this is the statement that actually
    // deletes, so it re-checks the rule itself instead of trusting the plan it was handed.
    if (!isSafeNewsImageFileName(entry.fileName) || keep.has(entry.fileName)) {
      log?.warn(`refused to evict protected cache entry ${entry.fileName}`)
      continue
    }
    const target = resolve(dir, entry.fileName)
    if (dirname(target) !== resolvedDir) {
      log?.warn(`refused to evict ${entry.fileName}: not a direct child of the cache directory`)
      continue
    }

    try {
      await unlink(target)
    } catch (error) {
      log?.warn(`image cache entry ${entry.fileName} could not be evicted: ${String(error)}`)
      continue
    }
    removedCount += 1
  }

  if (removedCount > 0) {
    log?.debug(`evicted ${removedCount} news-image cache entries`)
  }
  return { removedCount }
}
