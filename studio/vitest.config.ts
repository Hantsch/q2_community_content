import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/launcher-core/src/shared'),
    },
  },
  test: {
    environment: 'node',
    // Tests that render components need a DOM and opt in per file with a
    // `// @vitest-environment jsdom` docblock, so plain node tests keep the faster
    // `node` environment. Mirrors the launcher repository's convention.
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.ts'],
  },
})
