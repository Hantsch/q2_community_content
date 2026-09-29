import { describe, expect, it } from 'vitest'
import {
  draftFromDocument,
  fieldsFor,
  isDirty,
  isKnownTemplate,
  updateDraft,
  type EntryDraft,
} from './frontmatter-draft'

const DOC = [
  '---',
  'id: hello',
  'template: split',
  'title: "Hello"',
  'order: 3',
  'image: a.png',
  'visibleFrom: 2026-01-01',
  '# a comment',
  'buttons:',
  '  - label: Go',
  '    url: https://example.com',
  '---',
  'Body',
].join('\n')

function readDraft(): EntryDraft {
  const draft = draftFromDocument('hello.md', DOC)
  if ('unreadable' in draft) throw new Error('expected a readable draft')
  return draft
}

describe('frontmatter draft', () => {
  it('a document is read into fields with the mirrored parser', () => {
    const draft = readDraft()
    expect(draft.file).toBe('hello.md')
    expect(draft.originalText).toBe(DOC)
    expect(draft.fields).toEqual({
      template: 'split',
      title: 'Hello',
      order: '3',
      image: 'a.png',
      visibleFrom: '2026-01-01',
      visibleUntil: '',
      buttons: [{ label: 'Go', url: 'https://example.com' }],
    })
    expect(isDirty(draft)).toBe(false)
  })

  it('unparseable frontmatter yields an unreadable draft', () => {
    expect(draftFromDocument('x.md', 'no frontmatter')).toEqual({ unreadable: true })
    expect(draftFromDocument('x.md', '---\ntitle: open')).toEqual({ unreadable: true })
  })

  it('fieldsFor offers image only for split, banner and cover and requires it for split and cover', () => {
    expect(fieldsFor('split').image).toBe('required')
    expect(fieldsFor('cover').image).toBe('required')
    expect(fieldsFor('banner').image).toBe('optional')
    expect(fieldsFor('text').image).toBe('none')
    expect(isKnownTemplate('banner')).toBe(true)
  })

  it('an unknown template gets the text field set', () => {
    expect(isKnownTemplate('mosaic')).toBe(false)
    expect(fieldsFor('mosaic')).toEqual(fieldsFor('text'))
    const draft = updateDraft(readDraft(), { template: 'text' })
    expect(draft.fields.image).toBe('a.png')
    expect(updateDraft(draft, { template: 'split' }).fields.image).toBe('a.png')
  })

  it('a draft is dirty after an edit and clean after reverting it', () => {
    const draft = readDraft()
    const edited = updateDraft(draft, { title: 'Changed' })
    expect(isDirty(edited)).toBe(true)
    expect(isDirty(updateDraft(edited, { title: 'Hello' }))).toBe(false)
    const reordered = updateDraft(draft, {
      buttons: [
        { label: 'Go', url: 'https://example.com' },
        { label: 'B', url: 'u' },
      ],
    })
    expect(isDirty(reordered)).toBe(true)
    const swapped = updateDraft(reordered, {
      buttons: [
        { label: 'B', url: 'u' },
        { label: 'Go', url: 'https://example.com' },
      ],
    })
    expect(isDirty(swapped)).toBe(true)
  })
})
