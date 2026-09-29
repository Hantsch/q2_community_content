import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { parseFrontmatter, type ButtonLink } from '../contract/launcher-contract'

import { writeEntryDocument, type EntryPatch } from './write-entry-document'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))

function readLf(path: string): string {
  return readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
}

/** Every `news/*.md` and `news/_templates/<name>/template.md`, LF-normalised. */
function repositoryDocuments(): { name: string; text: string }[] {
  const news = join(repoRoot, 'news')
  const templates = join(news, '_templates')
  const entries = readdirSync(news)
    .filter((name) => name.endsWith('.md'))
    .map((name) => ({ name, text: readLf(join(news, name)) }))
  const drafts = readdirSync(templates, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: `_templates/${entry.name}/template.md`,
      text: readLf(join(templates, entry.name, 'template.md')),
    }))
  return [...entries, ...drafts]
}

function write(original: string, patch: EntryPatch): string {
  const result = writeEntryDocument(original, patch)
  if (!result.ok) throw new Error(result.reason)
  return result.text
}

const HAND_WRITTEN = [
  '---',
  '# a note for authors',
  'template: cover',
  "title: 'Old headline'",
  'author: x',
  'order: 20',
  'buttons:',
  '  - label: First',
  '    url: https://github.com/a/b',
  '  # keep this button note',
  '  - label: Second',
  '    url: https://github.com/c/d',
  '# visibleUntil: 2026-12-31T00:00:00Z',
  '---',
  'Body text.',
  '',
].join('\n')

const NEW_BUTTONS: ButtonLink[] = [
  { label: 'Read: the notes', url: 'https://github.com/x/y' },
  { label: ' padded ', url: 'https://github.com/x/z' },
]

describe('writeEntryDocument', () => {
  const documents = repositoryDocuments()

  it('an empty patch returns every repository document byte for byte', () => {
    expect(documents.length).toBeGreaterThan(4)
    for (const { name, text } of documents) {
      expect(writeEntryDocument(text, {}), name).toEqual({ ok: true, text })
      // Writing back exactly what was parsed is no change either.
      const parsed = parseFrontmatter(text)!
      const { buttons, ...fields } = parsed.data
      expect(writeEntryDocument(text, { fields, buttons, body: parsed.body }), name).toEqual({
        ok: true,
        text,
      })
    }
  })

  it('a title change leaves every other line byte-identical', () => {
    for (const { name, text } of documents) {
      const before = text.split('\n')
      const after = write(text, { fields: { title: 'A brand new headline' } }).split('\n')
      expect(after.length, name).toBe(before.length)
      const changed = before.flatMap((line, i) => (line === after[i] ? [] : [i]))
      expect(changed.length, name).toBe(1)
      expect(after[changed[0]], name).toBe('title: A brand new headline')
    }
  })

  it('a patched document reads back as the same entry with the patch applied', () => {
    const patch: EntryPatch = {
      fields: { title: 'Changed: "quoted" #1', order: null, subtitle: '  spaced  ' },
      buttons: NEW_BUTTONS,
      body: 'A new body.\n\nSecond paragraph.',
    }
    for (const { name, text } of [...documents, { name: 'hand-written', text: HAND_WRITTEN }]) {
      const parsed = parseFrontmatter(text)!
      const result = parseFrontmatter(write(text, patch))!
      const expected: Record<string, unknown> = { ...parsed.data }
      delete expected.order
      expected.title = 'Changed: "quoted" #1'
      expected.subtitle = '  spaced  '
      expected.buttons = NEW_BUTTONS
      expect(result.data, name).toEqual(expected)
      expect(result.body, name).toBe('A new body.\n\nSecond paragraph.')
    }
  })

  it('comments and unknown keys survive a patch', () => {
    const patches: EntryPatch[] = [
      { fields: { title: 'New' } },
      { fields: { order: null, visibleFrom: '2026-01-01T00:00:00Z' } },
      { buttons: NEW_BUTTONS },
      { buttons: [] },
      { buttons: null },
      { body: 'Replaced body.' },
    ]
    for (const patch of patches) {
      const lines = write(HAND_WRITTEN, patch).split('\n')
      for (const survivor of [
        '# a note for authors',
        'author: x',
        '  # keep this button note',
        '# visibleUntil: 2026-12-31T00:00:00Z',
      ]) {
        expect(lines, JSON.stringify(patch)).toContain(survivor)
      }
    }
  })

  it('keeps field order, quote style and appends new keys before the closing fence', () => {
    const text = write(HAND_WRITTEN, { fields: { title: 'New headline', visibleFrom: 'soon' } })
    expect(text.split('\n').slice(0, 15)).toEqual([
      '---',
      '# a note for authors',
      'template: cover',
      "title: 'New headline'",
      'author: x',
      'order: 20',
      'buttons:',
      '  - label: First',
      '    url: https://github.com/a/b',
      '  # keep this button note',
      '  - label: Second',
      '    url: https://github.com/c/d',
      '# visibleUntil: 2026-12-31T00:00:00Z',
      'visibleFrom: soon',
      '---',
    ])
    expect(Object.keys(parseFrontmatter(text)!.data)).toEqual([
      'template',
      'title',
      'author',
      'order',
      'buttons',
      'visibleFrom',
    ])
  })

  it('replaces only the buttons block, keeping its comments after the new entries', () => {
    const lines = write(HAND_WRITTEN, { buttons: NEW_BUTTONS }).split('\n')
    expect(lines.slice(6, 13)).toEqual([
      'buttons:',
      '  - label: Read: the notes',
      '    url: https://github.com/x/y',
      '  - label: " padded "',
      '    url: https://github.com/x/z',
      '  # keep this button note',
      '# visibleUntil: 2026-12-31T00:00:00Z',
    ])
    const removed = write(HAND_WRITTEN, { buttons: null })
    expect(removed).not.toMatch(/buttons:|label:|url:/)
    expect(parseFrontmatter(removed)!.data.buttons).toBeUndefined()
  })

  it.each([
    'a: b',
    'value # with hash',
    ' leading',
    'trailing ',
    '"starts with a quote',
    "'starts with a quote",
    '"fully quoted"',
    "'fully quoted'",
    '"mixed\'',
    '""',
    '',
  ])('quotes %j so that it reads back unchanged', (value) => {
    for (const original of [HAND_WRITTEN, '---\ntitle: plain\n---\n']) {
      const text = write(original, {
        fields: { title: value, fresh: value },
        buttons: value === '' ? undefined : [{ label: value, url: 'https://github.com/a/b' }],
      })
      const data = parseFrontmatter(text)!.data
      expect(data.title).toBe(value)
      expect(data.fresh).toBe(value)
      if (value !== '') expect(data.buttons?.[0]?.label).toBe(value)
    }
  })

  it('refuses a value with a line break, naming the key', () => {
    const result = writeEntryDocument(HAND_WRITTEN, { fields: { title: 'one\ntwo' } })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.reason).toContain('title')
    const button = writeEntryDocument(HAND_WRITTEN, {
      buttons: [{ label: 'one\ntwo', url: 'https://github.com/a/b' }],
    })
    expect(!button.ok && button.reason).toContain('buttons[0].label')
  })

  it('refuses a document without a frontmatter block', () => {
    expect(writeEntryDocument('just a body\n', {}).ok).toBe(false)
    expect(writeEntryDocument('---\ntitle: never closed\n', {}).ok).toBe(false)
  })
})
