import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { VERDICT_LABELS } from '../src/mirror/provenance'

// Repo root is two levels up from studio/tests/.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function readRepoFile(relativePath: string): string {
  return readFileSync(
    new URL(relativePath, `file://${repoRoot.replace(/[\\]/g, '/')}/`),
    'utf8',
  ).replace(/\r\n/g, '\n')
}

function section(markdown: string, heading: string, level: number): string {
  const marker = `${'#'.repeat(level)} ${heading}\n`
  const start = markdown.indexOf(marker)
  expect(start, `expected a "${marker.trim()}" heading`).toBeGreaterThanOrEqual(0)
  const rest = markdown.slice(start + marker.length)
  const end = rest.search(new RegExp(`^#{1,${level}} `, 'm'))
  return end === -1 ? rest : rest.slice(0, end)
}

const studioReadme = readRepoFile('studio/README.md')
const quickstart = section(studioReadme, 'Quickstart', 2)

describe('contributor quickstart', () => {
  it('the quickstart walks install, start, create, write, preview, validate, publish in that order', () => {
    const headings = [...quickstart.matchAll(/^### (\d+\. .+)$/gm)].map((match) => match[1].trim())
    expect(headings).toEqual([
      '1. Install',
      '2. Start',
      '3. Create',
      '4. Write',
      '5. Preview',
      '6. Validate',
      '7. Publish',
    ])
  })

  it('the only prerequisite is the Node version from engines.node, and no q2-launcher checkout is needed', () => {
    const pkg = JSON.parse(readRepoFile('studio/package.json')) as { engines: { node: string } }
    const major = /(\d+)/.exec(pkg.engines.node)?.[1]
    expect(major).toBeDefined()
    const prerequisites = section(quickstart, 'Prerequisites', 3)
    const bullets = prerequisites.split('\n').filter((line) => /^\s*[-*] /.test(line))
    expect(bullets).toHaveLength(1)
    expect(bullets[0]).toContain(major!)
    expect(prerequisites).toMatch(/no `?q2-launcher`? checkout/i)
  })

  it('the quickstart says the studio writes the working tree and never commits, pushes or publishes', () => {
    expect(quickstart).toContain('working tree')
    expect(quickstart).toMatch(/never commits, pushes or publishes/i)
  })

  it('README.md and news/_templates/README.md link to the studio quickstart', () => {
    for (const file of ['README.md', 'news/_templates/README.md']) {
      const links = [...readRepoFile(file).matchAll(/\]\(([^)\s]+)\)/g)].map((match) => match[1])
      const dir = posix.dirname(file)
      const hit = links.find(
        (link) => posix.normalize(posix.join(dir, link.split('#')[0])) === 'studio/README.md',
      )
      expect(hit, `${file} should link to studio/README.md`).toBeDefined()
      expect(hit!.split('#')[1]).toBe('quickstart')
    }
    expect(studioReadme).toMatch(/^## Quickstart$/m)
  })

  it('one short paragraph explains the mirror and the out-of-sync warning', () => {
    const label = VERDICT_LABELS['out-of-sync']
    const matching = quickstart
      .split(/\n\s*\n/)
      .filter((paragraph) => /mirror/i.test(paragraph) && paragraph.includes(label))
    expect(matching).toHaveLength(1)
    expect(matching[0].length).toBeLessThanOrEqual(600)
  })

  it('every npm command the studio README names exists as a root script', () => {
    const scripts = (
      JSON.parse(readRepoFile('package.json')) as { scripts: Record<string, string> }
    ).scripts
    const names = new Set([...studioReadme.matchAll(/npm run ([\w:-]+)/g)].map((match) => match[1]))
    expect(names.size).toBeGreaterThan(0)
    expect(names).toContain('studio')
    expect(names).toContain('validate')
    for (const name of names) expect(Object.keys(scripts), `npm run ${name}`).toContain(name)
    expect(section(quickstart, '1. Install', 3)).toContain('npm install')
  })
})
