import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['html', { outputFolder: 'test-results', open: 'never' }]],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'chromium',
      // `e2e/harness/fixtures/` holds deliberately broken specs. They are reachable only through
      // `e2e/harness/negative.config.ts`; picking them up here would fail the real run for the
      // wrong reason. `negative-run.spec.ts` belongs to the `harness` project below.
      testIgnore: /e2e[\\/]harness[\\/]/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'harness',
      testDir: 'e2e/harness',
      testMatch: /negative-run\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
