import { test, expect } from '@playwright/test'

/**
 * Deliberately broken: this fixture exists to fail, so `negative-run.spec.ts` can assert that the
 * failure output names what was expected. It is reachable only through
 * `e2e/harness/negative.config.ts` and is never part of the real suite, which is why it imports
 * `test` from `@playwright/test` instead of the localhost-only fixture.
 */
const missingHeading = 'This Heading Does Not Exist On The Studio Page'

test('a heading that is absent from the shell fails the assertion', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: missingHeading })).toBeVisible({ timeout: 3000 })
})
