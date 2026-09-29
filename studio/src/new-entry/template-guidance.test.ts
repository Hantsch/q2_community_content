import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseTemplateGuidance } from './template-guidance'

const templatesDir = resolve(__dirname, '../../../news/_templates')
const srcDir = resolve(__dirname, '..')
const TEMPLATES = ['banner', 'cover', 'split', 'text']

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'launcher-core' || name === 'node_modules') return []
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.test\.tsx?$/.test(name) ? [] : [path]
  })
}

describe('parseTemplateGuidance', () => {
  it("the kit README's guidance lists the four templates", () => {
    const guidance = parseTemplateGuidance(readFileSync(join(templatesDir, 'README.md'), 'utf8'))
    expect(guidance.map((row) => row.template).sort()).toEqual(TEMPLATES)
    for (const row of guidance) {
      expect(row.useCase).not.toBe('')
      expect(row.image).not.toBe('')
    }
  })

  it('returns an empty list when the section or table is missing', () => {
    expect(parseTemplateGuidance('')).toEqual([])
    expect(parseTemplateGuidance('## Which template?\n\nno table here')).toEqual([])
  })

  it('the studio source holds no copy of the starter content', () => {
    const placeholders = new Set<string>()
    for (const name of TEMPLATES) {
      const text = readFileSync(join(templatesDir, name, 'template.md'), 'utf8').replace(
        /\r\n/g,
        '\n',
      )
      for (const match of text.matchAll(/<([^>]+)>/g)) {
        for (const part of [match[1], ...match[1].split('\n')]) {
          if (part.trim().length >= 12) placeholders.add(part.trim())
        }
      }
    }
    expect(placeholders.size).toBeGreaterThan(0)
    const sources = sourceFiles(srcDir).map((file) => ({ file, text: readFileSync(file, 'utf8') }))
    for (const placeholder of placeholders) {
      const hit = sources.find((source) => source.text.includes(placeholder))
      expect(hit?.file, `"${placeholder}" is copied into the studio source`).toBeUndefined()
    }
  })
})
