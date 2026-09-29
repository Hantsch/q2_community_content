import { defineConfig, devices } from '@playwright/test'

import { SCRATCH_ROOT } from './e2e/authoring/prepare-scratch'

export default defineConfig({
  testDir: 'e2e',
  // One worker: `e2e/authoring/` specs share one scratch repository and would reset each other.
  workers: 1,
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['html', { outputFolder: 'test-results', open: 'never' }]],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: false,
    },
    {
      // Write-safe server for `e2e/authoring/`: the bridge serves a scratch repository under the OS
      // temp dir, never the checkout. The bridge refuses to start if the root is not a marked
      // scratch directory.
      command:
        'tsx e2e/authoring/prepare-scratch.ts && vite --port 5174 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      env: { STUDIO_E2E_REPO_ROOT: SCRATCH_ROOT },
    },
  ],
  projects: [
    {
      name: 'chromium',
      // `e2e/harness/fixtures/` holds deliberately broken specs. They are reachable only through
      // `e2e/harness/negative.config.ts`; picking them up here would fail the real run for the
      // wrong reason. `negative-run.spec.ts` belongs to the `harness` project below.
      testIgnore: /e2e[\\/](harness|authoring)[\\/]/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authoring',
      testDir: 'e2e/authoring',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5174' },
    },
    {
      name: 'harness',
      testDir: 'e2e/harness',
      testMatch: /negative-run\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
