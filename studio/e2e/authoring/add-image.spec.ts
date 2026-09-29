import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import type { Page } from '@playwright/test'
import { test, expect } from '../fixtures/scratch-repo'

const ALPHA = 'news/2026-01-01-alpha.md'

async function openAsTemplate(page: Page, template: string): Promise<void> {
  await page.goto('/')
  await page.getByRole('region', { name: 'Entries' }).getByText('Alpha', { exact: true }).click()
  await expect(page.getByLabel('Title')).toHaveValue('Alpha')
  await page.getByLabel('Template').selectOption(template)
}

/** A blank PNG of the given size, created inside the page. */
async function pngBytes(page: Page, width: number, height: number): Promise<Buffer> {
  const bytes = await page.evaluate(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w, h)
      canvas.getContext('2d')?.fillRect(0, 0, w, h)
      const blob = await canvas.convertToBlob({ type: 'image/png' })
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    },
    [width, height],
  )
  return Buffer.from(bytes)
}

async function pick(page: Page, name: string, buffer: Buffer): Promise<void> {
  await page.getByLabel('Choose image').setInputFiles({ name, mimeType: 'image/png', buffer })
  await expect(page.getByLabel('File name')).toHaveValue(name)
}

async function addImage(page: Page, name: string): Promise<void> {
  await pick(page, name, await pngBytes(page, 2560, 640))
  await page.getByRole('button', { name: 'Add image' }).click()
  await expect(page.locator('#field-image')).toHaveValue(`img/${name}`)
}

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()
}

function listImages(root: string): string[] {
  const dir = join(root, 'news/img')
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

function hashTree(root: string): Map<string, string> {
  const out = new Map<string, string>()
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) walk(full)
      else {
        const key = relative(root, full).replaceAll('\\', '/')
        out.set(key, createHash('sha256').update(readFileSync(full)).digest('hex'))
      }
    }
  }
  walk(root)
  return out
}

test('an image picked in the studio lands in news/img/', async ({ page, scratch }) => {
  await openAsTemplate(page, 'cover')
  await addImage(page, 'picked.png')
  expect(listImages(scratch.root)).toContain('picked.png')
})

test('an image dropped onto the entry lands in news/img/', async ({ page, scratch }) => {
  await openAsTemplate(page, 'cover')
  const bytes = Array.from(await pngBytes(page, 2560, 640))
  await page.getByRole('group', { name: 'Drop an image here' }).evaluate((zone, data) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File([new Uint8Array(data)], 'dropped.png', { type: 'image/png' }))
    zone.dispatchEvent(
      new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }),
    )
  }, bytes)
  await expect(page.getByLabel('File name')).toHaveValue('dropped.png')
  await page.getByRole('button', { name: 'Add image' }).click()
  await expect(page.locator('#field-image')).toHaveValue('img/dropped.png')
  expect(listImages(scratch.root)).toContain('dropped.png')
})

test('a name the launcher would reject is refused before anything is written, naming the rule', async ({
  page,
  scratch,
}) => {
  await openAsTemplate(page, 'cover')
  const before = listImages(scratch.root)
  for (const bad of ['my image.png', 'hero.gif']) {
    await pick(page, bad, await pngBytes(page, 2560, 640))
    await page.getByRole('button', { name: 'Add image' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(bad === 'hero.gif' ? 'extension: ' : 'unsafe-name: ')
    expect(listImages(scratch.root)).toEqual(before)
    await expect(page.getByLabel('File name')).toHaveValue(bad)
  }
})

test("adding an image sets the entry's image field to img/<name> and saving writes it", async ({
  page,
  scratch,
}) => {
  await openAsTemplate(page, 'cover')
  await addImage(page, 'saved.png')
  await save(page)
  expect(scratch.readFile(ALPHA)).toMatch(/^image: img\/saved\.png\s*$/m)
})

test("the template's image guidance from its kit README is shown while choosing", async ({
  page,
}) => {
  await openAsTemplate(page, 'cover')
  const guidance = page.getByRole('region', { name: 'Guidance' })
  await expect(guidance).toContainText('2560×640')
  await page.getByLabel('Template').selectOption('split')
  await expect(guidance).toContainText('900×900')
})

test('a mismatched image is warned about with expected and actual size and needs a deliberate confirmation', async ({
  page,
}) => {
  await openAsTemplate(page, 'cover')
  await pick(page, 'small.png', await pngBytes(page, 800, 600))
  const warnings = page.getByRole('region', { name: 'Warnings' })
  await expect(warnings).toContainText('Expected')
  await expect(warnings).toContainText('Actual: 800×600 px')
  const add = page.getByRole('button', { name: 'Add image' })
  await expect(add).toBeDisabled()
  await page.getByLabel('Add anyway — the size does not match this template').check()
  await expect(add).toBeEnabled()
})

test('adding an image writes only into news/img/ and the entry being edited', async ({
  page,
  scratch,
}) => {
  await openAsTemplate(page, 'cover')
  const before = hashTree(scratch.root)
  await addImage(page, 'only.png')
  await save(page)
  const after = hashTree(scratch.root)

  const added = [...after.keys()].filter((key) => !before.has(key))
  const removed = [...before.keys()].filter((key) => !after.has(key))
  const changed = [...after.keys()].filter(
    (key) => before.has(key) && before.get(key) !== after.get(key),
  )
  expect(added).toEqual(['news/img/only.png'])
  expect(removed).toEqual([])
  expect(changed).toEqual([ALPHA])
})

test('replacing an image keeps the old file and the validation panel reports it as unreferenced', async ({
  page,
  scratch,
}) => {
  await openAsTemplate(page, 'cover')
  await addImage(page, 'first.png')
  await save(page)
  await addImage(page, 'second.png')
  await save(page)
  expect(listImages(scratch.root)).toEqual(expect.arrayContaining(['first.png', 'second.png']))

  await page.reload()
  const repo = page.getByRole('region', { name: 'Repository findings' })
  await expect(repo).toContainText('news/img/first.png')
  await expect(repo).not.toContainText('news/img/second.png')
})
