/**
 * Lets `tsc` resolve the mirrored `SlideButtons.tsx`'s `import { openSlideUrl } from '../client'`
 * without hand-editing the mirror. `tsconfig.json`'s `rootDirs` treats
 * `src/launcher-core/src/renderer/src/modules/home` and `src/mirror-runtime` as one merged
 * directory for relative-import resolution purposes, so a relative import that fails to resolve
 * inside the former falls through to this file here - the same target
 * `launcherBoundary.ts` redirects that import to at runtime (Vite/Vitest). Kept as its own module
 * rather than folded into `homeClientStub.ts` so the merged-directory target has an obvious,
 * dedicated name (`client.ts`, matching what the mirror imports) instead of an incidental one.
 */
export * from './homeClientStub'
