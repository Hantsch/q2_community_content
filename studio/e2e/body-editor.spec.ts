import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import {
  stubBodyEditorFeed,
  TEXT_BODY,
  TEXT_TITLE,
  UNTITLED_FILE,
} from './fixtures/body-editor-feed'

/**
 * Story 023 D3 - the body editor wired into the studio shell and the live preview, against a
 * stubbed feed (`body-editor-feed.ts`). Nothing is written to disk.
 */

async function openEntry(page: Page, name: string = TEXT_TITLE) {
  await stubBodyEditorFeed(page)
  await page.goto('/')
  await page.getByRole('region', { name: 'Entries' }).getByRole('button', { name }).filter({ hasNotText: /^(Un)?publish$/i }).click()
  return page.getByTestId('body-editor').getByLabel('Body')
}

function frameOf(page: Page) {
  return page.frameLocator('iframe[title="Slide preview"]')
}

test('the body is edited as the raw text the author types', async ({ page }) => {
  const body = await openEntry(page)
  await expect(body).toHaveValue(TEXT_BODY)

  await body.fill('  Line one\n\nLine   two  \n')
  await expect(body).toHaveValue('  Line one\n\nLine   two  \n')
  await expect(page.getByText('Unsaved changes')).toBeVisible()
})

test('the preview follows the body while typing, without a save or a reload', async ({ page }) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/__studio/') && request.method() !== 'GET') {
      writes.push(`${request.method()} ${request.url()}`)
    }
  })
  const body = await openEntry(page)
  const hero = frameOf(page).locator('.home-hero-body')
  await expect(hero).toHaveText(TEXT_BODY)
  await page.evaluate(() => {
    ;(window as unknown as { marker: string }).marker = 'kept'
  })

  await body.fill('First edit')
  await expect(hero).toHaveText('First edit')
  await body.pressSequentially(' and more')
  await expect(hero).toHaveText('First edit and more')

  expect(writes).toEqual([])
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe('kept')
})

test('an emptied body is flagged in the editor as the reason the entry is dropped', async ({
  page,
}) => {
  const body = await openEntry(page, UNTITLED_FILE)
  const finding = page.locator('[data-testid="body-finding"][data-code="empty-body"]')
  await expect(finding).toHaveCount(0)

  await body.fill('')
  await expect(finding).toBeVisible()
  await expect(frameOf(page).locator('.home-hero-body')).toHaveCount(0)
  await expect(page.getByText('nothing', { exact: false }).first()).toBeVisible()

  await body.fill('   \n  ')
  await expect(finding).toBeVisible()
  await expect(frameOf(page).locator('.home-hero-body')).toHaveCount(0)
})

test('pasted rich text arrives as plain text and the slide body holds no markup', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const body = await openEntry(page)
  await body.fill('')
  await page.evaluate(async () => {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob(['<b>x</b>'], { type: 'text/html' }),
        'text/plain': new Blob(['x'], { type: 'text/plain' }),
      }),
    ])
  })
  await body.focus()
  await page.keyboard.press('Control+V')

  await expect(body).toHaveValue('x')
  const hero = frameOf(page).locator('.home-hero-body')
  await expect(hero).toHaveText('x')
  await expect(hero.locator('*')).toHaveCount(0)
})

test('markdown the launcher does not render is flagged while typing', async ({ page }) => {
  const body = await openEntry(page)
  await body.fill('')
  await body.pressSequentially('**bold** and [a](https://x)')

  const findings = page.locator('[data-testid="body-finding"][data-code="literal-markdown"]')
  await expect(findings).toHaveCount(2)
  await expect(findings.filter({ hasText: 'bold' })).toHaveCount(1)
  await expect(findings.filter({ hasText: 'link' })).toHaveCount(1)
})
