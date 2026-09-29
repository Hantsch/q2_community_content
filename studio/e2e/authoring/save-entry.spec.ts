import { test, expect } from '../fixtures/scratch-repo'

const ALPHA = 'news/2026-01-01-alpha.md'

async function openEntry(page: import('@playwright/test').Page, title: string): Promise<void> {
  await page.goto('/')
  const region = page.getByRole('region', { name: 'Entries' })
  await region.getByText(title, { exact: true }).click()
  await expect(page.getByLabel('Title')).toHaveValue(title)
}

test("AC1: saving writes the edited title and body to the entry's .md file", async ({
  page,
  scratch,
}) => {
  await openEntry(page, 'Alpha')
  await page.getByLabel('Title').fill('Alpha renamed')
  await page.getByLabel('Body').fill('A new body.')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()

  const text = scratch.readFile(ALPHA)
  expect(text).toContain('title: Alpha renamed')
  expect(text).toContain('A new body.')
  expect(text).toContain('# kept by the writer')
  await expect(page.getByText('Unsaved changes')).toHaveCount(0)
})

test("AC2: saving a published entry brings its index row's order into line with the document", async ({
  page,
  scratch,
}) => {
  const before = JSON.parse(scratch.readFile('news/index.json')) as {
    entries: { file: string; order: number }[]
  }
  const alphaRow = JSON.stringify(before.entries.find((e) => e.file.includes('alpha')))
  await openEntry(page, 'Beta')
  await page.getByLabel('Title').fill('Beta retitled')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()

  const after = JSON.parse(scratch.readFile('news/index.json')) as typeof before
  expect(after.entries.find((e) => e.file.includes('beta'))?.order).toBe(25)
  expect(JSON.stringify(after.entries.find((e) => e.file.includes('alpha')))).toBe(alphaRow)
})

test('AC5: a save that would drop the entry asks first and writes only after confirming', async ({
  page,
  scratch,
}) => {
  await openEntry(page, 'Alpha')
  const original = scratch.readFile(ALPHA)
  await page.getByLabel('Body').fill('')
  await page.getByRole('button', { name: 'Save', exact: true }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('The launcher will drop this entry:')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)
  expect(scratch.readFile(ALPHA)).toBe(original)

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Save anyway' }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()
  expect(scratch.readFile(ALPHA)).not.toBe(original)
})

test('AC6: a file changed on disk since opening is not overwritten silently', async ({
  page,
  scratch,
}) => {
  await openEntry(page, 'Alpha')
  const external = scratch.readFile(ALPHA).replace('The first scratch entry.', 'Changed elsewhere.')
  scratch.writeFile(ALPHA, external)

  await page.getByLabel('Title').fill('Alpha mine')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const notice = page.getByRole('alert').filter({ hasText: 'changed on disk' })
  await expect(notice).toContainText('news/2026-01-01-alpha.md')
  expect(scratch.readFile(ALPHA)).toBe(external)

  await notice.getByRole('button', { name: 'Overwrite' }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()
  expect(scratch.readFile(ALPHA)).toContain('title: Alpha mine')
})

test('AC8: saving reaches no external host', async ({ page, scratch, externalRequests }) => {
  expect(scratch.readFile(ALPHA)).toContain('title: Alpha')
  await openEntry(page, 'Alpha')
  await page.getByLabel('Title').fill('Alpha offline')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()
  expect(externalRequests).toEqual([])
})
