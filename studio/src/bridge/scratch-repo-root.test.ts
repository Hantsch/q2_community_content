import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { resolveRepoRoot } from '../content-repo/paths'
import { resolveBridgeRepoRoot, SCRATCH_MARKER, SCRATCH_ROOT_ENV } from './scratch-repo-root'

const made: string[] = []
function tmp(base: string): string {
  const dir = mkdtempSync(join(base, 'scratch-root-test-'))
  made.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const configRoot = resolve(__dirname, '../..')

describe('resolveBridgeRepoRoot', () => {
  it('returns the checkout root when no scratch root is set', () => {
    expect(resolveBridgeRepoRoot(configRoot, {})).toBe(resolveRepoRoot(configRoot))
  })

  it('accepts a marked directory inside the temp dir', () => {
    const dir = tmp(tmpdir())
    writeFileSync(join(dir, SCRATCH_MARKER), '')
    expect(resolveBridgeRepoRoot(configRoot, { [SCRATCH_ROOT_ENV]: dir })).toBeTruthy()
  })

  it('throws for a marked directory outside the temp dir', () => {
    const dir = tmp(resolve(configRoot, 'node_modules'))
    writeFileSync(join(dir, SCRATCH_MARKER), '')
    expect(() => resolveBridgeRepoRoot(configRoot, { [SCRATCH_ROOT_ENV]: dir })).toThrow(/temp/)
  })

  it('throws for a temp directory without the marker', () => {
    const dir = tmp(tmpdir())
    mkdirSync(join(dir, 'news'))
    expect(() => resolveBridgeRepoRoot(configRoot, { [SCRATCH_ROOT_ENV]: dir })).toThrow(/marker/)
  })

  it('throws for the checkout itself', () => {
    expect(() =>
      resolveBridgeRepoRoot(configRoot, { [SCRATCH_ROOT_ENV]: resolveRepoRoot(configRoot) }),
    ).toThrow()
  })
})
