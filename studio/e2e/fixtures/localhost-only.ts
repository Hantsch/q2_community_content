import { test as base, expect } from '@playwright/test'

export type ExternalRequestRecord = { url: string }

export const test = base.extend<{
  externalRequests: ExternalRequestRecord[]
}>({
  externalRequests: async ({ page }, use) => {
    const externalRequests: ExternalRequestRecord[] = []

    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url())

      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        await route.continue()
        return
      }

      externalRequests.push({ url: url.toString() })
      await route.abort()
    })

    await use(externalRequests)
  },
})

export { expect }
