import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'

import { resetScratch, SCRATCH_ROOT } from '../authoring/prepare-scratch'
import { test as base, expect } from './localhost-only'

export interface Scratch {
  readonly root: string
  readFile(repoRelPath: string): string
  writeFile(repoRelPath: string, text: string): void
}

function confine(repoRelPath: string): string {
  const target = resolve(SCRATCH_ROOT, repoRelPath)
  const rel = relative(SCRATCH_ROOT, target)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`${repoRelPath} escapes the scratch repository`)
  }
  return target
}

export const test = base.extend<{ scratch: Scratch; fixtureName: string }>({
  /** Which `e2e/fixtures/<name>/news` seeds the scratch root; override with `test.use`. */
  fixtureName: ['scratch-repo', { option: true }],
  // Playwright requires an object pattern as the first argument.
  scratch: async ({ fixtureName }, use) => {
    resetScratch(SCRATCH_ROOT, fixtureName)
    await use({
      root: SCRATCH_ROOT,
      readFile: (repoRelPath) => readFileSync(confine(repoRelPath), 'utf8'),
      writeFile: (repoRelPath, text) => {
        const target = confine(repoRelPath)
        mkdirSync(dirname(target), { recursive: true })
        writeFileSync(target, text)
      },
    })
  },
})

export { expect }
