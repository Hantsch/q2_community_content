/**
 * Story 011 D2: proves the report spine - one `EntryVerdict` per index row, in the index's own
 * order, with declared/delivered templates, dropped-entry reasons, and the summary counts. AC8's
 * "every verdict traces to a pipeline warning or a pipeline slide" is proven literally: the test
 * calls `resolveFeed()` itself for ground truth and cross-checks every `source: 'pipeline'` finding
 * against it.
 */
import { describe, expect, it } from 'vitest'
import { resolveFeed } from '../contract/launcher-contract'
import { buildNewsReport } from './build-news-report'
import { buildNewsTreeFixture } from './__fixtures__/news-tree'

const NOW = new Date('2026-09-14T00:00:00.000Z')

describe('buildNewsReport', () => {
  it('every index row gets a declared and a delivered template', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'a', template: 'text', title: 'A', body: 'Body A' },
      { id: 'b', template: 'banner', title: 'B', body: 'Body B' },
      { id: 'c', template: 'split', title: 'C', body: 'Body C', image: 'img/c.png' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    expect(report.entries).toHaveLength(3)

    const byId = Object.fromEntries(report.entries.map((entry) => [entry.id, entry]))
    expect(byId.a.declared.template).toBe('text')
    expect(byId.a.delivered).not.toBe('dropped')
    expect(byId.a.delivered !== 'dropped' && byId.a.delivered.template).toBe('text')

    expect(byId.b.declared.template).toBe('banner')
    expect(byId.b.delivered !== 'dropped' && byId.b.delivered.template).toBe('banner')

    expect(byId.c.declared.template).toBe('split')
    expect(byId.c.delivered !== 'dropped' && byId.c.delivered.template).toBe('split')
  })

  describe('a dropped entry names the rule that dropped it', () => {
    // `newsTextContentSchema` (the fallback shape) requires both `title` and `body` non-empty
    // (`z.string().min(1)` on each, see `@shared/modules/home`) - so either one alone being unusable
    // is enough to drop the entry. These are two independently-triggering rules, not one combined
    // fixture with neither field set, so each gets its own case.
    it('no usable title at all (body present) has no template to fall back', () => {
      const { index, documents } = buildNewsTreeFixture([{ id: 'a', body: 'Some body text' }])

      const report = buildNewsReport({ index, documents, now: NOW })

      const entry = report.entries[0]
      expect(entry.delivered).toBe('dropped')
      const findings = entry.findings.filter((f) => f.severity === 'error')
      expect(findings).toHaveLength(1)
      expect(findings[0].kind).toBe('template-unresolvable')
      expect(findings[0].message).toMatch(/^dropped: /)
    })

    it('body genuinely empty (title present) has no template to fall back', () => {
      const { index, documents } = buildNewsTreeFixture([{ id: 'a', title: 'A', body: '' }])

      const report = buildNewsReport({ index, documents, now: NOW })

      const entry = report.entries[0]
      expect(entry.delivered).toBe('dropped')
      const findings = entry.findings.filter((f) => f.severity === 'error')
      expect(findings).toHaveLength(1)
      expect(findings[0].kind).toBe('template-unresolvable')
      expect(findings[0].message).toMatch(/^dropped: /)
    })

    it('frontmatter that did not parse', () => {
      const { index, documents } = buildNewsTreeFixture([
        { id: 'a', rawDocument: 'not frontmatter at all' },
      ])

      const report = buildNewsReport({ index, documents, now: NOW })

      const entry = report.entries[0]
      expect(entry.delivered).toBe('dropped')
      expect(entry.findings).toHaveLength(1)
      expect(entry.findings[0].kind).toBe('frontmatter-unparseable')
      expect(entry.findings[0].severity).toBe('error')
    })

    it('an index row without id or file', () => {
      const index = { schemaVersion: 1, entries: [{}, { id: 'a', file: 'a.md' }] }
      const documents = {
        'a.md': ['---', 'template: text', 'title: A', '---', 'Body A'].join('\n'),
      }

      const report = buildNewsReport({ index, documents, now: NOW })

      expect(report.entries).toHaveLength(1)
      expect(report.entries[0].id).toBe('a')

      expect(report.findings).toHaveLength(1)
      expect(report.findings[0].severity).toBe('error')
      expect(report.findings[0].kind).toBe('index-entry-invalid')
      expect(report.findings[0].entryId).toBeUndefined()
      expect(report.findings[0].message).toMatch(/^index entry at position 0 /)
    })

    it('a duplicate id', () => {
      const { index, documents } = buildNewsTreeFixture([
        { id: 'a', file: 'a.md', template: 'text', title: 'A', body: 'Body A' },
        { id: 'a', file: 'a-dup.md', template: 'text', title: 'A2', body: 'Body A2' },
      ])

      const report = buildNewsReport({ index, documents, now: NOW })

      expect(report.entries).toHaveLength(2)
      const [first, second] = report.entries
      expect(first.delivered).not.toBe('dropped')
      expect(first.findings.filter((f) => f.severity === 'error')).toHaveLength(0)

      expect(second.delivered).toBe('dropped')
      expect(second.findings).toHaveLength(1)
      expect(second.findings[0].kind).toBe('duplicate-id')
      expect(second.findings[0].severity).toBe('error')
    })
  })

  it('every verdict traces to a pipeline warning or a pipeline slide', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'clean', template: 'text', title: 'Clean', body: 'Body' },
      { id: 'fallback', template: 'split', title: 'Fallback', body: 'Body' }, // no image -> falls back to text
      { id: 'dropped', body: '' }, // no title, no body -> dropped
      // Resolved but outside its own visibility window: the pipeline emits no `NewsFeedWarning` at
      // all for this (filtering is silent), so this exercises the *other* AC8 root the test above's
      // comment only names in passing - a `source: 'pipeline'` finding traced to a pipeline *slide*
      // (presence in `ground.slides`), not to any `warnings[].reason` string.
      { id: 'expired', template: 'text', title: 'Expired', body: 'Body', visibleUntil: '2020-01-01T00:00:00.000Z' },
    ])

    const ground = resolveFeed({ index, documents })
    const report = buildNewsReport({ index, documents, now: NOW })

    const rawReasons = ground.warnings.map((w) => w.reason)
    const allFindings = [...report.findings, ...report.entries.flatMap((e) => e.findings)]
    const pipelineFindings = allFindings.filter((f) => f.source === 'pipeline')

    expect(pipelineFindings.length).toBeGreaterThan(0)
    // Confirm the case this test now specifically exercises actually produced a pipeline-sourced
    // finding, so the loop below isn't vacuously skipping the slide-traced branch.
    expect(pipelineFindings.some((f) => f.kind === 'expired')).toBe(true)

    for (const finding of pipelineFindings) {
      if (finding.kind === 'scheduled' || finding.kind === 'expired') {
        // No `warnings[].reason` explains these - they are read off presence/absence of the id in
        // the pipeline's own `resolveFeed()` slide list, which AC8's "derived from the mirrored
        // pipeline's own output" wording admits as a legitimate root just as much as a warning.
        expect(ground.slides.some((slide) => slide.id === finding.entryId)).toBe(true)
        continue
      }
      // D3 enriches `template-fallback` findings with the declared `image` value, appending to -
      // never replacing - the pipeline's own wording (see `template-verdict.ts`), so a
      // pipeline-sourced finding's message still *starts with* the raw reason verbatim, even
      // where it is no longer exactly equal to it.
      expect(rawReasons.some((reason) => finding.message.startsWith(reason))).toBe(true)
    }
  })

  it('summarizes delivered-as-declared, fallen-back and dropped counts', () => {
    const { index, documents } = buildNewsTreeFixture([
      { id: 'clean', template: 'text', title: 'Clean', body: 'Body' },
      { id: 'fallback', template: 'split', title: 'Fallback', body: 'Body' },
      { id: 'dropped', body: '' },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })

    expect(report.summary.deliveredAsDeclared).toBe(1)
    expect(report.summary.fallenBack).toBe(1)
    expect(report.summary.dropped).toBe(1)
    expect(report.summary.findingsBySeverity.error).toBe(1)
    expect(report.summary.findingsBySeverity.warning).toBeGreaterThanOrEqual(1)
  })
})
