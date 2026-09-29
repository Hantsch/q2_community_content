/**
 * Story 030 D4: the v1 acceptance flow. One running studio, served from a throwaway sandbox, is
 * driven through every quickstart step of `studio/README.md` in the order the README lists them.
 * Every step goes through the real UI only; the test never writes into the sandbox itself.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Page } from '@playwright/test'
import { createServer, type ViteDevServer } from 'vite'

import { SCRATCH_ROOT_ENV } from '../src/bridge/scratch-repo-root'
import { test, expect, type ExternalRequestRecord } from './fixtures/localhost-only'
import { installGitShim, type GitShim } from './v1-flow/git-shim'
import { snapshotTree } from './v1-flow/news-snapshot'
import { FLOW_STEP_NAMES, readQuickstartSteps, type FlowStepName } from './v1-flow/quickstart-steps'
import { createFlowSandbox, type FlowSandbox } from './v1-flow/sandbox'

const STUDIO = dirname(dirname(fileURLToPath(import.meta.url)))
const REPO_ROOT = dirname(STUDIO)
const NETWORK_GUARD = join(STUDIO, 'e2e', 'v1-flow', 'network-guard.ts')
const SPAWN_GUARD = join(STUDIO, 'e2e', 'v1-flow', 'spawn-guard.ts')
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli')

const TITLE = 'V1 Flow Cover'
const ENTRY_ID = 'v1-flow-cover'
const IMAGE_NAME = 'v1-flow-cover.png'
const IMAGE_FIELD = `img/${IMAGE_NAME}`
const MISSING_IMAGE_FINDING = `declared image "${IMAGE_FIELD}" not found`
const BODY = 'Written in the studio during the v1 acceptance flow.'

interface FlowContext {
  readonly page: Page
  readonly base: string
}

const ENV_KEYS = ['PATH', SCRATCH_ROOT_ENV, 'FLOW_NETWORK_LOG', 'FLOW_GIT_LOG'] as const
const savedEnv: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}

let newsBefore: Record<string, string>
let sandbox: FlowSandbox | undefined
let shim: GitShim | undefined
let networkLog: string
let gitLog: string
let server: ViteDevServer | undefined
let base: string
let recordedExternal: ExternalRequestRecord[] | undefined

const frameOf = (page: Page) => page.frameLocator('iframe[title="Slide preview"]')
const draftNotice = (page: Page) => page.getByRole('region', { name: 'Draft preview' })

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('status').getByText('Saved', { exact: true })).toBeVisible()
}

/** Read-only lookup of the sandbox entry file for `ENTRY_ID`, wherever the studio stored it. */
function readEntryFile(): string {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((item) =>
      item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)],
    )
  const found = walk(join(sandbox?.root ?? '', 'news')).filter(
    (file) => file.endsWith(`${ENTRY_ID}.md`) && !file.includes('_templates'),
  )
  expect(found).toHaveLength(1)
  return readFileSync(found[0], 'utf8')
}

const readIfExists = (path: string): string => (existsSync(path) ? readFileSync(path, 'utf8') : '')

const STEPS: Record<FlowStepName, (ctx: FlowContext) => Promise<void>> = {
  install: () => {
    expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(22)
    for (const pkg of ['vite', '@playwright/test']) {
      expect(import.meta.resolve(pkg)).toMatch(/^file:/)
    }
    return Promise.resolve()
  },

  start: async ({ page, base }) => {
    const scripts = (dir: string): Record<string, string> =>
      (
        JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
          scripts: Record<string, string>
        }
      ).scripts
    expect(scripts(REPO_ROOT).studio).toBe('npm run dev --workspace studio')
    expect(scripts(STUDIO).dev).toBe('vite')
    await page.goto(base)
    await expect(
      page.getByRole('region', { name: 'Entries' }).getByText('Fixture welcome', { exact: true }),
    ).toBeVisible()
  },

  create: async ({ page }) => {
    await page.getByRole('button', { name: 'New entry' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /^cover / }).check()
    await dialog.getByLabel('Title', { exact: true }).fill(TITLE)
    await expect(dialog.getByLabel('Slug', { exact: true })).toHaveValue(ENTRY_ID)
    await dialog.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('region', { name: 'Drafts' }).getByRole('listitem').filter({ hasText: TITLE }),
    ).toBeVisible()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(TITLE)
  },

  write: async ({ page }) => {
    await page.getByLabel('Body').fill(BODY)
    await expect(page.getByLabel('Body')).toHaveValue(BODY)
  },

  frontmatter: async ({ page }) => {
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue(TITLE)
    await page.getByLabel('Image (required)').fill(IMAGE_FIELD)
    await save(page)

    // The save must have persisted the body typed in the write step, on disk and after a reload.
    expect(readEntryFile()).toContain(BODY)
    await page.reload()
    await page
      .getByRole('region', { name: 'Drafts' })
      .getByRole('listitem')
      .filter({ hasText: TITLE })
      .getByRole('button')
      .first()
      .click()
    await expect(page.getByLabel('Body')).toHaveValue(`${BODY}
`)

    // A draft's verdict is shown in the draft preview notice; the validation panel covers it only
    // once it is published (see the publish step). The mirrored pipeline keeps `cover` for a
    // declared-but-absent image file (see `fixtures/draft-preview-feed.ts`), so the studio names
    // the missing file as a finding instead of a text fallback.
    const notice = draftNotice(page)
    await expect(notice).toContainText('delivered as cover')
    await expect(
      notice.getByRole('listitem').filter({ hasText: MISSING_IMAGE_FINDING }),
    ).toHaveCount(1)

    const frame = frameOf(page)
    await expect(frame.locator('body')).toContainText(TITLE)
    // The slide has rendered (its title is shown); now no cover image may have loaded, retrying.
    await expect
      .poll(() =>
        frame
          .locator('img.home-hero-cover-image')
          .evaluateAll(
            (nodes) => nodes.filter((node) => (node as HTMLImageElement).naturalWidth > 0).length,
          ),
      )
      .toBe(0)
  },

  image: async ({ page }) => {
    // Read-only source: the real repository's cover image, handed to the picker under a new name.
    const buffer = readFileSync(join(REPO_ROOT, 'news', 'img', 'cover-community-welcome.png'))
    await page
      .getByLabel('Choose image')
      .setInputFiles({ name: IMAGE_NAME, mimeType: 'image/png', buffer })
    await expect(page.getByLabel('File name')).toHaveValue(IMAGE_NAME)
    await page.getByRole('button', { name: 'Add image' }).click()
    await expect(page.locator('#field-image')).toHaveValue(IMAGE_FIELD)
    // Only a successful add clears the missing-image finding: the file now exists in news/img.
    await expect(draftNotice(page)).toContainText('delivered as cover')
    await expect(
      draftNotice(page).getByRole('listitem').filter({ hasText: MISSING_IMAGE_FINDING }),
    ).toHaveCount(0)
  },

  preview: async ({ page }) => {
    const image = frameOf(page).locator('img.home-hero-cover-image')
    await expect(image).toBeVisible()
    await expect(image).toHaveAttribute('src', /\/news-img\/v1-flow-cover\.png$/)
    await expect
      .poll(() => image.evaluate((node) => (node as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0)
  },

  validate: async ({ page }) => {
    const notice = draftNotice(page)
    await expect(notice).toContainText('delivered as cover')
    await expect(notice).not.toContainText(MISSING_IMAGE_FINDING)
    await expect(
      notice.getByRole('listitem').filter({ hasText: MISSING_IMAGE_FINDING }),
    ).toHaveCount(0)
  },

  publish: async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(`^Publish ${TITLE}`) }).click()
    await expect(page.getByRole('status').getByText(`Published: ${ENTRY_ID}`)).toBeVisible()

    const row = page
      .getByRole('region', { name: 'Entries' })
      .getByRole('listitem')
      .filter({ hasText: TITLE })
    await expect(row).toContainText('Published')
    await expect(
      page.getByRole('region', { name: 'Drafts' }).getByRole('listitem').filter({ hasText: TITLE }),
    ).toHaveCount(0)

    // The selection still names the draft's path, which no longer exists, so the contributor
    // selects the published entry to see its verdict in the validation panel.
    const select = row.getByRole('button').first()
    await select.click()
    await expect(select).toHaveAttribute('aria-current', 'true')
    const findings = page.getByRole('region', { name: 'Entry findings' })
    await expect(findings).toContainText(TITLE)
    await expect(findings).toContainText('Delivered as "cover"')
    await expect(findings).toContainText('No findings for this entry.')
    expect(readEntryFile()).toContain(BODY)
  },
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(120_000)
  newsBefore = snapshotTree(join(REPO_ROOT, 'news'))
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key]

  sandbox = createFlowSandbox(REPO_ROOT)
  shim = installGitShim()
  networkLog = join(shim.binDir, 'network-connects.log')
  process.env.PATH = `${shim.binDir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`
  gitLog = join(shim.binDir, 'git-direct.log')
  process.env.FLOW_NETWORK_LOG = networkLog
  process.env.FLOW_GIT_LOG = gitLog
  await import('./v1-flow/network-guard')
  await import('./v1-flow/spawn-guard')
  process.env[SCRATCH_ROOT_ENV] = sandbox.root

  server = await createServer({
    configFile: join(STUDIO, 'vite.config.ts'),
    root: STUDIO,
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const url = server.resolvedUrls?.local[0]
  if (url === undefined) throw new Error('the flow studio server reported no local URL')
  base = url
})

test.afterAll(async () => {
  try {
    expect(snapshotTree(join(REPO_ROOT, 'news'))).toEqual(newsBefore)
    expect(readIfExists(networkLog)).toBe('')
    expect(readIfExists(shim?.logPath ?? '')).toBe('')
    expect(readIfExists(gitLog)).toBe('')
    expect(recordedExternal).toEqual([])
    expect(existsSync(join(sandbox?.root ?? '', '.git'))).toBe(false)
  } finally {
    await server?.close()
    sandbox?.cleanup()
    if (shim !== undefined) rmSync(shim.binDir, { recursive: true, force: true })
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) delete process.env[key]
      else process.env[key] = savedEnv[key]
    }
  }
})

test('v1: create, write, illustrate, preview, validate and publish a post in a fixture tree', async ({
  page,
  externalRequests,
}) => {
  test.setTimeout(300_000)
  recordedExternal = externalRequests
  const ctx: FlowContext = { page, base }

  const steps = readQuickstartSteps(readFileSync(join(STUDIO, 'README.md'), 'utf8'))
  expect([...steps].sort()).toEqual([...FLOW_STEP_NAMES].sort())
  for (const name of steps) {
    const handler = (STEPS as Record<string, ((c: FlowContext) => Promise<void>) | undefined>)[name]
    if (handler === undefined) throw new Error(`quickstart step "${name}" has no flow handler`)
    await test.step(name, () => handler(ctx))
  }

  await test.step('validate --json in the sandbox', () => {
    const run = spawnSync(
      process.execPath,
      [
        TSX_CLI,
        '--tsconfig',
        join(STUDIO, 'tsconfig.json'),
        join(STUDIO, 'scripts', 'validate.ts'),
        '--json',
      ],
      {
        cwd: sandbox?.root,
        encoding: 'utf8',
        timeout: 120_000,
        // PATH (git shim first) and FLOW_NETWORK_LOG come from process.env, set in beforeAll.
        env: {
          ...process.env,
          NODE_OPTIONS: `--import ${pathToFileURL(NETWORK_GUARD).href} --import ${pathToFileURL(SPAWN_GUARD).href}`,
        },
      },
    )
    expect(run.status, run.stderr).toBe(0)
    const payload = JSON.parse(run.stdout.trim()) as {
      entries: {
        id: string
        declared: { template?: string }
        delivered: 'dropped' | { template: string }
        findings: unknown[]
      }[]
    }
    const entry = payload.entries.find((candidate) => candidate.id === ENTRY_ID)
    expect(entry?.declared.template).toBe('cover')
    expect(entry?.delivered).toMatchObject({ template: 'cover' })
    expect(entry?.findings).toEqual([])
  })
})
