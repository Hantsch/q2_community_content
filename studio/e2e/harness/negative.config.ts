import { defineConfig, devices } from '@playwright/test'

/**
 * A deliberately failing Playwright setup. It is used only by `e2e/harness/negative-run.spec.ts`,
 * which spawns it as a nested run to prove that a broken studio makes `npm run e2e` exit non-zero.
 *
 * `testDir` resolves to `e2e/harness/fixtures/`, which holds nothing but the two broken fixtures —
 * a nested run structurally cannot re-enter the real suite in `e2e/`.
 *
 * The port deliberately differs from the real suite's 5173: the nested run happens while the real
 * run's dev server still holds 5173, and `reuseExistingServer: false` would otherwise fail on a
 * port clash instead of on the failure the run is meant to demonstrate.
 */
const harnessUrl = 'http://127.0.0.1:5199'

// Playwright's own web server failures name `config.webServer` but never the URL they waited
// for, so the harness states it once while the config loads. `negative-run.spec.ts` asserts on
// both halves, so the announcement alone can never make the run look failed.
console.log(`[harness] waiting for the studio dev server at ${harnessUrl}`)

export default defineConfig({
  testDir: 'fixtures',
  outputDir: '../../test-results/harness-negative',
  workers: 1,
  retries: 0,
  use: {
    baseURL: harnessUrl,
    trace: 'off',
    screenshot: 'off',
  },
  reporter: [['line']],
  webServer: {
    // Overridable, so the broken-dev-server half never has to mutate the real config at runtime.
    command:
      process.env.E2E_WEBSERVER_COMMAND ??
      'npm run dev -- --port 5199 --strictPort --host 127.0.0.1',
    url: harnessUrl,
    reuseExistingServer: false,
    // Short on purpose: a deliberately broken command must fail fast, not hold up `npm run e2e`.
    timeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
