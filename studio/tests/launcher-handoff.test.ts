import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Repo root is two levels up from studio/tests/.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function readRepoFile(relativePath: string): string {
  return readFileSync(new URL(relativePath, `file://${repoRoot.replace(/\\/g, '/')}/`), 'utf8')
}

function repoFileExists(relativePath: string): boolean {
  return existsSync(new URL(relativePath, `file://${repoRoot.replace(/\\/g, '/')}/`))
}

const SPEC_PATH = 'docs/handoffs/q2-launcher-content-repo-checker.md'

function readSpec(): string {
  return readRepoFile(SPEC_PATH)
}

function requirementSection(spec: string, heading: string): string {
  const marker = `### ${heading}`
  const section = spec.split(marker)[1]?.split(/\n### /)[0]
  expect(section, `expected a "${marker}" section in the handoff spec`).toBeDefined()
  return section
}

describe('q2-launcher content-repo checker handoff spec', () => {
  it('the spec requires the checker to pass with studio/ present', () => {
    const r1 = requirementSection(readSpec(), 'R1 — The checker passes with `studio/` present')

    expect(r1).toContain('studio/')
    expect(r1.toLowerCase()).toContain('pass')
    expect(r1).toContain('check-content-repo.mjs')
  })

  it('the spec requires studio/ to be an expected entry with a stated reason', () => {
    const r2 = requirementSection(
      readSpec(),
      'R2 — `studio/` is an expected entry, with a stated reason',
    )

    expect(r2).toContain('studio/')
    expect(r2.toLowerCase()).toContain('expected top-level entry')
    expect(r2.toLowerCase()).toContain('reason')
    expect(r2.toLowerCase()).toContain('never fetched')
  })

  it('the spec requires an unexpected top-level directory to still fail', () => {
    const r3 = requirementSection(
      readSpec(),
      'R3 — An unexpected new top-level directory still fails',
    )

    expect(r3.toLowerCase()).toContain('allow-list')
    expect(r3.toLowerCase()).toContain('new')
    expect(r3.toLowerCase()).toContain('still fail')
  })

  it('the spec keeps news byte-identity, reserved READMEs and root README sections', () => {
    const r4 = requirementSection(readSpec(), 'R4 — Existing guarantees are unchanged')

    expect(r4).toContain('checkNewsByteIdentity')
    expect(r4).toContain('checkReservedReadmes')
    expect(r4).toContain('checkRootReadme')
    expect(r4.toLowerCase()).toContain('unchanged')
  })

  it('the spec keeps the skip line and exit 0 when the checkout is absent', () => {
    const r5 = requirementSection(
      readSpec(),
      'R5 — Skip line and exit 0 when the checkout is absent',
    )

    expect(r5.toLowerCase()).toContain('skip')
    expect(r5.toLowerCase()).toContain('exits 0')
  })

  it('the spec keeps the checker read-only', () => {
    const r6 = requirementSection(readSpec(), 'R6 — The checker remains read-only')

    expect(r6.toLowerCase()).toContain('read-only')
    expect(r6.toLowerCase()).toContain('ever written')
  })

  it('the spec states R7 replaces the stale commit/branch/tag pin with direct verification', () => {
    const r7 = requirementSection(
      readSpec(),
      'R7 — Replace the stale git-state pin with direct verification',
    )

    expect(r7).toContain('EXPECTED_HEAD')
    expect(r7.toLowerCase()).toContain('branch')
    expect(r7.toLowerCase()).toContain('tag')
    expect(r7.toLowerCase()).toContain('news')
    expect(r7.toLowerCase()).toContain('layout')
    expect(r7.toLowerCase()).toContain('commits content')
    expect(r7.toLowerCase()).toContain('sprint branches')
  })

  it('the spec exists, covers R1-R7 and is linked from the docs index', () => {
    expect(repoFileExists(SPEC_PATH)).toBe(true)

    const spec = readSpec()
    for (const heading of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']) {
      expect(spec).toContain(`### ${heading} —`)
    }

    expect(spec).toContain('check-content-repo.mjs')
    expect(spec).toContain('EXPECTED_HEAD')

    // D2 added this link under docs/README.md's "## Project-specific" section.
    const docsIndex = readRepoFile('docs/README.md')
    expect(docsIndex).toContain(SPEC_PATH)
  })

  it('the docs index links the spec under "## Project-specific" with a one-line description', () => {
    const docsIndex = readRepoFile('docs/README.md')
    const projectSpecificSection = docsIndex.split('\n## Project-specific')[1]
    expect(
      projectSpecificSection,
      'expected a "## Project-specific" section in docs/README.md',
    ).toBeDefined()

    expect(projectSpecificSection).toContain(SPEC_PATH)
    expect(projectSpecificSection.toLowerCase()).toContain('004')
    expect(projectSpecificSection.toLowerCase()).toContain('studio/')
  })
})
