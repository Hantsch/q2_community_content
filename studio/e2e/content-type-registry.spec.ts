import { test, expect } from './fixtures/localhost-only'

// Story 014 D3 (AC1). D4 adds further cases to this same file for AC3/AC4/AC5.
test('the navigation lists every registered content type', async ({ page }) => {
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Content types' })
  await expect(nav.getByRole('button', { name: 'News' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Engines' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Game data' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Packs' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Mods' })).toBeVisible()
  await expect(nav.getByRole('button', { name: 'Config templates' })).toBeVisible()
})

// Story 014 D4 (AC3).
test('packs, mods and config_templates are shown as reserved with their concept document', async ({
  page,
}) => {
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Content types' })
  const cases = [
    { name: 'Packs', conceptPath: 'docs/concepts/packs-content.md' },
    { name: 'Mods', conceptPath: 'docs/concepts/mods-content.md' },
    { name: 'Config templates', conceptPath: 'docs/concepts/config-templates-content.md' },
  ]

  for (const { name, conceptPath } of cases) {
    await nav.getByRole('button', { name }).click()
    await expect(page.getByText(/reserved — the launcher does not read this yet/)).toBeVisible()
    await expect(page.getByText(conceptPath)).toBeVisible()
  }
})

// Story 014 D4 (AC4).
test('engines and gamedata are shown as read by the launcher, not editable here', async ({
  page,
}) => {
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Content types' })

  for (const name of ['Engines', 'Game data']) {
    await nav.getByRole('button', { name }).click()
    await expect(page.getByText(/read by the launcher, not editable here yet/)).toBeVisible()
  }
})

// Story 014 D4 (AC5).
test('selecting a type that is not implemented explains its state and offers no dead control', async ({
  page,
}) => {
  await page.goto('/')

  const nav = page.getByRole('navigation', { name: 'Content types' })
  await nav.getByRole('button', { name: 'Packs' }).click()

  const contentRegion = page.locator('main > div.flex.gap-8 > div').last()
  await expect(
    contentRegion.getByText(/reserved — the launcher does not read this yet/),
  ).toBeVisible()
  await expect(contentRegion.locator('a')).toHaveCount(0)
  await expect(contentRegion.locator('button')).toHaveCount(0)
})
