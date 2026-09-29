import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Repo root is two levels up from studio/tests/.
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

function readRepoFile(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8')
}

const GUIDE_PATH = 'docs/systems/content-types.md'
const DESCRIPTOR_PATH = 'studio/src/content-types/descriptor.ts'

/** The body of each `##` section, keyed by its heading text. */
function guideSections(guide: string): Map<string, string> {
  const sections = new Map<string, string>()
  for (const part of guide.split(/^## /m).slice(1)) {
    const newline = part.indexOf('\n')
    sections.set(part.slice(0, newline).trim(), part.slice(newline + 1))
  }
  return sections
}

function section(name: string): string {
  const body = guideSections(readRepoFile(GUIDE_PATH)).get(name)
  expect(body, `expected a "## ${name}" section in the guide`).toBeDefined()
  return body!
}

interface Member {
  readonly name: string
  readonly required: boolean
}

/** Members of the `export interface ContentTypeDescriptor { ... }` block; required means no `?`. */
function descriptorMembers(source: string): Member[] {
  const block = source.match(/export interface ContentTypeDescriptor \{([\s\S]*?)\n\}/)
  expect(block, 'expected a ContentTypeDescriptor interface').not.toBeNull()
  return [...block![1].matchAll(/^\s*readonly (\w+)(\??):/gm)].map((m) => ({
    name: m[1],
    required: m[2] === '',
  }))
}

/** The string literals of `export type ContentTypeState = 'a' | 'b'`. */
function stateLiterals(source: string): string[] {
  const line = source.match(/export type ContentTypeState =([^\n]*)/)
  expect(line, 'expected a ContentTypeState union').not.toBeNull()
  return [...line![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function idLiterals(source: string): string[] {
  const line = source.match(/export type ContentTypeId =([^\n]*)/)
  expect(line, 'expected a ContentTypeId union').not.toBeNull()
  return [...line![1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

interface TableRow {
  readonly field: string
  readonly cells: readonly string[]
}

/** Rows of the first table; purpose cells must not contain `|`, so a row has exactly three cells. */
function tableRows(body: string): TableRow[] {
  return body
    .split('\n')
    .filter((line) => line.trim().startsWith('|'))
    .slice(2) // header and separator
    .map((line) => {
      const cells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((cell) => cell.trim())
      expect(cells.length, `table row must have exactly 3 cells (no "|" in text): ${line}`).toBe(3)
      return { field: cells[0].replace(/`/g, ''), cells }
    })
}

interface GuideField {
  readonly field: string
  readonly required: string
}

/**
 * Names the guide's table lacks, names it documents that the interface no longer has, and names
 * whose `required` column disagrees with the interface (required = yes iff no `?`).
 */
function compareFields(
  interfaceSource: string,
  guideFields: readonly GuideField[],
): { undocumented: string[]; stale: string[]; wrongRequired: string[] } {
  const members = descriptorMembers(interfaceSource)
  const names = members.map((m) => m.name)
  const documented = guideFields.map((g) => g.field)
  return {
    undocumented: names.filter((name) => !documented.includes(name)),
    stale: documented.filter((name) => !names.includes(name)),
    wrongRequired: members
      .filter((m) => {
        const row = guideFields.find((g) => g.field === m.name)
        return row !== undefined && row.required !== (m.required ? 'yes' : 'no')
      })
      .map((m) => m.name),
  }
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full))
    } else if (/\.tsx?$/.test(name)) {
      out.push(full)
    }
  }
  return out
}

function toRepoPath(absolute: string): string {
  return relative(repoRoot, absolute).replace(/\\/g, '/')
}

describe('content-type guide', () => {
  const descriptorSource = readRepoFile(DESCRIPTOR_PATH)

  it('the guide documents exactly the fields ContentTypeDescriptor declares, each with a purpose', () => {
    const rows = tableRows(section('Descriptor fields'))

    expect(
      compareFields(
        descriptorSource,
        rows.map((r) => ({ field: r.field, required: r.cells[1] })),
      ),
    ).toEqual({
      undocumented: [],
      stale: [],
      wrongRequired: [],
    })
    for (const row of rows) {
      expect(row.cells.length, `${row.field}: expected field, required, purpose`).toBe(3)
      expect(row.cells[1], `${row.field}: required column`).toMatch(/^(yes|no)$/)
      expect(row.cells[2].length, `${row.field}: purpose is empty`).toBeGreaterThan(0)
    }
  })

  it('the field check fails when the descriptor gains an undocumented field', () => {
    const synthetic = `export interface ContentTypeDescriptor {
  readonly id: string
  readonly editor?: () => void
}
`
    expect(compareFields(synthetic, [{ field: 'id', required: 'yes' }])).toEqual({
      undocumented: ['editor'],
      stale: [],
      wrongRequired: [],
    })
    expect(
      compareFields(synthetic, [
        { field: 'id', required: 'no' },
        { field: 'editor', required: 'no' },
      ]),
    ).toEqual({ undocumented: [], stale: [], wrongRequired: ['id'] })
  })

  it('the guide documents exactly the states ContentTypeState declares', () => {
    const bullets = section('States')
      .split('\n')
      .filter((line) => line.startsWith('- `'))
      .map((line) => line.match(/^- `([^`]+)`/)![1])

    expect([...bullets].sort()).toEqual([...stateLiterals(descriptorSource)].sort())
  })

  it('every studio source file that names a content-type id is listed as a touch point', () => {
    const ids = idLiterals(descriptorSource)
    const touchPoints = section('Touch points')
    const roots = [join(repoRoot, 'studio', 'src'), join(repoRoot, 'studio', 'scripts')]

    const hits = roots
      .flatMap(sourceFiles)
      .map(toRepoPath)
      .filter((path) => !/\.test\./.test(path) && !path.startsWith('studio/src/launcher-core/'))
      .filter((path) => {
        const text = readRepoFile(path)
        return ids.some((id) => text.includes(`'${id}'`) || text.includes(`"${id}"`))
      })

    expect(hits.length).toBeGreaterThan(0)
    for (const path of hits) {
      expect(touchPoints, `${path} names a content-type id but is not a touch point`).toContain(
        `\`${path}\``,
      )
    }
  })

  it('every repository path the guide cites exists', () => {
    const guide = readRepoFile(GUIDE_PATH)
    const cited = [...guide.matchAll(/`([^`\s]+)`/g)]
      .map((m) => m[1])
      .filter((token) => !token.includes('<') && !token.startsWith('q2-launcher/'))
      .filter(
        (token) =>
          /^(studio|docs|news)\//.test(token) ||
          ['README.md', 'AGENTS.md', 'CLAUDE.md'].includes(token),
      )

    expect(cited.length).toBeGreaterThan(0)
    for (const path of cited) {
      expect(existsSync(join(repoRoot, path)), `${path} does not exist`).toBe(true)
    }
  })

  it('the worked example points at the news files instead of restating them', () => {
    const body = section('Worked example: news')

    expect(body).not.toContain('```')
    for (const path of [
      'studio/src/content-types/descriptors.ts',
      'studio/src/content-repo/read-content-repo.ts',
      'studio/src/report/build-news-report.ts',
      'studio/src/report/repository-findings.ts',
    ]) {
      expect(body, `worked example must cite ${path}`).toContain(`\`${path}\``)
    }
  })

  it('the guide states the three rules a content type must not break', () => {
    const bullets = section('What a content type must not do')
      .split('\n')
      .filter((line) => line.startsWith('- '))

    expect(bullets).toHaveLength(3)
    expect(bullets[0].toLowerCase()).toContain('presentation')
    expect(bullets[1]).toContain('`directory`')
    expect(bullets[2]).toContain('launcher-core')
  })

  it('the guide explains the path from reserved to implemented, starting with the launcher contract', () => {
    const body = section('From reserved to implemented')
    const items = body.split('\n').filter((line) => /^\d+\. /.test(line))

    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toContain('q2-launcher')

    const at = ['reserved', 'launcher-reads', 'implemented'].map((word) => body.indexOf(word))
    expect(at.every((index) => index >= 0)).toBe(true)
    expect(at[0]).toBeLessThan(at[1])
    expect(at[1]).toBeLessThan(at[2])
  })
})
