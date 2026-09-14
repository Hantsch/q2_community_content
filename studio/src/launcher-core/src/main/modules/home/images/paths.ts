import { createHash } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Story 084 D1: where a cached slide image lives, and what makes its file name trustworthy.
 *
 * ```
 * userData/cache/news-images/<sha256-of-source-url>.<ext>
 * ```
 *
 * Names are content-addressed by the **source URL**, not by feed-entry id (Decisions (Sprint)):
 * the same image survives a feed refresh and an entry rename without a re-download, and a
 * sha256-hex-plus-extension name is "boring" by construction, which is what lets
 * `isSafeNewsImageFileName()` be a single regexp rather than a blocklist.
 *
 * Every builder takes `userDataPath` as a parameter instead of calling `app.getPath('userData')`
 * itself, for the same reason `downloads/paths.ts` does: `image-cache.test.ts` writes real files
 * under an `mkdtemp` directory with no Electron runtime, and a scattered `app.getPath(...)` call is
 * how a cache path quietly becomes two slightly different cache paths. There is exactly one place
 * here that knows the layout.
 */

/** Under `userData`, so the whole cache can be dropped without touching `state.json`. */
export const NEWS_IMAGES_CACHE_SEGMENTS = ['cache', 'news-images'] as const

/** Extensions a cached image is ever written under (Decisions (Sprint): content-type pre-filter). */
export const SAFE_NEWS_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'] as const

/**
 * A cached image's name is never foreign input picked up verbatim - it is *built* here from a
 * sha256 hex digest of the source URL, so it is always exactly 64 lowercase hex characters, a dot,
 * and one of the allowed extensions. `isSafeNewsImageFileName()` is that same shape asserted as a
 * predicate, so a name read back off disk (in `image-cache.ts`) can be checked against precisely
 * what this module would ever have written - nothing more permissive.
 */
const SAFE_NEWS_IMAGE_FILE_NAME = new RegExp(
  `^[a-f0-9]{64}\\.(?:${SAFE_NEWS_IMAGE_EXTENSIONS.join('|')})$`,
)

export function isSafeNewsImageFileName(name: string): boolean {
  return SAFE_NEWS_IMAGE_FILE_NAME.test(name)
}

/**
 * The content-addressed file name for an image fetched from `sourceUrl` (Decisions (Sprint)):
 * sha256 hex of the source URL, plus the extension the caller determined from the response's
 * content type. Does not validate `ext` against `SAFE_NEWS_IMAGE_EXTENSIONS` - that is
 * `isSafeNewsImageFileName()`'s job, checked on the result before anything is written or served.
 */
export function newsImageFileName(sourceUrl: string, ext: string): string {
  const digest = createHash('sha256').update(sourceUrl).digest('hex')
  return `${digest}.${ext}`
}

/** `userData/cache/news-images`. */
export function getNewsImagesCacheDir(userDataPath: string): string {
  return join(userDataPath, ...NEWS_IMAGES_CACHE_SEGMENTS)
}

/** Creates the cache directory if it does not exist yet and returns it. */
export async function ensureNewsImagesCacheDir(userDataPath: string): Promise<string> {
  const dir = getNewsImagesCacheDir(userDataPath)
  await mkdir(dir, { recursive: true })
  return dir
}
