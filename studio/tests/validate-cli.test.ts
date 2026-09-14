/**
 * Integration tests for the `validate` CLI (story 012, D4). They spawn the real command as a
 * child process against throwaway sandboxes built from `studio/tests/fixtures/validate/`, exactly
 * as a contributor would run it — this repository's own `news/` tree is never touched.
 */
import { spawnSync, execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

import { createGitFixture, type GitFixture } from './git-fixture'

const require = createRequire(import.meta.url)
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const repoRoot = dirname(studioDir)
const cliPath = join(studioDir, 'scripts', 'validate.ts')
const tsxCliPath = require.resolve('tsx/cli')
const studioTsconfigPath = join(studioDir, 'tsconfig.json')

const FIXTURES_DIR = join(studioDir, 'tests', 'fixtures', 'validate')
const CLEAN_FEED_FIXTURE = join(FIXTURES_DIR, 'clean-feed')
const DROPPED_ENTRY_FIXTURE = join(FIXTURES_DIR, 'dropped-entry')

const SPAWN_TIMEOUT_MS = 60_000

interface CliRun {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

/**
 * Spawns the real CLI with `cwd` pointing at a throwaway sandbox rather than this checkout's own
 * `studio/` directory — so `tsx`'s own tsconfig auto-discovery (which walks up from `cwd`, not
 * from the script's own location) would otherwise miss the `@shared/*` path alias the mirrored
 * `contract/launcher-contract` module needs. `--tsconfig` points it at the real one explicitly;
 * this is purely a test-harness concern; the real `npm run validate` always runs with `cwd` inside
 * `studio/` already, where this alias resolves on its own.
 */
function runCli(cwd: string, args: readonly string[]): CliRun {
  const result = spawnSync(
    process.execPath,
    [tsxCliPath, '--tsconfig', studioTsconfigPath, cliPath, ...args],
    {
      cwd,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
    },
  )
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

/** A sandbox repository root with the given fixture's `news/` tree, plus an empty `studio/` marker
 * directory so `resolveRepoRoot` succeeds — no `q2-launcher` checkout anywhere (AC5). */
function createSandbox(fixtureDir: string): string {
  const sandbox = mkdtempSync(join(tmpdir(), 'q2-validate-sandbox-'))
  mkdirSync(join(sandbox, 'studio'))
  cpSync(join(fixtureDir, 'news'), join(sandbox, 'news'), { recursive: true })
  return sandbox
}

let sandbox: string | undefined
let fixture: GitFixture | undefined

afterEach(() => {
  fixture?.cleanup()
  fixture = undefined
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
  sandbox = undefined
})

describe('validate CLI', () => {
  it('"npm run validate" prints a verdict for every entry of the fixture feed', () => {
    sandbox = createSandbox(CLEAN_FEED_FIXTURE)

    const run = runCli(sandbox, [])

    expect(run.status).toBe(0)
    expect(run.stdout).toContain('first-post')
    expect(run.stdout).toContain('2026-01-01-first-post.md')
    expect(run.stdout).toContain('nested-post')
    expect(run.stdout).toContain('nested/2026-01-02-nested-post.md')
  })

  it('"--json" prints one JSON document and nothing else on stdout', () => {
    sandbox = createSandbox(CLEAN_FEED_FIXTURE)

    const run = runCli(sandbox, ['--json'])

    const trimmed = run.stdout.trim()
    expect(trimmed.split('\n')).toHaveLength(1)
    const payload = JSON.parse(trimmed) as { schemaVersion: number; entries: unknown[] }
    expect(payload.schemaVersion).toBe(1)
    expect(Array.isArray(payload.entries)).toBe(true)
  })

  it('exits 1 on a dropped entry and 0 on a clean feed', () => {
    sandbox = createSandbox(DROPPED_ENTRY_FIXTURE)
    const droppedRun = runCli(sandbox, [])
    expect(droppedRun.status).toBe(1)
    rmSync(sandbox, { recursive: true, force: true })

    sandbox = createSandbox(CLEAN_FEED_FIXTURE)
    const cleanRun = runCli(sandbox, [])
    expect(cleanRun.status).toBe(0)
  })

  it('runs in a fixture clone with no q2-launcher checkout present', () => {
    sandbox = createSandbox(CLEAN_FEED_FIXTURE)

    // The sandbox is built from scratch above (a `news/` tree plus an empty `studio/` marker
    // directory) — walk it to confirm nothing named `q2-launcher` exists anywhere in it.
    function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        return entry.isDirectory() ? [path, ...walk(path)] : [path]
      })
    }
    expect(walk(sandbox).some((path) => path.includes('q2-launcher'))).toBe(false)

    const run = runCli(sandbox, [])
    expect([0, 1]).toContain(run.status)
  })

  it('leaves `git status --porcelain` unchanged', () => {
    fixture = createGitFixture()
    mkdirSync(join(fixture.dir, 'studio'))
    fixture.writeFile('studio/.keep', '')
    cpSync(join(CLEAN_FEED_FIXTURE, 'news'), join(fixture.dir, 'news'), { recursive: true })
    fixture.commitAll()

    const run = runCli(fixture.dir, [])
    expect(run.status).toBe(0)

    const status = execFileSync('git', ['status', '--porcelain'], {
      cwd: fixture.dir,
      encoding: 'utf8',
    })
    expect(status).toBe('')
  })

  it('the validate npm script points at studio/scripts/validate.ts', () => {
    const studioPackage = JSON.parse(readFileSync(join(studioDir, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }
    const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>
    }

    expect(studioPackage.scripts['validate']).toContain('scripts/validate.ts')
    expect(rootPackage.scripts['validate']).toContain('validate --workspace studio')
  })
})
