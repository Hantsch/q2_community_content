import { test, expect } from './fixtures/localhost-only'

test('the studio shell opens at the dev server URL', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Q2 Content Studio')
})

test('the shell heading is visible in the browser', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /Q2 Content Studio/i })).toBeVisible()
})
