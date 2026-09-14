/**
 * Studio-owned stand-in for the launcher's `src/main/lib/renderer-source.ts`.
 *
 * The second of story 013 D5's two unmirrorable imports (see `fetchImageStub.ts` for the first).
 * `images/resolve-feed-images.ts` imports two constants from it to build a slide's `imageUrl`, and
 * the file itself is electron-free and would mirror cleanly as text - but it cannot be *type-checked*
 * here. It builds a `Response` from a Node `Buffer`, and the launcher checks its main process with
 * `lib: ["ES2023"]` / `types: ["node"]`, where `BodyInit` accepts one. This repository has to check
 * the very same file against the browser `lib` its studio app needs, where `BufferSource` is
 * `ArrayBufferView<ArrayBuffer>` and `Buffer<ArrayBufferLike>` is not assignable. Nothing short of
 * editing the mirror - which CLAUDE.md forbids - reconciles the two programs, so the import is
 * redirected here instead, exactly like `./fetch-image` and `./harness`.
 *
 * Only `imageUrlFor()` reads these, and only `resolveFeedImages()` calls that: the studio imports
 * that module for `isSafeDeclaredImagePath()`, a pure string predicate, and for nothing else.
 *
 * Both values are copied verbatim from the launcher, the same way `harness.ts` restates
 * `NewsSource`. They are boundary constants - the launcher's private renderer origin and the cache
 * path it serves images under - not rules the studio could get wrong: no studio code reads them, no
 * repository content contains them, and neither takes part in any safe-name decision.
 */

/** `RENDERER_SCHEME`://`RENDERER_HOST` - the privileged origin the launcher serves its renderer
 * from instead of `file://`. */
export const RENDERER_ORIGIN = 'q2launcher://app'

/** The path prefix cached slide images are served under, on that same origin. */
export const NEWS_IMAGE_PATH_PREFIX = '/news-image/'
