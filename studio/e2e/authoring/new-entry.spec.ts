import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Page } from '@playwright/test'

import { test, expect } from '../fixtures/scratch-repo'
import { parseTemplateGuidance } from '../../src/new-entry/template-guidance'

// Read-only source of truth: the real kit, never the scratch copy. LF-normalised like the bridge.
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../news/_templates')
const readKit = (path: string): string =>
  readFileSync(resolve(KIT, path), 'utf8').replaceAll('\r\n', '\n')

/** The studio's own builder, run through the dev server: its module graph needs Vite to resolve. */
function expectedText(page: Page, templateText: string, title: string): Promise<string> {
  return page.evaluate(
    async ([text, name]) => {
      const modulePath = '/src/new-entry/new-entry.ts'
      const mod = (await import(/* @vite-ignore */ modulePath)) as {
        buildNewEntryText: (t: string, n: string) => string
      }
      return mod.buildNewEntryText(text, name)
    },
    [templateText, title],
  )
}

async function openDialog(page: Page): Promise<ReturnType<Page['getByRole']>> {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Entries' })).toBeVisible()
  await page.getByRole('button', { name: 'New entry' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  return dialog
}

test("the new-entry dialog offers the four templates with the kit's guidance", async ({ page }) => {
  const guidance = parseTemplateGuidance(readKit('README.md'))
  expect(guidance.map((g) => g.template)).toEqual(['split', 'banner', 'text', 'cover'])
  const dialog = await openDialog(page)
  await expect(dialog.getByRole('radio')).toHaveCount(4)
  for (const g of guidance) {
    await expect(dialog.getByRole('radio', { name: new RegExp(`^${g.template} `) })).toBeVisible()
    await expect(dialog.getByText(g.useCase, { exact: true })).toBeVisible()
  }
})

test('a new entry is written from its kit template', async ({ page, scratch }) => {
  const dialog = await openDialog(page)
  await dialog.getByRole('radio', { name: /^cover / }).check()
  await dialog.getByLabel('Title', { exact: true }).fill('Fresh cover news')
  await dialog.getByLabel('Date', { exact: true }).fill('2026-02-03')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const written = scratch.readFile('news/2026-02-03-fresh-cover-news.md')
  expect(written).toBe(await expectedText(page, readKit('cover/template.md'), 'Fresh cover news'))
  expect(written).toContain('# visibleFrom: 2026-01-01T00:00:00Z')
  expect(written).toContain('#   - label: <Button label>')
})

test('the file name is dated and slugged from the title, and the slug is editable', async ({
  page,
  scratch,
}) => {
  const dialog = await openDialog(page)
  const fileName = dialog.getByTestId('new-entry-file-name')
  await dialog.getByLabel('Date', { exact: true }).fill('2026-03-04')
  await dialog.getByLabel('Title', { exact: true }).fill('Hello, World Über!')
  await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue('hello-world-uber')
  await expect(fileName).toHaveText('2026-03-04-hello-world-uber.md')

  await dialog.getByLabel('Slug', { exact: true }).fill('my-slug')
  await dialog.getByLabel('Title', { exact: true }).fill('Something else entirely')
  await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue('my-slug')
  await expect(fileName).toHaveText('2026-03-04-my-slug.md')

  await dialog.getByRole('radio', { name: /^text / }).check()
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(scratch.readFile('news/2026-03-04-my-slug.md')).toContain('title: Something else entirely')
})

test('a new entry is a draft and index.json is untouched', async ({ page, scratch }) => {
  const indexBefore = scratch.readFile('news/index.json')
  const dialog = await openDialog(page)
  await dialog.getByRole('radio', { name: /^banner / }).check()
  await dialog.getByLabel('Title', { exact: true }).fill('Brand new draft')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  const drafts = page.getByRole('region', { name: 'Drafts' })
  const row = drafts.getByRole('button').filter({ hasText: 'Brand new draft' })
  await expect(row).toBeVisible()
  await expect(row).toContainText(/draft/i)
  expect(scratch.readFile('news/index.json')).toBe(indexBefore)
})

test('an existing file name is refused naming the existing entry', async ({ page, scratch }) => {
  const before = scratch.readFile('news/2026-01-01-alpha.md')
  const dialog = await openDialog(page)
  await dialog.getByRole('radio', { name: /^text / }).check()
  await dialog.getByLabel('Title', { exact: true }).fill('Whatever')
  await dialog.getByLabel('Date', { exact: true }).fill('2026-01-01')
  await dialog.getByLabel('Slug', { exact: true }).fill('alpha')
  const refusal = dialog.getByRole('alert')
  await expect(refusal).toContainText('2026-01-01-alpha.md already exists')
  await expect(refusal).toContainText('Alpha')
  await expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled()
  expect(scratch.readFile('news/2026-01-01-alpha.md')).toBe(before)
})

test('a slug that matches an existing id is refused', async ({ page }) => {
  const dialog = await openDialog(page)
  await dialog.getByRole('radio', { name: /^text / }).check()
  await dialog.getByLabel('Title', { exact: true }).fill('Whatever')
  await dialog.getByLabel('Date', { exact: true }).fill('2026-05-05')
  await dialog.getByLabel('Slug', { exact: true }).fill('beta')
  const refusal = dialog.getByRole('alert')
  await expect(refusal).toContainText('beta')
  await expect(refusal).toContainText('Beta')
  await expect(refusal).toContainText('2026-01-02-beta.md')
  await expect(dialog.getByRole('button', { name: 'Create' })).toBeDisabled()
})

test('the created entry opens in the editor with required fields empty', async ({ page }) => {
  const dialog = await openDialog(page)
  await dialog.getByRole('radio', { name: /^cover / }).check()
  await dialog.getByLabel('Title', { exact: true }).fill('Opened cover')
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Opened cover')
  await expect(page.getByLabel('Image (required)')).toHaveValue('')
  const values = await page
    .locator('input[type="text"], textarea, select')
    .evaluateAll((els) => els.map((el) => (el as HTMLInputElement).value))
  expect(values.filter((v) => v.includes('<'))).toEqual([])
  await expect(page.getByLabel('Body')).not.toHaveValue(/</)
})
