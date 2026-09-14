import { join } from 'node:path'
import type { NewsSlide } from '@shared/modules/home'
import { contentRepoUrl } from '../../../lib/content-repo'
import { pathExists } from '../../../lib/fs-utils'
import { NEWS_IMAGE_PATH_PREFIX, RENDERER_ORIGIN } from '../../../lib/renderer-source'
import { NEWS_DIRECTORY } from '../news/feed-fetcher'
import {
  fetchImage,
  type DecodeImage,
  type FetchImageLog,
  type ImageFetchImpl,
} from './fetch-image'
import { enforceKeepSet, type ImageCacheLog } from './image-cache'
import {
  SAFE_NEWS_IMAGE_EXTENSIONS,
  ensureNewsImagesCacheDir,
  getNewsImagesCacheDir,
  newsImageFileName,
} from './paths'

/**
 * Story 084 D4: the pipeline step between 082's validated feed and its IPC delivery. Turns each
 * slide's frontmatter-declared `image` (a relative path under `news/`, foreign content) into a
 * `q2launcher://` `imageUrl` - or drops the image entirely - and never lets the raw `image` value
 * itself reach the slide this returns. That is what makes AC1's "no renderer request to a remote
 * origin" true by construction rather than by convention (Decisions (Sprint), and
 * `shared/modules/home.ts`'s `NewsSlide` doc comment).
 *
 * Runs exactly once per refresh, only from the `'changed'` branch of `news-service.ts`'s
 * `refreshNews()` - the one branch that means "this cycle actually reached the network"
 * (`fetchNewsDocuments()`'s other outcomes - `'unchanged'`, `'failed'`, `'skipped'` - never call
 * this at all, and simply keep serving whatever `imageUrl`s are already sitting in
 * `NewsServiceState.slides` from the previous refresh that did). So `networkReached` below is not
 * re-derived from anything - the caller passes `true` unconditionally, precisely because being
 * inside that branch already *is* the signal.
 *
 * Per slide, independently - one bad image must never cost the rest of the feed (mirrors
 * `feed-pipeline.ts`'s "a bad entry is dropped, the rest of the feed still arrives"):
 *
 *  1. no `image` declared -> no `imageUrl` on the resolved slide.
 *  2. the image is already on disk under its content-addressed name (one of
 *     `SAFE_NEWS_IMAGE_EXTENSIONS`) -> `imageUrl` resolves to it, `fetchImpl` is never called
 *     (AC4) - checked via the injected `fileExists`, never via `fetchImage`.
 *  3. not on disk, and this is a network-reaching cycle (`networkReached: true`) -> `fetchImage()`
 *     (D2) is called; `'cached'` resolves `imageUrl`, anything else (`'rejected'`/`'gone'`/
 *     `'unavailable'`) leaves the slide without one - never thrown, never aborts the rest.
 *  4. not on disk, and this is not a network-reaching cycle -> no `imageUrl` (nothing to fetch
 *     from, and fetching would violate AC4's "no network attempt" for a cache miss it cannot serve
 *     anyway).
 *
 * After every slide is resolved, `enforceKeepSet()` (D1) evicts cached images this feed's own
 * resolved file names do not cover - the current feed's images are the entire keep-set, exactly
 * per Decisions (Sprint): "scoped to the current feed's slides, evicted on feed refresh".
 */

/** Decisions (Sprint): 24 cached images on top of the current feed's keep-set. */
export const NEWS_IMAGE_CACHE_CAP = 24

/** Structurally satisfied by `Logger` (`src/main/lib/logger.ts`) and by `NewsServiceLog`
 * (`info`+`warn` only) alike - `debug`/`info` are optional here so either can be passed straight
 * through without a caller having to fake methods it does not have. */
export interface ResolveFeedImagesLog {
  warn(message: string): void
  info?(message: string): void
  debug?(message: string): void
}

export interface ResolveFeedImagesOptions {
  /** `resolveFeed()`'s output - each slide's `image`, if present, is the frontmatter's declared
   * relative path under `news/` (e.g. `img/a.png`), not yet a `q2launcher://` URL. */
  slides: NewsSlide[]
  /** `userData` root; the cache dir and the eviction call both derive from it. */
  userDataPath: string
  /** The content repo's base URL - `undefined` for production, the harness's loopback base
   * otherwise. Mirrors `feed-fetcher.ts`'s own notion of `base` (`resolveNewsSource()`/
   * `NewsSource`), so an image path resolves against the same source the feed's documents did. */
  base?: string
  /** Whether this refresh cycle actually reached the network (a `'changed'` `fetchNewsDocuments()`
   * result) - gates whether a cache miss may fetch at all. See the module comment. */
  networkReached: boolean
  fetchImpl?: ImageFetchImpl
  decodeImage?: DecodeImage
  /** Injected disk-presence check so a cache hit can be proven without calling `fetchImage`/
   * `fetchImpl` at all. Defaults to `pathExists`. */
  fileExists?: (path: string) => Promise<boolean>
  /** Item cap passed to `enforceKeepSet()` (Decisions (Sprint): 24). */
  maxItems?: number
  log?: ResolveFeedImagesLog
}

export interface ResolveFeedImagesResult {
  /** `options.slides`, each with `image` removed and `imageUrl` set only where an image actually
   * resolved (cache hit or a fresh `'cached'` fetch). */
  slides: NewsSlide[]
  /** How many cached files `enforceKeepSet()` removed. */
  removedCount: number
}

/**
 * A declared `image` is foreign content used to build a URL, same as `feed-fetcher.ts`'s document
 * `file` names - but an image legitimately lives under a subdirectory (`img/a.png`), which
 * `isSafeNewsDocumentName()` refuses (it forbids `/` entirely). This is the image equivalent:
 * boring path segments (ASCII letters/digits/`_`/`.`/`-`) separated by single `/`s, no leading
 * `/`, no `..` segment, no `:` (rules out an absolute path, a scheme and a query in one check).
 */
const MAX_IMAGE_PATH_LENGTH = 200
const SAFE_IMAGE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

export function isSafeDeclaredImagePath(path: string): boolean {
  if (path.length === 0 || path.length > MAX_IMAGE_PATH_LENGTH) return false
  const segments = path.split('/')
  return segments.every((segment) => SAFE_IMAGE_PATH_SEGMENT.test(segment))
}

/** The declared relative `image` path, resolved against `NEWS_DIRECTORY` and `base` - the same
 * join `feed-fetcher.ts`'s `documentUrl()` uses for `.md` documents, so an image and its entry's
 * document always resolve against the same source. */
function imageSourceUrl(image: string, base: string | undefined): string {
  return contentRepoUrl(`${NEWS_DIRECTORY}/${image}`, base)
}

/** Whichever content-addressed name for `sourceUrl` already exists in `cacheDir`, checked across
 * every extension a cached image could have been written under - mirrors `fetch-image.ts`'s
 * `deleteAnyCachedCopy()`, the only other place that has to find a cached file without knowing its
 * extension up front. */
async function findCachedFileName(
  sourceUrl: string,
  cacheDir: string,
  fileExists: (path: string) => Promise<boolean>,
): Promise<string | undefined> {
  for (const ext of SAFE_NEWS_IMAGE_EXTENSIONS) {
    const fileName = newsImageFileName(sourceUrl, ext)
    if (await fileExists(join(cacheDir, fileName))) return fileName
  }
  return undefined
}

function imageUrlFor(fileName: string): string {
  return `${RENDERER_ORIGIN}${NEWS_IMAGE_PATH_PREFIX}${fileName}`
}

/** `ResolveFeedImagesLog` widened to what `fetchImage()`/`enforceKeepSet()` each actually require
 * (`info`+`warn`, `debug`+`warn` respectively) - a no-op fills whichever optional method the
 * caller's own log does not have, rather than forcing every caller of this module to fake one. */
function widenLog(
  log: ResolveFeedImagesLog | undefined,
): (FetchImageLog & ImageCacheLog) | undefined {
  if (log === undefined) return undefined
  const noop = (): void => undefined
  return { info: log.info ?? noop, warn: log.warn, debug: log.debug ?? noop }
}

interface ResolveOneImageOptions {
  /** `userData` root - only touched (via `ensureNewsImagesCacheDir()`) right before an actual
   * fetch, never eagerly, so a slide with no image or an already-cached one never creates the
   * cache directory as a side effect. */
  userDataPath: string
  cacheDir: string
  base: string | undefined
  networkReached: boolean
  fetchImpl: ImageFetchImpl | undefined
  decodeImage: DecodeImage | undefined
  fileExists: (path: string) => Promise<boolean>
  log: (FetchImageLog & ImageCacheLog) | undefined
}

/** Resolves one slide's declared `image` to a cached file name, or `undefined` - see the module
 * comment for the four outcomes. Never throws: every `fetchImage()` result kind is handled, and a
 * fetch that would fail is reported through `log`, not by rejecting. */
async function resolveOneImage(image: string, options: ResolveOneImageOptions): Promise<string | undefined> {
  const sourceUrl = imageSourceUrl(image, options.base)

  const cached = await findCachedFileName(sourceUrl, options.cacheDir, options.fileExists)
  if (cached !== undefined) return cached

  if (!options.networkReached) return undefined

  // Only created here, lazily, right before the one thing that actually needs it to exist -
  // `fetchImage()` writes into it without creating it itself (mirrors `fetch-image.test.ts`'s own
  // setup, which creates the directory before calling `fetchImage()` for the same reason).
  await ensureNewsImagesCacheDir(options.userDataPath)

  const result = await fetchImage({
    sourceUrl,
    cacheDir: options.cacheDir,
    ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.decodeImage !== undefined ? { decodeImage: options.decodeImage } : {}),
    ...(options.log !== undefined ? { log: options.log } : {}),
  })

  return result.kind === 'cached' ? result.fileName : undefined
}

/**
 * Resolves every slide's image and evicts whatever the resulting feed no longer references. See
 * the module comment for the per-slide decision order and why eviction always uses exactly this
 * feed's resolved file names as its keep-set.
 */
export async function resolveFeedImages(
  options: ResolveFeedImagesOptions,
): Promise<ResolveFeedImagesResult> {
  // Pure path join - does not touch the filesystem, so a feed with no images (or one entirely
  // served from existing cache hits) never creates the cache directory as a side effect.
  const cacheDir = getNewsImagesCacheDir(options.userDataPath)
  const fileExists = options.fileExists ?? pathExists
  const maxItems = options.maxItems ?? NEWS_IMAGE_CACHE_CAP
  const log = widenLog(options.log)

  const keep = new Set<string>()
  const resolvedSlides: NewsSlide[] = []

  for (const slide of options.slides) {
    const { image, ...rest } = slide

    if (image === undefined) {
      resolvedSlides.push(rest)
      continue
    }

    if (!isSafeDeclaredImagePath(image)) {
      log?.warn(`news: refused image path ${JSON.stringify(image)}; not a boring relative path`)
      resolvedSlides.push(rest)
      continue
    }

    const fileName = await resolveOneImage(image, {
      userDataPath: options.userDataPath,
      cacheDir,
      base: options.base,
      networkReached: options.networkReached,
      fetchImpl: options.fetchImpl,
      decodeImage: options.decodeImage,
      fileExists,
      log,
    })

    if (fileName === undefined) {
      resolvedSlides.push(rest)
      continue
    }

    keep.add(fileName)
    resolvedSlides.push({ ...rest, imageUrl: imageUrlFor(fileName) })
  }

  const { removedCount } = await enforceKeepSet({
    userDataPath: options.userDataPath,
    keep,
    maxItems,
    ...(log !== undefined ? { log } : {}),
  })

  return { slides: resolvedSlides, removedCount }
}
