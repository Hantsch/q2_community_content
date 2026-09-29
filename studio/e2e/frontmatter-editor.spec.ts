import type { Locator, Page } from '@playwright/test'
import { test, expect } from './fixtures/localhost-only'
import { FULL_TITLE, stubEditorFeed, UNKNOWN_TEMPLATE_TITLE } from './fixtures/editor-feed'

/**
 * Story 022 D3 - the frontmatter editor wired into the studio shell, against a stubbed feed
 * (`editor-feed.ts`). Nothing is written to disk: every check is on what the editor shows.
 */

async function openEntry(page: Page, title: string) {
  await stubEditorFeed(page)
  await page.goto('/')
  await page.getByRole('region', { name: 'Entries' }).getByRole('button', { name: title }).click()
  return page.getByRole('region', { name: 'Frontmatter editor' })
}

/** The text of the issue list a field points at through `aria-describedby`. */
async function issueTextOf(page: Page, field: Locator) {
  const ids = (await field.getAttribute('aria-describedby')) ?? ''
  const texts: string[] = []
  for (const id of ids.split(' ').filter(Boolean)) {
    texts.push((await page.locator(`[id="${id}"]`).textContent()) ?? '')
  }
  return texts.join(' ')
}

test('every contract field is shown as a field, order read-only', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)

  await expect(editor.getByLabel('Template')).toHaveValue('split')
  await expect(editor.getByLabel('Title')).toHaveValue(FULL_TITLE)
  await expect(editor.getByLabel('Image (required)')).toHaveValue('img/cover.png')
  await expect(editor.getByLabel('Visible from')).toHaveValue('2000-01-01T00:00:00Z')
  await expect(editor.getByLabel('Visible until')).toHaveValue('2099-01-01T00:00:00Z')
  await expect(editor.getByLabel('Visible from')).toHaveAttribute(
    'placeholder',
    '2026-08-01T00:00:00Z',
  )
  await expect(editor.getByLabel('Button 1 label')).toHaveValue('Repo')
  await expect(editor.getByLabel('Button 2 url')).toHaveValue(
    'https://raw.githubusercontent.com/q2/two',
  )
  await expect(editor.getByRole('button', { name: 'Add button' })).toBeVisible()

  const order = editor.getByLabel('Order')
  await expect(order).toHaveValue('10')
  await expect(order).not.toBeEditable()
  await expect(editor.getByText('Reordering happens in the library')).toBeVisible()
})

test('the field set follows the selected template', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  const template = editor.getByLabel('Template')

  await template.selectOption('text')
  await expect(editor.getByLabel(/^Image/)).toHaveCount(0)
  await expect(editor.getByText('Unsaved changes')).toBeVisible()

  await template.selectOption('banner')
  await expect(editor.getByLabel('Image (optional)')).toBeVisible()

  await template.selectOption('cover')
  await expect(editor.getByLabel('Image (required)')).toBeVisible()

  await template.selectOption('split')
  await expect(editor.getByLabel('Image (required)')).toBeVisible()
})

test('a button url on a wrong host is flagged while typing', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  const url = editor.getByLabel('Button 1 url')

  await expect(url).not.toHaveAttribute('aria-describedby', /.+/)

  await url.fill('https://evil.example/x')
  await expect(url).toHaveAttribute('aria-describedby', /.+/)
  expect(await issueTextOf(page, url)).toMatch(/button-url.*dropped/)

  await url.fill('https://github.com/q2/one')
  await expect(url).not.toHaveAttribute('aria-describedby', /.+/)
})

test('a fourth button is flagged as dropped', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)

  await editor.getByRole('button', { name: 'Add button' }).click()
  await editor.getByLabel('Button 4 label').fill('Fourth')
  const url = editor.getByLabel('Button 4 url')
  await url.fill('https://github.com/q2/four')

  expect(await issueTextOf(page, url)).toMatch(/button-cap.*dropped.*cap of 3/)
  // A dropped button is a warning: it does not block saving.
  await expect(editor.getByText(/blocks? saving/)).toHaveCount(0)
})

test('an invalid date is flagged and blocks saving', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  const from = editor.getByLabel('Visible from')

  await from.fill('2026-08-01')
  expect(await issueTextOf(page, from)).toMatch(/date.*not an instant/)
  await expect(editor.getByText('1 issue blocks saving')).toBeVisible()
  await expect(editor.getByText('Unsaved changes')).toBeVisible()

  await from.fill('2026-08-01T00:00:00Z')
  await expect(editor.getByText(/blocks? saving/)).toHaveCount(0)
})

test('an HTML tag in the title is refused', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  const title = editor.getByLabel('Title')

  await title.fill('Hello <b>world</b>')
  expect(await issueTextOf(page, title)).toMatch(/presentation.*HTML tag/)
  await expect(editor.getByText('1 issue blocks saving')).toBeVisible()
})

test('an unknown template is shown as declared with its warning', async ({ page }) => {
  const editor = await openEntry(page, UNKNOWN_TEMPLATE_TITLE)
  const template = editor.getByLabel('Template')

  await expect(template).toHaveValue('hologram')
  expect(await issueTextOf(page, template)).toMatch(/unknown template/)
})

test('an unreadable draft shows a notice and no form', async ({ page }) => {
  await stubEditorFeed(page)
  await page.goto('/')
  await page.getByRole('region', { name: 'Drafts' }).getByRole('button').first().click()

  const editor = page.getByRole('region', { name: 'Frontmatter editor' })
  await expect(editor.getByText(/the frontmatter cannot be read/)).toBeVisible()
  await expect(editor.getByLabel('Title')).toHaveCount(0)
})

test('editing issues no write request', async ({ page }) => {
  const requests: { method: string; url: string }[] = []
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url() }))
  const editor = await openEntry(page, FULL_TITLE)

  await editor.getByLabel('Title').fill('Edited title')
  await editor.getByLabel('Template').selectOption('text')
  await expect(editor.getByText('Unsaved changes')).toBeVisible()

  const writes = requests.filter(
    ({ method, url }) => url.includes('/__studio/') && method !== 'GET' && method !== 'HEAD',
  )
  expect(writes).toEqual([])
})

test('leaving a dirty entry asks first and keeps the edits when declined', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  const entries = page.getByRole('region', { name: 'Entries' })
  await editor.getByLabel('Title').fill('Edited title')

  const messages: string[] = []
  let accept = false
  page.on('dialog', (dialog) => {
    messages.push(dialog.message())
    void (accept ? dialog.accept() : dialog.dismiss())
  })

  await entries.getByRole('button', { name: UNKNOWN_TEMPLATE_TITLE }).click()
  expect(messages).toEqual(['Discard unsaved changes to full-entry.md?'])
  await expect(editor.getByLabel('Title')).toHaveValue('Edited title')

  // Picking the entry that is already open is not leaving it.
  await entries.getByRole('button', { name: FULL_TITLE }).click()
  expect(messages).toHaveLength(1)

  accept = true
  await entries.getByRole('button', { name: UNKNOWN_TEMPLATE_TITLE }).click()
  await expect(editor.getByLabel('Title')).toHaveValue(UNKNOWN_TEMPLATE_TITLE)
  expect(messages).toHaveLength(2)

  // The dropped draft is gone: coming back shows the entry as read, and asks nothing.
  await entries.getByRole('button', { name: FULL_TITLE }).click()
  await expect(editor.getByLabel('Title')).toHaveValue(FULL_TITLE)
  await expect(editor.getByText('Unsaved changes')).toHaveCount(0)
  expect(messages).toHaveLength(2)
})

test('closing the tab with unsaved changes asks first', async ({ page }) => {
  const editor = await openEntry(page, FULL_TITLE)
  await editor.getByLabel('Title').fill('Edited title')

  const dialogShown = page.waitForEvent('dialog')
  const closing = page.close({ runBeforeUnload: true })
  const dialog = await dialogShown
  expect(dialog.type()).toBe('beforeunload')
  await dialog.dismiss()
  await closing

  expect(page.isClosed()).toBe(false)
})
