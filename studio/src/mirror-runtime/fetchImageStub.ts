/**
 * Studio-owned stand-in for the launcher's `src/main/modules/home/images/fetch-image.ts`.
 *
 * Story 013 D5 mirrors `images/resolve-feed-images.ts` for one predicate, `isSafeDeclaredImagePath()`
 * - a pure string check on a frontmatter-declared `image` path. Its module, however, is the head of
 * the launcher's image pipeline, and one file in that closure, `./fetch-image`, does
 * `await import('electron')` for `nativeImage`. Mirroring it would put an Electron import inside a
 * content repository, which this deliverable's acceptance forbids outright.
 *
 * It is also unreachable from here: `fetchImage()` is called only by `resolveOneImage()`, which only
 * `resolveFeedImages()` calls - the download-and-cache path, which needs a `userData` directory and
 * a network the studio has neither of, and which nothing on the way to `isSafeDeclaredImagePath()`
 * touches. So this is the second case of story 008's `../client` pattern (after `./harness`): the
 * mirror stays a verbatim copy, and `launcherBoundary.ts` plus `tsconfig.json`'s `rootDirs` point
 * that one import here instead - for mirrored importers only, so nothing under `src/launcher-core/`
 * is ever edited.
 *
 * Unlike `./harness`, this import is not `import type`: `fetchImage` is a value the mirrored module
 * binds at load time, so the redirect needs a runtime arm (the Vite/Vitest plugin) as well as the
 * `tsc` one. The type declarations below are copied verbatim from the launcher's `fetch-image.ts`,
 * exactly as `harness.ts` restates `NewsSource` - they are boundary shapes, not rules. `FetchImageLog`
 * is not copied at all: it is an alias of `NewsFetchLog`, which the mirror itself already carries.
 */
import type { NewsFetchLog } from '../launcher-core/src/main/modules/home/news/feed-fetcher'

/** Satisfied by both the global `fetch` and Electron's `net.fetch`. */
export type ImageFetchImpl = (url: string, init: { signal: AbortSignal }) => Promise<Response>

/** What `decodeImage` reports. `ok: false` covers both "this failed to decode" and "this decoded to
 * nothing" (Electron's `nativeImage.isEmpty()`) - both mean "not an image", not a crash. */
interface DecodeImageResult {
  ok: boolean
  width?: number
  height?: number
}

/**
 * "Is this really an image, and how big is it" is one injectable step so tests can hand back a
 * verdict without real image bytes or an Electron runtime, and production can hand the same bytes
 * to Electron's `nativeImage`.
 */
export type DecodeImage = (bytes: Buffer) => DecodeImageResult | Promise<DecodeImageResult>

/** Structurally satisfied by `Logger` (`src/main/lib/logger.ts`); kept minimal for the tests. */
export type FetchImageLog = NewsFetchLog

interface FetchImageOptions {
  /** The image's own URL - also what its cache file name is content-addressed by (`paths.ts`). */
  sourceUrl: string
  /** `userData/cache/news-images` (`getNewsImagesCacheDir()`), already existing or not - this
   * module creates it if needed. */
  cacheDir: string
  fetchImpl?: ImageFetchImpl
  decodeImage?: DecodeImage
  timeoutMs?: number
  retries?: number
  log?: FetchImageLog
}

type FetchImageResult =
  | { kind: 'cached'; fileName: string; path: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'gone' }
  | { kind: 'unavailable'; reason: string }

/**
 * Never called: the studio imports `resolve-feed-images.ts` for `isSafeDeclaredImagePath()` and for
 * nothing else. Throwing rather than returning `{ kind: 'unavailable' }` is deliberate - a silent
 * "no image today" would let a future caller wander onto this path and never notice that the
 * launcher's real fetching, caching and eviction did not happen.
 */
export function fetchImage(options: FetchImageOptions): Promise<FetchImageResult> {
  throw new Error(
    `the studio does not fetch news images (asked for ${options.sourceUrl}); ` +
      'src/mirror-runtime/fetchImageStub.ts stands in for the launcher-only fetch path',
  )
}
