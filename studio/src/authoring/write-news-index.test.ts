import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { writeNewsIndex } from './write-news-index'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const real = readFileSync(join(repoRoot, 'news', 'index.json'), 'utf8').replace(/\r\n/g, '\n')
type Doc = { note?: string; entries: Record<string, unknown>[] }

function parse(text: string): Doc {
  return JSON.parse(text) as Doc
}

const FILE = '2026-09-10-the-community-content-repository.md'

/** Forces a write by changing a row and changing it back is not needed: rewrite via a real change. */
function canonicalise(text: string): string {
  const parsed = JSON.parse(text) as { entries: { file: string; order: number }[] }
  const first = parsed.entries[0]
  const result = writeNewsIndex(text, { file: first.file, order: first.order + 1 })
  const back = writeNewsIndex(result.text, { file: first.file, order: first.order })
  return back.text
}

describe('writeNewsIndex', () => {
  it('canonicalising the real index with an unchanged row returns it byte for byte', () => {
    expect(canonicalise(real)).toBe(real)
  })

  it('changing one row leaves every other row byte-identical', () => {
    const result = writeNewsIndex(real, { file: FILE, order: 25 })
    expect(result.changed).toBe(true)
    const before = real.split('\n')
    const after = result.text.split('\n')
    expect(after).toHaveLength(before.length)
    const diff = before.flatMap((line, i) => (line === after[i] ? [] : [[line, after[i]]]))
    expect(diff).toEqual([['      "order": 20', '      "order": 25']])
  })

  it('a row that already agrees is not rewritten', () => {
    const odd = '{"schemaVersion":1,"entries":[{"file":"a.md","order":1}]}'
    const result = writeNewsIndex(odd, { file: 'a.md', order: 1 })
    expect(result).toEqual({ changed: false, text: odd })
  })

  it('an unknown row key survives', () => {
    const text = JSON.stringify(
      { entries: [{ id: 'a', file: 'a.md', extra: { x: [1] }, order: 1 }] },
      null,
      2,
    )
    const result = writeNewsIndex(text, { file: 'a.md', order: 2 })
    expect(parse(result.text).entries[0]).toEqual({
      id: 'a',
      file: 'a.md',
      extra: { x: [1] },
      order: 2,
    })
    expect(Object.keys(parse(result.text).entries[0])).toEqual(['id', 'file', 'extra', 'order'])
  })

  it('an unknown top-level key survives', () => {
    const text = JSON.stringify({ note: 'keep', entries: [{ file: 'a.md', order: 1 }], tail: 1 })
    const parsed = parse(writeNewsIndex(text, { file: 'a.md', order: 2 }).text)
    expect(Object.keys(parsed)).toEqual(['note', 'entries', 'tail'])
    expect(parsed.note).toBe('keep')
  })

  it('a missing row gives changed: false', () => {
    expect(writeNewsIndex(real, { file: 'nope.md', order: 5 })).toEqual({
      changed: false,
      text: real,
    })
  })

  it('throws on unparseable JSON', () => {
    expect(() => writeNewsIndex('{', { file: 'a.md', order: 1 })).toThrow()
  })
})
