/**
 * Lets `tsc` resolve the mirrored `resolve-feed-images.ts`'s
 * `import { NEWS_IMAGE_PATH_PREFIX, RENDERER_ORIGIN } from '../../../lib/renderer-source'` without
 * hand-editing the mirror. `tsconfig.json`'s `rootDirs` treats `src/launcher-core/src/main/lib` and
 * `src/mirror-runtime` as one merged directory for relative-import resolution purposes, so a
 * relative import that fails to resolve inside the former falls through to this file here - the
 * same target `launcherBoundary.ts` redirects that import to at runtime (Vite/Vitest). Kept as its
 * own module rather than folded into `rendererSourceStub.ts` so the merged-directory target has an
 * obvious, dedicated name (`renderer-source.ts`, matching what the mirror imports) instead of an
 * incidental one - exactly how `client.ts` stands in front of `homeClientStub.ts`.
 */
export * from './rendererSourceStub'
