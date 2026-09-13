import { test, expect } from './fixtures/localhost-only'

test('the studio run requests nothing beyond localhost', async ({ page, externalRequests }) => {
  await page.goto('/')

  expect(externalRequests).toHaveLength(0)
})

test('an external request is aborted and reported', async ({ page, externalRequests }) => {
  await page.goto('/')

  await page.evaluate(() => fetch('https://example.com/').catch(() => {}))

  await expect.poll(() => externalRequests.length).toBeGreaterThan(0)
  expect(externalRequests.some((request) => request.url.includes('example.com'))).toBe(true)
})
