/**
 * Story 011 D3: proves the template-fallback message is enriched with the declared `image` value
 * (AC2), that an unknown template is always a `warning`, never an `error` (AC3), and that the
 * separate `source: 'studio'` "declared image absent from the repository" finding is computed
 * independently of the pipeline's own fallback decision. Exercises the full `buildNewsReport()`
 * path, since that is the only way to see the enriched message and the wired-in `images` check.
 */
import { describe, expect, it } from 'vitest'
import { buildNewsReport } from './build-news-report'
import { buildNewsTreeFixture } from './__fixtures__/news-tree'

const NOW = new Date('2026-09-14T00:00:00.000Z')

describe('template fallback verdicts', () => {
  it('a cover without a usable image falls back to text and names the declared image path', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'cover-no-image', template: 'cover', title: 'Cover', body: 'Body' },
      // An image *was* declared here (an empty string, which fails `cover`'s own `image` schema -
      // `min(1)` - just as much as no image at all), so the fallback message must name that
      // declared value, not fall into the "no image declared" wording above.
      { id: 'cover-declared-image', template: 'cover', title: 'Cover2', body: 'Body', image: '' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const byId = Object.fromEntries(report.entries.map((e) => [e.id, e]))

    const entry = byId['cover-no-image']
    expect(entry.delivered !== 'dropped' && entry.delivered.template).toBe('text')

    const fallback = entry.findings.find((f) => f.kind === 'template-fallback')
    expect(fallback).toBeDefined()
    expect(fallback?.severity).toBe('warning')
    expect(fallback?.source).toBe('pipeline')
    expect(fallback?.message).toMatch(/^template "cover" is missing the fields it needs/)
    expect(fallback?.message).toContain('(no image declared)')

    // No path was ever declared, so there is nothing for the studio's own check to flag.
    expect(entry.findings.some((f) => f.source === 'studio')).toBe(false)

    const declaredEntry = byId['cover-declared-image']
    expect(declaredEntry.delivered !== 'dropped' && declaredEntry.delivered.template).toBe('text')
    const declaredFallback = declaredEntry.findings.find((f) => f.kind === 'template-fallback')
    expect(declaredFallback).toBeDefined()
    expect(declaredFallback?.message).toContain('(declared image: "")')
  })

  it('names the declared image in the fallback message and separately flags it missing from the repo', () => {
    // `image: ` with nothing after the colon parses as a declared-but-empty value (see
    // `frontmatter.ts`), which fails `split`/`cover`'s own `image` schema (`min(1)`) - exactly the
    // "genuinely unusable declared image" case that makes `cover` fall back to `text`.
    const { index, documents } = buildNewsTreeFixture([
      { id: 'cover-blank-image', template: 'cover', title: 'Cover', body: 'Body', image: '' },
    ])

    const report = buildNewsReport({
      index,
      documents,
      now: NOW,
      images: [{ name: 'img/unrelated.png', size: 10 }],
    })

    const entry = report.entries[0]
    expect(entry.delivered !== 'dropped' && entry.delivered.template).toBe('text')

    const fallback = entry.findings.find((f) => f.kind === 'template-fallback')
    expect(fallback?.message).toContain('declared image: ""')
    // The pipeline's own wording is kept, not replaced.
    expect(fallback?.message).toMatch(/^template "cover" is missing the fields it needs/)

    const studioFinding = entry.findings.find((f) => f.source === 'studio')
    expect(studioFinding).toBeDefined()
    expect(studioFinding?.kind).toBe('declared-image-missing')
    expect(studioFinding?.severity).toBe('warning')
    expect(studioFinding?.message).not.toMatch(/fallback|fell back/i)
  })

  it('an unknown template value is a warning, not an error', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'weird', template: 'not-a-real-template', title: 'T', body: 'Body' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    const entry = report.entries[0]
    expect(entry.delivered !== 'dropped' && entry.delivered.template).toBe('text')

    const fallback = entry.findings.find((f) => f.kind === 'template-fallback')
    expect(fallback).toBeDefined()
    expect(fallback?.severity).toBe('warning')
    expect(entry.findings.every((f) => f.severity !== 'error')).toBe(true)
  })

  it('does not flag a declared image when the images list is omitted', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'split-1',
        template: 'split',
        title: 'T',
        body: 'Body',
        image: 'img/foo.png',
        order: '1',
      },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    const entry = report.entries[0]
    expect(entry.findings.some((f) => f.source === 'studio')).toBe(false)
  })

  it('does not flag a declared image that is present in the supplied images list', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'split-1',
        template: 'split',
        title: 'T',
        body: 'Body',
        image: 'img/foo.png',
        order: '1',
      },
    ])

    const report = buildNewsReport({
      index,
      documents,
      now: NOW,
      images: [{ name: 'img/foo.png', size: 42 }],
    })

    const entry = report.entries[0]
    // Delivered as declared - no fallback - and the declared image is present, so no finding at all.
    expect(entry.delivered !== 'dropped' && entry.delivered.template).toBe('split')
    expect(entry.findings).toHaveLength(0)
  })

  it('flags a declared image absent from the images list even when the pipeline delivers as declared', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'split-1',
        template: 'split',
        title: 'T',
        body: 'Body',
        image: 'img/missing.png',
        order: '1',
      },
    ])

    const report = buildNewsReport({
      index,
      documents,
      now: NOW,
      images: [{ name: 'img/other.png', size: 42 }],
    })

    const entry = report.entries[0]
    expect(entry.delivered !== 'dropped' && entry.delivered.template).toBe('split')
    expect(entry.findings).toHaveLength(1)
    expect(entry.findings[0]).toMatchObject({
      kind: 'declared-image-missing',
      severity: 'warning',
      source: 'studio',
      message: 'declared image "img/missing.png" not found',
    })
  })
})
