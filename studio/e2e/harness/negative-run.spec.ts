import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { test, expect } from '../fixtures/localhost-only'

/**
 * AC4: a broken studio has to make `npm run e2e` exit non-zero and say what was expected. Both
 * halves are proven by spawning a nested Playwright run against `e2e/harness/negative.config.ts`,
 * whose `testDir` only ever sees `e2e/harness/fixtures/` — the real suite cannot be re-entered.
 */
const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const harnessConfig = 'e2e/harness/negative.config.ts'
const harnessUrl = 'http://127.0.0.1:5199'
const missingHeading = 'This Heading Does Not Exist On The Studio Page'

// The Playwright CLI is spawned through `process.execPath` rather than `npx`, because `npx` is a
// `.cmd` shim on Windows that only resolves through a shell.
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli')

// A nested run launches a browser and a dev server, so it is slow by nature; these bounds only
// have to be loud, not tight. The outer timeout stays above the spawn timeout, so a hung child is
// reported as such instead of as an expired test.
const spawnTimeoutMs = 60_000
const testTimeoutMs = 90_000

type HarnessRun = {
  status: number | null
  output: string
}

function runHarness(specFilter: string, extraEnv: Record<string, string> = {}): HarnessRun {
  // An inherited `E2E_WEBSERVER_COMMAND` would silently break the run that is supposed to reach a
  // working dev server, so each run states its own web server command or none at all.
  const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0' }
  delete env.E2E_WEBSERVER_COMMAND
  Object.assign(env, extraEnv)

  const run = spawnSync(
    process.execPath,
    [playwrightCli, 'test', '--config', harnessConfig, specFilter],
    {
      cwd: studioRoot,
      encoding: 'utf8',
      // `spawnSync` reports a non-zero status instead of throwing, which is the thing under test.
      env,
      // The bound on a hanging nested run. Playwright's own test timeout cannot serve here:
      // `spawnSync` blocks the worker, so nothing in this process runs until the child returns.
      timeout: spawnTimeoutMs,
    },
  )

  // A run that never started would report `status: null`, which must not read as "failed as
  // expected" — so a spawn error is raised rather than asserted on.
  if (run.error) {
    throw run.error
  }

  return { status: run.status, output: `${run.stdout ?? ''}${run.stderr ?? ''}` }
}

test('a missing shell element fails the run and names what was expected', () => {
  test.setTimeout(testTimeoutMs)

  const run = runHarness('missing-element.spec.ts')

  expect(run.status).not.toBe(0)
  expect(run.output).toContain(missingHeading)
})

test('a dev server that cannot start fails the run', () => {
  test.setTimeout(testTimeoutMs)

  const run = runHarness('server.spec.ts', {
    // Read only by the negative config, so the real config is never mutated to produce a failure.
    E2E_WEBSERVER_COMMAND: 'node -e "process.exit(1)"',
  })

  expect(run.status).not.toBe(0)
  expect(run.output).toContain('config.webServer')
  expect(run.output).toContain(harnessUrl)
})
