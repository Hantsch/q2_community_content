import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from '../contract/launcher-contract'
import { splitDocument, withBody } from './body-document'

const FIXTURES: Record<string, string> = {
  lf: '---\nid: a\ntitle: T\n---\nHello\n\nWorld\n',
  crlf: '---\r\nid: a\r\ntitle: T\r\n---\r\nHello\r\nWorld\r\n',
  'leading blank lines in body': '---\nid: a\n---\n\n\n  Hello  \n\n',
  'fence with trailing spaces': '---  \nid: a\n--- \nBody',
  'empty body': '---\nid: a\n---\n',
  'closing fence at end of text': '---\nid: a\n---',
  'whitespace-only body': '---\nid: a\n---\n   \n\n',
  'body containing a fence-like rule': '---\nid: a\n---\nA\n---\nB\n',
  'no frontmatter': 'Just text\n---\nmore\n',
  'unterminated fence': '---\nid: a\nBody without a closing fence\n',
  empty: '',
}

describe('splitDocument / withBody', () => {
  it('split and rejoin round-trips byte-for-byte and agrees with parseFrontmatter', () => {
    for (const [name, text] of Object.entries(FIXTURES)) {
      const { head, body } = splitDocument(text)
      expect(head + body, name).toBe(text)
      expect(withBody(text, body), name).toBe(text)

      const parsed = parseFrontmatter(text)
      if (parsed) {
        // The parser normalises CRLF to LF in the body it returns; the split keeps the bytes.
        expect(body.replace(/\r\n/g, '\n').trim(), name).toBe(parsed.body)
        expect(head.trimEnd().endsWith('---'), name).toBe(true)
      } else {
        expect(head, name).toBe('')
      }
    }

    expect(splitDocument(FIXTURES.crlf)).toEqual({
      head: '---\r\nid: a\r\ntitle: T\r\n---\r\n',
      body: 'Hello\r\nWorld\r\n',
    })
    expect(splitDocument(FIXTURES['body containing a fence-like rule']).body).toBe('A\n---\nB\n')
    expect(withBody(FIXTURES.lf, 'New')).toBe('---\nid: a\ntitle: T\n---\nNew')
  })
})
