import { test } from '@playwright/test'

/**
 * Deliberately trivial: this fixture only gives the nested harness run something to schedule. With
 * `E2E_WEBSERVER_COMMAND` set to a command that never serves the harness URL, the run fails during
 * web server startup and this test never executes.
 */
test('the studio answers on the harness port', async ({ page }) => {
  await page.goto('/')
})
