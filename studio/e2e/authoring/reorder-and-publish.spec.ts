import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { REORDER_PUBLISH_FIXTURE } from './prepare-scratch'
import { test, expect } from '../fixtures/scratch-repo'

test.use({ fixtureName: REORDER_PUBLISH_FIXTURE })

test("the writable harness serves the fixture tree, not the repository's news/", async ({
  page,
  scratch,
}) => {
  expect(scratch.readFile('news/2026-09-01-a.md')).toContain('title: Entry A')

  await page.goto('/')

  const entries = page.getByRole('region', { name: 'Entries' })
  const drafts = page.getByRole('region', { name: 'Drafts' })
  for (const title of ['Entry A', 'Entry B', 'Entry C', 'Entry D']) {
    await expect(entries.getByText(title, { exact: true })).toBeVisible()
  }
  await expect(drafts.getByRole('button', { name: /^(?!Publish).*Draft OK/ })).toBeVisible()
  await expect(drafts.getByRole('button', { name: /^(?!Publish).*draft-dropped/ })).toBeVisible()
  await expect(entries.getByText('Welcome to the Quake II community')).toHaveCount(0)
})

const FILES = {
  a: 'news/2026-09-01-a.md',
  b: 'news/2026-09-02-b.md',
  c: 'news/2026-09-03-c.md',
  d: 'news/2026-09-04-d.md',
} as const
const TITLES = { a: 'Entry A', b: 'Entry B', c: 'Entry C', d: 'Entry D' } as const
type Key = keyof typeof FILES

interface Scratch {
  readFile(path: string): string
}

function diskOrder(scratch: Scratch, key: Key): number {
  const match = /^order:\s*(\d+)/m.exec(scratch.readFile(FILES[key]))
  return Number(match?.[1])
}

function indexOrders(scratch: Scratch): { file: string; order: number }[] {
  return (
    JSON.parse(scratch.readFile('news/index.json')) as {
      entries: { file: string; order: number }[]
    }
  ).entries
}

async function expectListMatchesDisk(page: Page, scratch: Scratch): Promise<void> {
  const keys = (Object.keys(FILES) as Key[]).sort(
    (x, y) => diskOrder(scratch, x) - diskOrder(scratch, y),
  )
  const shown = page
    .getByRole('region', { name: 'Order' })
    .getByRole('listitem')
    .filter({ hasText: /^.*Entry [A-D]/ })
  await expect(shown).toHaveCount(4)
  for (const [i, key] of keys.entries()) {
    await expect(shown.nth(i)).toContainText(TITLES[key])
    await expect(shown.nth(i)).toContainText(`Order: ${diskOrder(scratch, key)}`)
  }
}

async function drag(page: Page, from: Key, onto: Key): Promise<void> {
  const region = page.getByRole('region', { name: 'Order' })
  await region
    .getByLabel(`Drag ${TITLES[from]}`)
    .dragTo(region.getByRole('listitem').filter({ hasText: TITLES[onto] }))
}

test('dragging an entry writes the new order to index.json and to its frontmatter', async ({
  page,
  scratch,
}) => {
  await page.goto('/')
  await expectListMatchesDisk(page, scratch)
  await drag(page, 'c', 'b')

  await expect(page.getByRole('status').getByText('Moved: c')).toBeVisible()
  expect(diskOrder(scratch, 'c')).toBe(15)
  const row = indexOrders(scratch).find((entry) => entry.file === '2026-09-03-c.md')
  expect(row?.order).toBe(15)
  const shown = page.getByRole('region', { name: 'Order' }).getByRole('listitem')
  await expect(shown.nth(1)).toContainText('Entry C')
  await expectListMatchesDisk(page, scratch)
})

test("dragging into a gap leaves every other entry's files byte-identical", async ({
  page,
  scratch,
}) => {
  const others = [
    FILES.a,
    FILES.b,
    FILES.d,
    'news/2026-09-20-draft-ok.md',
    'news/2026-09-20-draft-dropped.md',
  ]
  const before = others.map((file) => scratch.readFile(file))
  const indexBefore = indexOrders(scratch)
  await page.goto('/')
  await drag(page, 'c', 'b')
  await expect(page.getByRole('status').getByText('Moved: c')).toBeVisible()

  expect(others.map((file) => scratch.readFile(file))).toEqual(before)
  const indexAfter = indexOrders(scratch)
  for (const row of indexAfter.filter((entry) => entry.file !== '2026-09-03-c.md')) {
    expect(row).toEqual(indexBefore.find((entry) => entry.file === row.file))
  }
})

test('without a gap the studio asks before renumbering and lists the changed entries', async ({
  page,
  scratch,
}) => {
  const before = Object.values(FILES).map((file) => scratch.readFile(file))
  const indexBefore = scratch.readFile('news/index.json')
  await page.goto('/')
  await drag(page, 'd', 'c')

  const panel = page.getByRole('alertdialog', { name: 'No gap — renumber entries?' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('d: 40 → 30')).toBeVisible()
  await expect(panel.getByText('c: 21 → 40')).toBeVisible()
  expect(Object.values(FILES).map((file) => scratch.readFile(file))).toEqual(before)
  expect(scratch.readFile('news/index.json')).toBe(indexBefore)

  await panel.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('status').getByText(/^Renumbered:/)).toBeVisible()
  expect((Object.keys(FILES) as Key[]).map((key) => diskOrder(scratch, key))).toEqual([
    10, 20, 40, 30,
  ])
  expect(indexOrders(scratch).map((entry) => entry.order)).toEqual([10, 20, 40, 30])
  await expect(panel).toHaveCount(0)
  await expectListMatchesDisk(page, scratch)
})

const STATUS = /^(Moved|Renumbered|Published|Unpublished):/

/** Titles of the index.json entries, ordered by the frontmatter `order` on disk. */
function diskTitlesInOrder(scratch: Scratch): string[] {
  return indexRows(scratch)
    .map((row) => {
      const text = scratch.readFile(`news/${row.file}`)
      return {
        title: /^title:\s*(.+?)\s*$/m.exec(text)?.[1] ?? '',
        order: Number(/^order:\s*(\d+)/m.exec(text)?.[1]),
      }
    })
    .sort((x, y) => x.order - y.order)
    .map((entry) => entry.title)
}

async function expectOrderRegionMatchesDisk(page: Page, scratch: Scratch): Promise<void> {
  const expected = diskTitlesInOrder(scratch)
  const shown = page.getByRole('region', { name: 'Order' }).getByRole('listitem')
  await expect(shown).toHaveCount(expected.length)
  for (const [i, title] of expected.entries()) {
    await expect(shown.nth(i)).toContainText(title)
  }
}

test('after each operation the library shows the order the files on disk produce', async ({
  page,
  scratch,
}) => {
  await page.goto('/')
  const status = page.getByRole('status').filter({ hasText: STATUS })

  await drag(page, 'c', 'b')
  await expect(status.getByText('Moved: c')).toBeVisible()
  await expectListMatchesDisk(page, scratch)
  await expectOrderRegionMatchesDisk(page, scratch)

  await page
    .getByRole('region', { name: 'Order' })
    .getByRole('button', { name: 'Move down Entry A' })
    .click()
  await expect(status.getByText(/^Moved: a/)).toBeVisible()
  await expectOrderRegionMatchesDisk(page, scratch)

  await page.getByRole('button', { name: /^Publish Draft OK/ }).click()
  await expect(status.getByText('Published: draft-ok')).toBeVisible()
  await expectOrderRegionMatchesDisk(page, scratch)

  await page.getByRole('button', { name: 'Unpublish Entry B' }).click()
  await page
    .getByRole('alertdialog', { name: 'Unpublish Entry B?' })
    .getByRole('button', { name: 'Confirm' })
    .click()
  await expect(status.getByText('Unpublished: b')).toBeVisible()
  await expectOrderRegionMatchesDisk(page, scratch)
})

function indexRows(scratch: Scratch): { id: string; file: string; order: number }[] {
  return (
    JSON.parse(scratch.readFile('news/index.json')) as {
      entries: { id: string; file: string; order: number }[]
    }
  ).entries
}

test('publishing a draft adds its row with id, file and order', async ({ page, scratch }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^Publish Draft OK/ }).click()
  await expect(page.getByRole('status').getByText('Published: draft-ok')).toBeVisible()

  const row = indexRows(scratch).find((entry) => entry.id === 'draft-ok')
  expect(row).toMatchObject({ id: 'draft-ok', file: '2026-09-20-draft-ok.md', order: 50 })
  expect(scratch.readFile('news/2026-09-20-draft-ok.md')).toMatch(/^order:\s*50\s*$/m)
})

test('unpublishing removes the row and leaves the document and its image byte-identical', async ({
  page,
  scratch,
}) => {
  const document = readFileSync(join(scratch.root, FILES.a))
  const image = readFileSync(join(scratch.root, 'news/img/a.png'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Unpublish Entry A' }).click()

  const panel = page.getByRole('alertdialog', { name: 'Unpublish Entry A?' })
  await expect(panel).toContainText(
    'Launchers that already fetched the feed keep showing this entry until they next poll.',
  )
  await panel.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('status').getByText('Unpublished: a')).toBeVisible()

  expect(indexRows(scratch).some((entry) => entry.id === 'a')).toBe(false)
  expect(readFileSync(join(scratch.root, FILES.a)).equals(document)).toBe(true)
  expect(readFileSync(join(scratch.root, 'news/img/a.png')).equals(image)).toBe(true)
})

test('publishing a draft the launcher would drop is refused with the reason until confirmed', async ({
  page,
  scratch,
}) => {
  const indexBefore = scratch.readFile('news/index.json')
  await page.goto('/')
  await page.getByRole('button', { name: /^Publish .*draft-dropped/ }).click()

  const panel = page.getByRole('alertdialog', { name: 'The launcher would drop this entry' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(/2026-09-20-draft-dropped\.md: dropped: .*no title or body/)
  expect(scratch.readFile('news/index.json')).toBe(indexBefore)

  await panel.getByRole('button', { name: 'Cancel' }).click()
  await expect(panel).toHaveCount(0)
  expect(scratch.readFile('news/index.json')).toBe(indexBefore)

  await page.getByRole('button', { name: /^Publish .*draft-dropped/ }).click()
  await panel.getByRole('button', { name: 'Publish anyway' }).click()
  await expect(page.getByRole('status').getByText(/^Published:/)).toBeVisible()
  expect(indexRows(scratch).some((entry) => entry.file === '2026-09-20-draft-dropped.md')).toBe(
    true,
  )
})

test('reordering, publishing and unpublishing reach nothing beyond localhost', async ({
  page,
  scratch,
  externalRequests,
}) => {
  const hosts: string[] = []
  page.on('request', (request) => hosts.push(new URL(request.url()).hostname))
  await page.goto('/')

  await drag(page, 'c', 'b')
  await expect(page.getByRole('status').getByText('Moved: c')).toBeVisible()
  await page.getByRole('button', { name: /^Publish Draft OK/ }).click()
  await expect(page.getByRole('status').getByText('Published: draft-ok')).toBeVisible()
  await page.getByRole('button', { name: 'Unpublish Entry A' }).click()
  await page
    .getByRole('alertdialog', { name: 'Unpublish Entry A?' })
    .getByRole('button', { name: 'Confirm' })
    .click()
  await expect(page.getByRole('status').getByText('Unpublished: a')).toBeVisible()

  expect(hosts.length).toBeGreaterThan(0)
  expect(hosts.every((host) => host === 'localhost' || host === '127.0.0.1')).toBe(true)
  expect(externalRequests).toHaveLength(0)
  expect(existsSync(join(scratch.root, '.git'))).toBe(false)
})
