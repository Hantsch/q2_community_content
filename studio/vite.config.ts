import path from 'node:path'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

import { fileBridgePlugin } from './src/bridge/file-bridge-plugin'
import { mirrorProvenancePlugin } from './src/mirror/provenance-plugin'
import { launcherBoundaryPlugin } from './src/mirror-runtime/launcherBoundary'

export default defineConfig({
  // `launcherBoundaryPlugin` resolves the mirrored home client's `../client` import to a studio
  // stub, for importers under `src/launcher-core/` only. It is wired identically in
  // `vitest.config.ts`, so dev, build, preview and the test run see the same module graph.
  // `fileBridgePlugin` (story 015 D3) wires the local file bridge's middleware into the dev
  // server, `apply: 'serve'` so it never reaches a production build. It answers both the
  // `/__studio/fs/` routes and `/news-img/<filename>` (folded in from the now-deleted
  // `newsImgMiddleware.ts`) for the mirror-check page (story 008 D5, AC6) - dev-server only,
  // read-only, path-confined via `resolveBridgePath`.
  // `mirrorProvenancePlugin` exposes `virtual:mirror-provenance` (story 009 D4) so the studio
  // surface imports mirror state as structured data at build time, never a runtime fetch.
  plugins: [
    launcherBoundaryPlugin(),
    fileBridgePlugin(),
    mirrorProvenancePlugin(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/launcher-core/src/shared'),
    },
  },
  server: {
    // Pinned explicitly (story 015 Decisions, AC6): the loopback bind must not silently widen
    // to all interfaces from a later, unrelated config edit relying on Vite's own default.
    host: '127.0.0.1',
  },
})
