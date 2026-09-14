import { existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { readContentRepo, readTemplateFile } from './read-content-repo'

// `studio/src/content-repo/` → `studio/tests/fixtures/content-repo/`.
const fixturesRoot = fileURLToPath(new URL('../../tests/fixtures/content-repo/', import.meta.url))
const fixture = (name: string): string => join(fixturesRoot, name)

const draftPaths = (read: ReturnType<typeof readContentRepo>): string[] =>
  read.drafts.map((draft) => draft.path)

describe('readContentRepo', () => {
  it('returns the raw index, the named documents and the unnamed drafts', () => {
    const read = readContentRepo({ repoRoot: fixture('ok') })

    // The raw index comes back as text *and* as the parsed value, untouched.
    expect(read.index.parsed).toBe(true)
    expect(read.index.text).toContain('"schemaVersion": 1')
    expect(read.index.value).toEqual({
      schemaVersion: 1,
      entries: [
        { id: 'first-post', file: '2026-01-01-first-post.md', order: 10 },
        { id: 'nested-post', file: 'nested/2026-01-02-nested-post.md', order: 20 },
      ],
    })
    expect(read.findings).toEqual([])

    // Every named document is present, keyed by its exact `file` value, and normalised: the first
    // post is stored on disk with a UTF-8 BOM.
    expect(Object.keys(read.documents).sort()).toEqual([
      '2026-01-01-first-post.md',
      'nested/2026-01-02-nested-post.md',
    ])
    const firstPost = read.documents['2026-01-01-first-post.md'].text
    expect(firstPost.startsWith('---\ntitle: First post')).toBe(true)
    expect(firstPost).not.toContain('\uFEFF')
    expect(firstPost).not.toContain('\r')
    expect(read.documents['nested/2026-01-02-nested-post.md'].text).toContain('title: Nested post')

    // Unnamed `.md` files are drafts — including one a flat walk would miss — and named documents
    // never appear among them. `news/img/` and `news/_templates/` are not walked at all.
    expect(draftPaths(read)).toEqual([
      'news/2026-01-03-unnamed-draft.md',
      'news/nested/2026-01-04-nested-draft.md',
    ])
    expect(read.drafts[0].text).toContain('title: Unnamed draft')
    expect(read.documents['news/2026-01-03-unnamed-draft.md']).toBeUndefined()
    expect(read.documents['2026-01-03-unnamed-draft.md']).toBeUndefined()
  })

  it('a broken index.json becomes a finding and the drafts are still returned', () => {
    const read = readContentRepo({ repoRoot: fixture('broken-index') })

    const finding = read.findings.find((candidate) => candidate.severity === 'error')
    expect(finding?.code).toBe('index-unparseable')
    expect(finding?.path).toBe('news/index.json')
    // The parser's own message, not a generic one: it names the syntax problem and its position.
    expect(finding?.message).toMatch(/JSON|token|position/i)
    expect(finding?.message).not.toBe('news/index.json: ')

    // The raw text survives the failed parse (story 013 needs it), but nothing is claimed …
    expect(read.index.parsed).toBe(false)
    expect(read.index.value).toBeUndefined()
    expect(read.index.text).toContain('"half-written"')
    expect(read.documents).toEqual({})

    // … so every `.md` in the tree comes back as a draft, which is the whole point of AC3.
    expect(draftPaths(read)).toEqual([
      'news/2026-02-01-half-written.md',
      'news/nested/2026-02-02-also-here.md',
    ])
    expect(read.drafts[0].text).toContain('title: Half written')
  })

  it('a document named but absent is a finding, not an empty document', () => {
    const read = readContentRepo({ repoRoot: fixture('missing-doc') })

    const finding = read.findings.find((candidate) => candidate.code === 'missing-document')
    expect(finding?.severity).toBe('error')
    expect(finding?.path).toBe('news/2026-03-01-gone.md')
    expect(finding?.message).toContain('2026-03-01-gone.md')

    // No entry at all — not an empty one, which 011/013 could not tell from an empty file.
    expect('2026-03-01-gone.md' in read.documents).toBe(false)
    expect(Object.keys(read.documents)).toEqual(['2026-03-02-present.md'])
    expect(read.documents['2026-03-02-present.md'].text).toContain('title: Present')

    // The absent document is not invented as a draft either, and the read stays partial-success.
    expect(draftPaths(read)).toEqual([])
    expect(read.index.parsed).toBe(true)
    expect(read.findings).toHaveLength(1)
  })

  it('an escaping file field is refused, not read', () => {
    const repoRoot = fixture('escaping-path')
    // The escape target really exists, so a reader that followed `../outside.md` would succeed.
    expect(existsSync(join(repoRoot, 'outside.md'))).toBe(true)

    const read = readContentRepo({ repoRoot })

    const refusedPaths = read.findings
      .filter((finding) => finding.code === 'unsafe-document-path')
      .map((finding) => finding.path)
    expect(refusedPaths).toEqual(['../outside.md', '/etc/passwd', 'C:\\Windows\\win.ini'])
    expect(read.findings.every((finding) => finding.severity === 'error')).toBe(true)

    // Nothing was read from outside news/: no entry, and the marker text is nowhere in the result.
    expect(read.documents).toEqual({})
    expect(JSON.stringify(read)).not.toContain('OUTSIDE-NEWS-MARKER')
    expect(draftPaths(read)).toEqual(['news/2026-04-01-kept.md'])
  })

  it('a missing news/ directory is findings, not a crash', () => {
    // The fixtures root itself holds no `news/` at all — the reader must survive that too.
    const read = readContentRepo({ repoRoot: fixturesRoot })

    expect(read.index.parsed).toBe(false)
    expect(read.findings.map((finding) => finding.code)).toEqual([
      'index-missing',
      'unreadable-directory',
    ])
    expect(read.documents).toEqual({})
    expect(read.drafts).toEqual([])
    expect(read.images).toEqual([])
  })

  it('lists news/img with names and byte sizes', () => {
    const repoRoot = fixture('templates')
    const read = readContentRepo({ repoRoot })

    const pictureBytes = statSync(join(repoRoot, 'news', 'img', 'picture.png')).size
    expect(read.images).toEqual([
      { name: 'picture.png', path: 'news/img/picture.png', bytes: pictureBytes },
    ])
    expect(pictureBytes).toBeGreaterThan(0)
  })

  it('_templates files are readable on request and never appear as entries or drafts', () => {
    const repoRoot = fixture('templates')

    const result = readTemplateFile('some-template.md', { repoRoot })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.text).toContain("title: '{{title}}'")
      expect(result.text).not.toContain('\r')
    }

    const read = readContentRepo({ repoRoot })
    expect(Object.keys(read.documents).some((file) => file.includes('_templates'))).toBe(false)
    expect(read.drafts.some((draft) => draft.path.includes('_templates'))).toBe(false)
    expect(read.images.some((image) => image.path.includes('_templates'))).toBe(false)
    expect(draftPaths(read)).toEqual(['news/2026-05-01-ordinary.md'])

    // The index itself names a `_templates/` file (an author's mistake, or a half-written entry) —
    // it must still never surface as a document, only as a finding.
    expect('_templates/some-template.md' in read.documents).toBe(false)
    const smuggled = read.findings.find((finding) => finding.path === '_templates/some-template.md')
    expect(smuggled?.code).toBe('unsafe-document-path')
    expect(smuggled?.severity).toBe('error')

    // A refused/escaping template path never throws, and never reads outside `_templates/`.
    const escaping = readTemplateFile('../index.json', { repoRoot })
    expect(escaping.ok).toBe(false)

    // A missing template file is reported, not thrown.
    const missing = readTemplateFile('does-not-exist.md', { repoRoot })
    expect(missing.ok).toBe(false)
  })
})
