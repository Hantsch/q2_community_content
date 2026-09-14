import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { resolveInsideNews } from './paths'

describe('resolveInsideNews', () => {
  const newsDir = resolve('news')

  it('refuses paths that resolve outside news/', () => {
    expect(resolveInsideNews(newsDir, '../secrets.md').ok).toBe(false)
    expect(resolveInsideNews(newsDir, '/abs/secrets.md').ok).toBe(false)
    expect(resolveInsideNews(newsDir, 'C:\\Windows\\secrets.md').ok).toBe(false)
    expect(resolveInsideNews(newsDir, '\\\\server\\share\\secrets.md').ok).toBe(false)

    const accepted = resolveInsideNews(newsDir, 'sub/file.md')
    expect(accepted).toEqual({ ok: true, absolutePath: join(newsDir, 'sub', 'file.md') })
  })

  it('refuses a UNC path spelled with forward slashes', () => {
    const result = resolveInsideNews(newsDir, '//server/share/secrets.md')
    expect(result.ok).toBe(false)
  })

  it('accepts a plain top-level file', () => {
    const result = resolveInsideNews(newsDir, 'index.json')
    expect(result).toEqual({ ok: true, absolutePath: join(newsDir, 'index.json') })
  })
})
