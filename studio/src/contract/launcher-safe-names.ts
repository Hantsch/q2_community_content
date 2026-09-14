/**
 * The one door into the mirrored launcher *safe-name* rules (`src/launcher-core/`).
 *
 * Story 013 D5: the repository-level findings need the launcher's own answer to "would this name
 * be refused?" rather than a second regex maintained here that could drift away from the one the
 * launcher actually applies.
 *
 * Kept separate from `launcher-contract.ts` on purpose. That door is the browser-safe data
 * contract the studio app itself imports; this slice reaches `node:crypto`, `node:fs` and
 * `node:path` through its mirrored module graph, and folding it into the same file would make
 * those reachable from the app bundle. Two doors, two import zones - both exempted individually in
 * `eslint.config.js` rather than through a blanket allowance.
 *
 * All three symbols come straight from the mirror; `isSafeDeclaredImagePath()`'s module reaches two
 * launcher files that cannot be mirrored (`images/fetch-image.ts`, `lib/renderer-source.ts`), both
 * redirected to studio-owned stubs - see the `// Safe names` group in
 * `scripts/launcher-core.manifest.ts` for which, and why.
 *
 * Pure re-export only: no rule logic lives in this file. Adding a computation here would be exactly
 * the "rule re-implemented outside the mirror" story 007 exists to prevent.
 */
export { isSafeNewsDocumentName } from '../launcher-core/src/main/modules/home/news/feed-fetcher'
export { SAFE_NEWS_IMAGE_EXTENSIONS } from '../launcher-core/src/main/modules/home/images/paths'
export { isSafeDeclaredImagePath } from '../launcher-core/src/main/modules/home/images/resolve-feed-images'
