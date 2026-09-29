import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../contract/launcher-contract'
import type { LibraryRow } from '../library/library-types'
import {
  buildNewEntryText,
  findNewEntryConflict,
  isValidSlug,
  newEntryFileName,
  slugify,
} from './new-entry'

const templatesDir = resolve(__dirname, '../../../news/_templates')
const TEMPLATES = ['banner', 'cover', 'split', 'text']

function template(name: string): string {
  return readFileSync(join(templatesDir, name, 'template.md'), 'utf8')
}

function row(partial: Partial<LibraryRow> & Pick<LibraryRow, 'id' | 'file'>): LibraryRow {
  return { templatesDiffer: false, status: 'published', ...partial }
}

describe('buildNewEntryText', () => {
  it('every kit template yields a new entry with no placeholder left', () => {
    for (const name of TEMPLATES) {
      const out = buildNewEntryText(template(name), 'Season two is live')
      const lines = out.split(/\r?\n/)
      const close = lines.indexOf('---', 1)
      const frontmatter = lines.slice(1, close).filter((line) => !line.startsWith('#'))
      const body = lines.slice(close + 1).join('\n')
      for (const line of frontmatter) expect(line, `${name}: ${line}`).not.toMatch(/[<>]/)
      expect(body, name).not.toMatch(/[<>]/)
      const parsed = parseFrontmatter(out)
      expect(parsed?.data.template).toBe(name)
      expect(parsed?.data.title).toBe('Season two is live')
      if (name === 'cover' || name === 'split') expect(parsed?.data.image).toBe('')
      expect(parsed?.body.trim()).toBe('')
    }
  })

  it('keeps comments, order and line endings verbatim', () => {
    const source = template('cover')
    const out = buildNewEntryText(source, 'Hello')
    const eol = source.includes('\r\n') ? '\r\n' : '\n'
    expect(out.split(eol).length).toBe(out.split(/\r?\n/).length)
    for (const line of source.split(/\r?\n/).filter((l) => l.startsWith('#'))) {
      expect(out).toContain(line)
    }
    expect(out).toContain(`order: 10${eol}`)
    const lf = buildNewEntryText(source.replace(/\r\n/g, '\n'), 'Hello')
    expect(lf).not.toContain('\r')
  })

  it("the typed title survives the launcher's parser", () => {
    const titles = [
      'Patch 1.2: what changed',
      'Top #1 of the week',
      '"Quoted" headline',
      "'single' quoted",
      '"whole title quoted"',
      'Many    spaces   here',
    ]
    for (const title of titles) {
      const parsed = parseFrontmatter(buildNewEntryText(template('text'), title))
      expect(parsed?.data.title, title).toBe(title.replace(/\s+/g, ' '))
    }
  })
})

describe('slugify', () => {
  it('slugify derives a safe slug from a title', () => {
    expect(slugify('Season Two is Live!')).toBe('season-two-is-live')
    expect(slugify('Über Café Ängste')).toBe('uber-cafe-angste')
    expect(slugify('  --Hello,   World--  ')).toBe('hello-world')
    expect(isValidSlug(slugify('Über Café'))).toBe(true)
    expect(slugify('!!! ???')).toBe('')
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('Bad Slug')).toBe(false)
    expect(isValidSlug('trailing-')).toBe(false)
  })

  it('builds the dated file name', () => {
    expect(newEntryFileName('2026-09-29', 'hello')).toBe('2026-09-29-hello.md')
  })
})

describe('findNewEntryConflict', () => {
  const published = row({ id: 'launch', file: '2026-01-01-launch.md', title: 'Launch day' })
  const draft = row({
    id: 'news/2026-02-02-teaser.md',
    file: 'news/2026-02-02-teaser.md',
    title: 'Teaser',
    status: 'draft',
  })

  it('an existing file name is refused naming the entry', () => {
    const conflict = findNewEntryConflict({
      fileName: '2026-02-02-teaser.md',
      slug: 'other',
      rows: [published, draft],
    })
    expect(conflict?.kind).toBe('file-exists')
    expect(conflict?.existing.title).toBe('Teaser')
    expect(conflict?.existing.file).toBe('news/2026-02-02-teaser.md')
    // The file check wins over the id check.
    expect(
      findNewEntryConflict({ fileName: '2026-01-01-launch.md', slug: 'launch', rows: [published] })
        ?.kind,
    ).toBe('file-exists')
  })

  it('a slug equal to an existing id is refused', () => {
    const rows = [published, draft]
    const byId = findNewEntryConflict({ fileName: '2026-09-29-launch.md', slug: 'launch', rows })
    expect(byId?.kind).toBe('id-collision')
    expect(byId?.existing.title).toBe('Launch day')
    const byDraft = findNewEntryConflict({ fileName: '2026-09-29-teaser.md', slug: 'teaser', rows })
    expect(byDraft?.kind).toBe('id-collision')
    expect(byDraft?.existing.file).toBe('news/2026-02-02-teaser.md')
    expect(
      findNewEntryConflict({ fileName: '2026-09-29-fresh.md', slug: 'fresh', rows }),
    ).toBeUndefined()
  })
})
