import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { mirrorProvenancePlugin } from './src/mirror/provenance-plugin'
import { launcherBoundaryPlugin } from './src/mirror-runtime/launcherBoundary'
import { newsImgMiddlewarePlugin } from './src/mirror-runtime/newsImgMiddleware'

export default defineConfig({
  // `launcherBoundaryPlugin` resolves the mirrored home client's `../client` import to a studio
  // stub, for importers under `src/launcher-core/` only. It is wired identically in
  // `vitest.config.ts`, so dev, build, preview and the test run see the same module graph.
  // `newsImgMiddlewarePlugin` serves `news/img/` under `/news-img/` for the mirror-check page
  // (story 008 D5, AC6) - dev-server only, read-only, path-confined.
  // `mirrorProvenancePlugin` exposes `virtual:mirror-provenance` (story 009 D4) so the studio
  // surface imports mirror state as structured data at build time, never a runtime fetch.
  plugins: [
    launcherBoundaryPlugin(),
    newsImgMiddlewarePlugin(),
    mirrorProvenancePlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/launcher-core/src/shared'),
    },
  },
})
