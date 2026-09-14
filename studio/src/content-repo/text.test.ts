import { describe, expect, it } from 'vitest'

import { normaliseText } from './text'

describe('normaliseText', () => {
  it('strips a leading BOM', () => {
    expect(normaliseText('﻿hello')).toBe('hello')
  })

  it('converts CRLF to LF', () => {
    expect(normaliseText('line one\r\nline two\r\n')).toBe('line one\nline two\n')
  })

  it('converts lone CR to LF', () => {
    expect(normaliseText('line one\rline two')).toBe('line one\nline two')
  })

  it('strips a BOM and normalises line endings together', () => {
    expect(normaliseText('﻿a\r\nb\rc')).toBe('a\nb\nc')
  })
})
