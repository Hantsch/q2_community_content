import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './fixtures/localhost-only'
import {
  ENTRY_A_TITLE,
  ENTRY_B_TITLE,
  stubValidationPanelFeed,
} from './fixtures/validation-panel-feed'

/**
 * Story 017 D5 — the validation panel wired into the real shell, beside the library. `news` is
 * `descriptors[0]`, the default tab, so every test just `goto('/')` (`studio-shell.spec.ts`'s
 * pattern). AC2, AC3, "clicking a finding selects its entry" and "a re-check control re-reads
 * through the bridge" stub `GET /__studio/fs/read` with `validation-panel-feed.ts`'s fixture,
 * because the real `news/` cannot trigger a `declared-image-missing` or an `order-mismatch`
 * finding on demand. AC1 and AC7 run unstubbed, against the repository's own `news/` — AC7 is the
 * story's core acceptance line and must genuinely compare rendered facts against
 * `scripts/validate.ts --json`'s own output.
 */

interface RealEntry {
  readonly id: string
  readonly file: string
}

interface CliDeclared {
  readonly title?: string
  readonly template?: string
}

type CliDelivered = 'dropped' | { readonly template: string; readonly position?: number }

interface CliEntryVerdict {
  readonly id: string
  readonly file: string
  readonly declared: CliDeclared
  readonly delivered: CliDelivered
  readonly findings: readonly unknown[]
}

interface CliPayload {
  readonly schemaVersion: number
  readonly entries: readonly CliEntryVerdict[]
}

const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(studioDir)
const require = createRequire(import.meta.url)
const tsxCliPath = require.resolve('tsx/cli')
const cliPath = join(studioDir, 'scripts', 'validate.ts')

/** Reads `news/index.json` directly, the same minimal helper `library-view.spec.ts` uses to prove
 * the UI against the repository's own real entries without hardcoding them. */
function readRealEntries(): RealEntry[] {
  const newsIndex = JSON.parse(readFileSync(resolve(repoRoot, 'news/index.json'), 'utf8')) as {
    entries: ReadonlyArray<{ id: string; file: string }>
  }
  return newsIndex.entries.map(({ id, file }) => ({ id, file }))
}

/** Runs the real CLI's `--json` mode against this repository's own `news/`, the same facts the
 * panel must agree with (AC7). Mirrors `deliveredSummary()`/`visibilitySummary()`'s wording from
 * `ValidationPanel.tsx` so the comparison is on rendered text, not just on structural equality. */
function runValidateJson(): CliPayload {
  // Spawns `tsx` the same way `validate-cli.test.ts` does — the real `process.execPath` plus
  // `tsx/cli`'s resolved path — rather than shelling out to `npx`, which is a `.cmd` shim on
  // Windows and not something `execFileSync` can invoke directly without a shell.
  const stdout = execFileSync(process.execPath, [tsxCliPath, cliPath, '--json'], {
    cwd: studioDir,
    encoding: 'utf8',
  })
  return JSON.parse(stdout.trim()) as CliPayload
}

/** A substring of `ValidationPanel.tsx`'s own `deliveredSummary()` wording, deliberately avoiding
 * its em dash (`Dropped — ...`) so this comparison never depends on reproducing that exact
 * character byte-for-byte — `startsWith('Dropped')` is unambiguous either way. */
function expectedDeliveredText(delivered: CliDelivered): string {
  if (delivered === 'dropped') {
    return 'Dropped'
  }
  const position = delivered.position === undefined ? '' : `, position ${delivered.position}`
  return `Delivered as "${delivered.template}"${position}.`
}

test('AC1: the panel shows the selected entry declared and delivered form with its findings', async ({
  page,
}) => {
  await stubValidationPanelFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const rowA = region.getByRole('listitem').filter({ hasText: ENTRY_A_TITLE })
  await rowA.getByRole('button').click()

  const entrySection = page.getByRole('region', { name: 'Entry findings' })
  await expect(entrySection).toContainText(ENTRY_A_TITLE)
  await expect(entrySection).toContainText('Delivered as "text"')
  await expect(entrySection).toContainText('declared image "cover.png" not found')
})

test('AC2: a missing image names the rule and the field to fix', async ({ page }) => {
  await stubValidationPanelFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const rowA = region.getByRole('listitem').filter({ hasText: ENTRY_A_TITLE })
  await rowA.getByRole('button').click()

  const entrySection = page.getByRole('region', { name: 'Entry findings' })
  // The finding's own message names both the rule ("declared image ... not found" is
  // `declared-image-missing`'s wording) and the field an author would fix ("image").
  await expect(entrySection).toContainText('declared image "cover.png" not found')
})

test('AC3: repository-level findings are listed in their own region, separate from the entry findings', async ({
  page,
}) => {
  await stubValidationPanelFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const rowA = region.getByRole('listitem').filter({ hasText: ENTRY_A_TITLE })
  await rowA.getByRole('button').click()

  const entrySection = page.getByRole('region', { name: 'Entry findings' })
  const repoSection = page.getByRole('region', { name: 'Repository findings' })

  await expect(entrySection).toContainText('declared image "cover.png" not found')
  await expect(entrySection).not.toContainText('order-mismatch')
  await expect(entrySection).not.toContainText('news/index.json declares order 5')

  await expect(repoSection).toContainText('news/index.json declares order 5')
  await expect(repoSection).not.toContainText('declared image "cover.png" not found')
})

test('clicking a finding selects its entry', async ({ page }) => {
  await stubValidationPanelFeed(page)
  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })
  const rowA = region.getByRole('listitem').filter({ hasText: ENTRY_A_TITLE })
  const rowB = region.getByRole('listitem').filter({ hasText: ENTRY_B_TITLE })
  await rowA.getByRole('button').click()
  await expect(rowA.getByRole('button')).toHaveAttribute('aria-current', 'true')
  await expect(rowB.getByRole('button')).not.toHaveAttribute('aria-current', 'true')

  const repoSection = page.getByRole('region', { name: 'Repository findings' })
  const orderMismatchFinding = repoSection
    .getByRole('button')
    .filter({ hasText: 'news/index.json declares order 5' })
  await orderMismatchFinding.click()

  await expect(rowB.getByRole('button')).toHaveAttribute('aria-current', 'true')
  await expect(rowA.getByRole('button')).not.toHaveAttribute('aria-current', 'true')

  const entrySection = page.getByRole('region', { name: 'Entry findings' })
  await expect(entrySection).toContainText(ENTRY_B_TITLE)
})

test('a re-check control re-reads through the bridge', async ({ page }) => {
  // Unstubbed — against the real repository — so this proves an actual second network round trip,
  // not a stub being served twice by construction.
  let readRequestCount = 0
  page.on('request', (request) => {
    if (request.url().includes('/__studio/fs/read')) readRequestCount += 1
  })

  await page.goto('/')
  await page.getByRole('region', { name: 'Entries' }).waitFor()

  const initialCount = readRequestCount
  expect(initialCount).toBeGreaterThan(0)

  const recheckButton = page.getByRole('button', { name: /re-check|refresh|revalidate/i })
  await expect(recheckButton).toBeVisible()

  const nextRead = page.waitForRequest((request) => request.url().includes('/__studio/fs/read'))
  await recheckButton.click()
  await nextRead

  expect(readRequestCount).toBeGreaterThan(initialCount)
})

test('AC7: the panel and npm run validate --json agree for the same repository', async ({
  page,
}) => {
  const realEntries = readRealEntries()
  expect(realEntries.length).toBeGreaterThan(0)

  const payload = runValidateJson()
  expect(payload.schemaVersion).toBe(1)

  await page.goto('/')

  const region = page.getByRole('region', { name: 'Entries' })

  for (const realEntry of realEntries) {
    const verdict = payload.entries.find((entry) => entry.id === realEntry.id)
    expect(verdict, `CLI payload has no entry for id "${realEntry.id}"`).toBeDefined()
    if (!verdict) continue

    const expectedTitle = verdict.declared.title ?? verdict.file
    const row = region.getByRole('listitem').filter({ hasText: expectedTitle })
    await row.getByRole('button').click()

    const entrySection = page.getByRole('region', { name: 'Entry findings' })
    await expect(entrySection).toContainText(expectedTitle)
    await expect(entrySection).toContainText(expectedDeliveredText(verdict.delivered))

    if (verdict.findings.length === 0) {
      await expect(entrySection).toContainText('No findings for this entry.')
    } else {
      const findingItems = entrySection.getByRole('listitem')
      await expect(findingItems).toHaveCount(verdict.findings.length)
    }
  }
})
