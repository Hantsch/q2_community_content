/**
 * Proof that `npm run validate` (story 012, D5, AC4) never pulls in the studio surface, a dev
 * server or a browser, and always terminates on its own.
 *
 * Two independent checks:
 * 1. A static walk of `studio/scripts/validate.ts`'s import graph (following only relative
 *    imports, on disk, transitively) — this fails loudly the moment anyone imports `vite`,
 *    `react`, `playwright` or a `.tsx` module into the CLI's path, even indirectly.
 * 2. Spawning the real CLI against a minimal sandbox and checking it exits with a real status
 *    code rather than being killed by the timeout — a hung process (e.g. a lingering dev server
 *    still listening on a port) comes back from `spawnSync` with `status: null`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const studioDir = dirname(dirname(fileURLToPath(import.meta.url)))
const cliPath = join(studioDir, 'scripts', 'validate.ts')
const tsxCliPath = require.resolve('tsx/cli')

const SPAWN_TIMEOUT_MS = 60_000

const IMPORT_SPECIFIER_PATTERN = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g

const FORBIDDEN_SPECIFIERS = new Set(['vite', 'react', 'react-dom', '@playwright/test', 'playwright'])

/** Extracts every `import ... from '...'` and `import('...')` specifier from a source file's
 * text. A regex is enough here — this repository has no need for a full AST parser (see the
 * story's D5 wording) — and it deliberately over-matches rather than under-matches. */
function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(IMPORT_SPECIFIER_PATTERN)) {
    const specifier = match[1] ?? match[2]
    if (specifier) specifiers.push(specifier)
  }
  return specifiers
}

/** Resolves a relative specifier to a file on disk, trying the suffixes this codebase's own
 * extensionless relative imports need. Returns `undefined` if none of them exist. */
function resolveRelativeSpecifier(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier)
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]
  return candidates.find((candidate) => existsSync(candidate))
}

interface ImportGraph {
  readonly files: ReadonlySet<string>
  readonly specifiers: ReadonlySet<string>
}

/** Walks the import graph starting at `entryFile`, following only relative specifiers
 * (`./`, `../`) to files on disk, transitively, visiting each file at most once. Bare/package
 * specifiers (`'vite'`, `'react'`, `'node:fs'`, `'zod'`, `'@shared/*'`, ...) are graph leaves —
 * they are recorded but never resolved into `node_modules`. */
function walkImportGraph(entryFile: string): ImportGraph {
  const visitedFiles = new Set<string>()
  const specifiers = new Set<string>()
  const stack = [entryFile]

  while (stack.length > 0) {
    const file = stack.pop()!
    if (visitedFiles.has(file)) continue
    visitedFiles.add(file)

    const source = readFileSync(file, 'utf8')
    for (const specifier of extractSpecifiers(source)) {
      if (!specifier.startsWith('./') && !specifier.startsWith('../')) {
        specifiers.add(specifier)
        continue
      }
      const resolved = resolveRelativeSpecifier(file, specifier)
      if (!resolved) {
        // Recorded as-is so an unresolvable relative import is visible in the collected set
        // rather than silently dropped.
        specifiers.add(specifier)
        continue
      }
      specifiers.add(resolved)
      if (!visitedFiles.has(resolved)) stack.push(resolved)
    }
  }

  return { files: visitedFiles, specifiers }
}

let sandbox: string | undefined

afterEach(() => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true })
  sandbox = undefined
})

describe('validate CLI headlessness (AC4)', () => {
  it('the validate CLI imports no studio surface, dev server or browser module and terminates on its own', () => {
    const graph = walkImportGraph(cliPath)

    for (const forbidden of FORBIDDEN_SPECIFIERS) {
      expect(graph.specifiers.has(forbidden)).toBe(false)
    }
    for (const specifier of graph.specifiers) {
      expect(specifier.startsWith('@vitejs/')).toBe(false)
    }
    for (const file of graph.files) {
      expect(file.endsWith('.tsx')).toBe(false)
    }

    // Sanity: the walk actually reached a non-trivial graph, so the assertions above are not
    // vacuously true because of a broken resolver.
    expect(graph.files.size).toBeGreaterThan(5)
  })

  it('terminates on its own without listening on a port', () => {
    sandbox = mkdtempSync(join(tmpdir(), 'q2-validate-headless-sandbox-'))
    mkdirSync(join(sandbox, 'studio'))

    const result = spawnSync(process.execPath, [tsxCliPath, cliPath], {
      cwd: sandbox,
      encoding: 'utf8',
      timeout: SPAWN_TIMEOUT_MS,
    })

    // A hung process (e.g. a lingering dev server still listening on a port) is what
    // `spawnSync` reports back as `status: null` once the timeout kills it. A defined status —
    // whatever its value, since the sandbox has no `news/` tree and may legitimately fail with
    // exit 1 — proves the process exited on its own.
    expect(result.status).not.toBeNull()
    expect(typeof result.status).toBe('number')
    expect(result.signal).toBeNull()
  })
})
