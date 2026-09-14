/**
 * Lets `tsc` resolve the mirrored `feed-fetcher.ts`'s `import type { NewsSource } from './harness'`
 * without mirroring `news/harness.ts` itself. That file is the launcher's UI-harness backdoor: it
 * reaches `lib/ui-harness.ts` and from there `lib/paths.ts` and `electron`, none of which belong in
 * this content repository for the sake of one type alias.
 *
 * `tsconfig.json`'s `rootDirs` treats `src/launcher-core/src/main/modules/home/news` and
 * `src/mirror-runtime` as one merged directory for relative-import resolution, so `./harness` -
 * absent from the mirror - falls through to this file, the same mechanism `client.ts` uses for
 * `SlideButtons.tsx`. Unlike that one, no runtime redirect is needed: the import is `import type`,
 * so it is erased and no JavaScript import is ever emitted for it.
 *
 * The type below is copied verbatim from the launcher's `src/main/modules/home/news/harness.ts`.
 */

/** Where `home`'s news fetcher should get `news/index.json` and its documents from. */
export type NewsSource =
  { kind: 'production' } | { kind: 'loopback'; base: string } | { kind: 'skip' }
