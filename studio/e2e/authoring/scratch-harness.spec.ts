import { test, expect } from '../fixtures/scratch-repo'

test('the authoring server reads the scratch repository, not the checkout', async ({
  page,
  scratch,
}) => {
  expect(scratch.readFile('news/index.json')).toContain('"alpha"')

  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const drafts = page.getByRole('region', { name: 'Drafts' })
  await expect(region.getByText('Alpha', { exact: true })).toBeVisible()
  await expect(region.getByText('Beta', { exact: true })).toBeVisible()
  await expect(drafts.getByRole('button', { name: /Draft/ })).toBeVisible()
  await expect(region.getByText('Welcome to the Quake II community')).toHaveCount(0)
})
