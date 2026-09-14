/**
 * Story 011 D4: proves every declared button is reported once, as kept or dropped, and that a
 * dropped one names the pipeline's own reason (AC5) - including the two cases the pipeline's prose
 * does not identify by itself: a candidate `newsButtonSchema` refused, and the buttons the cap cut
 * without a word about which ones they were.
 *
 * Driven through `buildNewsReport()` rather than the pure function alone, the way D3's tests are:
 * the warnings being attributed have to be the mirrored pipeline's real output for the attribution
 * to mean anything (AC8), and this also proves the wiring.
 *
 * Note on AC5's "missing label or url": a frontmatter button entry without a `url:` line never
 * becomes a declared button at all - the mirrored `parseFrontmatter()` drops it before the pipeline
 * sees it (`frontmatter.ts`, `parseButtonEntry()`), so neither side of the report knows it existed.
 * What does reach `sanitizeButtons()` and trigger its "without a usable label/url pair" warning is
 * a button whose `url` is not a usable url, which is what these tests exercise.
 */
import { describe, expect, it } from 'vitest'
import { resolveFeed } from '../contract/launcher-contract'
import { buildNewsReport } from './build-news-report'
import { buildNewsTreeFixture } from './__fixtures__/news-tree'

const NOW = new Date('2026-09-14T00:00:00.000Z')

const RELEASES = 'https://github.com/q2/releases'
const RAW = 'https://raw.githubusercontent.com/q2/readme.md'

describe('button verdicts', () => {
  it('every declared button is reported as kept or dropped with its reason', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'a',
        template: 'text',
        title: 'A',
        body: 'Body A',
        buttons: [
          { label: 'Releases', url: RELEASES },
          { label: 'Gist', url: 'https://gist.github.com/q2/1' },
          { label: 'Broken', url: 'not-a-url' },
        ],
      },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.buttons).toHaveLength(3)
    expect(entry.buttons.map((button) => button.kept)).toEqual([true, false, false])
    expect(entry.buttons[0].declared).toEqual({ label: 'Releases', url: RELEASES })
    expect(entry.buttons[0].reason).toBeUndefined()

    expect(entry.buttons[1].reason).toBe('button-host-not-allowed')
    expect(entry.buttons[2].reason).toBe('button-invalid')

    const hostFinding = entry.findings.find((f) => f.kind === 'button-host-not-allowed')
    expect(hostFinding).toMatchObject({ severity: 'warning', source: 'pipeline', entryId: 'a' })
    // AC5: the reason names the url that was not allowed.
    expect(hostFinding?.message).toContain('https://gist.github.com/q2/1')

    const invalidFinding = entry.findings.find((f) => f.kind === 'button-invalid')
    expect(invalidFinding?.message).toMatch(
      /^a button without a usable label\/url pair was dropped/,
    )
    // ... and names which button, which the pipeline's own wording does not.
    expect(invalidFinding?.message).toContain('url: "not-a-url"')

    // The pipeline said each of these exactly once, and the report says each exactly once.
    expect(entry.findings.filter((f) => f.kind.startsWith('button'))).toHaveLength(2)
  })

  it('filters before it caps: five buttons, two off-allowlist, three kept', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'a',
        template: 'text',
        title: 'A',
        body: 'Body A',
        buttons: [
          { label: 'One', url: `${RELEASES}/1` },
          { label: 'Gist', url: 'https://gist.github.com/q2/1' },
          { label: 'Two', url: `${RELEASES}/2` },
          { label: 'Elsewhere', url: 'https://example.com/q2' },
          { label: 'Three', url: RAW },
        ],
      },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.buttons.map((button) => button.kept)).toEqual([true, false, true, false, true])
    expect(entry.buttons.filter((button) => button.kept)).toHaveLength(3)
    expect(entry.buttons[1].reason).toBe('button-host-not-allowed')
    expect(entry.buttons[3].reason).toBe('button-host-not-allowed')
    // Only two survivors would have been cut by counting the rejects against the cap - the cap
    // never fires here, so nothing may claim it did.
    expect(entry.findings.some((f) => f.kind === 'button-cap')).toBe(false)
    expect(entry.delivered !== 'dropped' && entry.delivered.buttons.map((b) => b.label)).toEqual([
      'One',
      'Two',
      'Three',
    ])
  })

  it('names the buttons the cap cut, which the pipeline only counts', () => {
    const buttons = [1, 2, 3, 4, 5].map((n) => ({ label: `B${n}`, url: `${RELEASES}/${n}` }))
    const { index, documents } = buildNewsTreeFixture([
      { id: 'a', template: 'text', title: 'A', body: 'Body A', buttons },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.buttons.map((button) => button.kept)).toEqual([true, true, true, false, false])
    const capVerdicts = entry.buttons.filter((button) => button.reason === 'button-cap')
    expect(capVerdicts.map((button) => button.declared.label)).toEqual(['B4', 'B5'])

    const capFindings = entry.findings.filter((f) => f.kind === 'button-cap')
    expect(capFindings).toHaveLength(2)
    expect(capFindings[0].severity).toBe('warning')
    expect(capFindings[0].source).toBe('pipeline')
    expect(capFindings[0].message).toContain('B4')
    expect(capFindings[1].message).toContain('B5')

    // Cross-check against the pipeline's own count: the one cap warning says how many buttons went,
    // and that is exactly how many the report names.
    const ground = resolveFeed({ index, documents })
    const capWarning = ground.warnings.find((w) => /beyond the cap of/.test(w.reason))
    const declaredCount = Number(/^(\d+) button/.exec(capWarning?.reason ?? '')?.[1])
    expect(declaredCount).toBe(capVerdicts.length)
    // Every per-button message still starts with the pipeline's verbatim reason (AC8).
    for (const finding of capFindings) {
      expect(finding.message.startsWith(capWarning?.reason ?? '')).toBe(true)
    }
  })

  it('tells a cap victim from an unusable button that was declared after it', () => {
    // The case a warning-order zip gets backwards: `sanitizeButtons()` emits the shape reject for
    // B5 while iterating and the cap warning afterwards, so the warning stream reads "invalid, cap"
    // even though it was B4 - declared first, and perfectly valid - that the cap cut.
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'a',
        template: 'text',
        title: 'A',
        body: 'Body A',
        buttons: [
          { label: 'B1', url: `${RELEASES}/1` },
          { label: 'B2', url: `${RELEASES}/2` },
          { label: 'B3', url: `${RELEASES}/3` },
          { label: 'B4', url: `${RELEASES}/4` },
          { label: 'B5', url: 'nonsense' },
        ],
      },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.buttons.map((button) => button.kept)).toEqual([true, true, true, false, false])
    expect(entry.buttons[3].reason).toBe('button-cap')
    expect(entry.buttons[4].reason).toBe('button-invalid')
  })

  it('reports the buttons of a dropped entry as dropped without inventing a button reason', () => {
    const { index, documents } = buildNewsTreeFixture([
      // No title and an empty body: the entry is dropped before the pipeline ever sanitizes buttons.
      { id: 'a', body: '', buttons: [{ label: 'Releases', url: RELEASES }] },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.delivered).toBe('dropped')
    expect(entry.buttons).toEqual([
      { declared: { label: 'Releases', url: RELEASES }, kept: false, reason: 'entry-dropped' },
    ])
    // The entry's own drop finding is the explanation; no button finding is fabricated.
    expect(entry.findings.every((f) => !f.kind.startsWith('button'))).toBe(true)
  })

  it('keeps a non-list buttons field as an entry-level finding, with no buttons to attribute it to', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'a',
        rawDocument: ['---', 'template: text', 'title: A', 'buttons: nonsense', '---', 'Body'].join(
          '\n',
        ),
      },
    ])

    const report = buildNewsReport({ index, documents, now: NOW })
    const entry = report.entries[0]

    expect(entry.buttons).toEqual([])
    expect(entry.findings.some((f) => f.kind === 'buttons-invalid')).toBe(true)
  })
})
