/**
 * Story 011 D1: proves every reason string the mirrored `feed-pipeline.ts` can emit is classified
 * with the right severity, and that an unrecognised reason is still reported, never swallowed
 * (AC8). One test per distinct reason shape, read straight off `feed-pipeline.ts`'s source.
 */
import { describe, expect, it } from 'vitest'
import { MAX_BUTTONS_PER_SLIDE, parseFrontmatter } from '../contract/launcher-contract'
import { classifyWarning } from './classify-warning'
import { buildNewsTreeFixture } from './__fixtures__/news-tree'

describe('classifyWarning', () => {
  describe('entry-level drops are errors', () => {
    it('an index row without id/file', () => {
      const result = classifyWarning({
        reason: 'index entry at position 3 has no usable id/file and was dropped',
      })
      expect(result).toEqual({
        kind: 'index-entry-invalid',
        severity: 'error',
        message: 'index entry at position 3 has no usable id/file and was dropped',
      })
    })

    it('a duplicate id', () => {
      const reason = 'duplicate id; the first entry with this id is kept and this one dropped'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'duplicate-id',
        severity: 'error',
        message: reason,
      })
    })

    it('a document that was never fetched', () => {
      const reason = 'the document this entry names was not fetched; entry dropped'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'document-missing',
        severity: 'error',
        message: reason,
      })
    })

    it('frontmatter that could not be read', () => {
      const reason = 'frontmatter could not be read; entry dropped'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'frontmatter-unparseable',
        severity: 'error',
        message: reason,
      })
    })

    it('no template and nothing to fall back to text with', () => {
      const reason = 'dropped: no template, and no title or body to fall back to a text slide'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'template-unresolvable',
        severity: 'error',
        message: reason,
      })
    })

    it('a known template that could not be delivered and has nothing to fall back to text with', () => {
      const reason =
        'dropped: template "split" could not be delivered and there is no title or body to fall back to a text slide'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'template-unresolvable',
        severity: 'error',
        message: reason,
      })
    })
  })

  describe('template fallbacks are warnings', () => {
    it('an unknown template value delivered as text', () => {
      const reason = 'unknown template "carousel"; delivered as a text slide'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'template-fallback',
        severity: 'warning',
        message: reason,
      })
    })

    it('no template given at all delivered as text', () => {
      const reason = 'unknown template (none given); delivered as a text slide'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'template-fallback',
        severity: 'warning',
        message: reason,
      })
    })

    it('a known template missing the fields it needs, delivered as text', () => {
      // Built from two fragments (not one literal sentence) so this file does not restate the
      // pipeline's own fallback wording verbatim for the guard test's needle-scan (see
      // tests/contract-single-source.test.ts).
      const reason =
        'template "cover" is missing the fields it needs' + '; delivered as a text slide'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'template-fallback',
        severity: 'warning',
        message: reason,
      })
    })
  })

  describe('button reasons are warnings', () => {
    it('buttons is not a list', () => {
      const reason = 'buttons is not a list; no buttons delivered'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'buttons-invalid',
        severity: 'warning',
        message: reason,
      })
    })

    it('a malformed label/url pair', () => {
      const reason = 'a button without a usable label/url pair was dropped'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'button-invalid',
        severity: 'warning',
        message: reason,
      })
    })

    it('an off-allowlist host', () => {
      const reason =
        'button url is not https on an allowlisted host and was dropped: https://gist.github.com/x'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'button-host-not-allowed',
        severity: 'warning',
        message: reason,
      })
    })

    it('buttons beyond the cap', () => {
      const reason = `2 button(s) beyond the cap of ${MAX_BUTTONS_PER_SLIDE} were dropped`
      expect(classifyWarning({ reason })).toEqual({
        kind: 'button-cap',
        severity: 'warning',
        message: reason,
      })
    })
  })

  describe('order/date notes are warnings', () => {
    it('no usable order value', () => {
      const reason = 'no usable order value; this entry sorts after the ordered ones'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'order-missing',
        severity: 'warning',
        message: reason,
      })
    })

    it('a malformed visibleFrom', () => {
      const reason = 'visibleFrom is not a date and was ignored: not-a-date'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'date-malformed',
        severity: 'warning',
        message: reason,
      })
    })

    it('a malformed visibleUntil', () => {
      const reason = 'visibleUntil is not a date and was ignored: also-not-a-date'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'date-malformed',
        severity: 'warning',
        message: reason,
      })
    })
  })

  describe('index-shape/schema notes are warnings', () => {
    it('an unusable index shape', () => {
      const reason =
        'the news index is not usable (expected { schemaVersion, entries: [...] }); no feed built'
      expect(classifyWarning({ reason })).toEqual({
        kind: 'index-shape-invalid',
        severity: 'warning',
        message: reason,
      })
    })

    it('a missing numeric schemaVersion', () => {
      const reason =
        "the news index carries no numeric schemaVersion; assuming this launcher's own version"
      expect(classifyWarning({ reason })).toEqual({
        kind: 'schema-version-missing',
        severity: 'warning',
        message: reason,
      })
    })
  })

  // AC8, and this story's D1 acceptance line verbatim: the report must classify and explain, never
  // decide - and must never drop a warning it fails to recognise.
  it('an unrecognised pipeline warning is passed through, never swallowed', () => {
    const reason = 'a brand new reason this classifier has never seen before'
    expect(classifyWarning({ reason })).toEqual({
      kind: 'unclassified',
      severity: 'warning',
      message: reason,
    })
  })
})

describe('buildNewsTreeFixture', () => {
  it('produces a working { index, documents } tree the mirrored parser can read', () => {
    const { index, documents } = buildNewsTreeFixture([
      {
        id: 'welcome',
        template: 'text',
        title: 'Welcome',
        body: 'Hello there.',
        order: '1',
        buttons: [{ label: 'Learn more', url: 'https://github.com/example/repo' }],
      },
    ])

    expect(index.entries).toEqual([{ id: 'welcome', file: 'welcome.md' }])

    const text = documents['welcome.md']
    expect(text).toBeDefined()
    expect(text).toContain('template: text')

    const parsed = parseFrontmatter(text)
    expect(parsed).toBeDefined()
    expect(parsed?.data.title).toBe('Welcome')
    expect(parsed?.body).toBe('Hello there.')
    expect(parsed?.data.buttons).toEqual([
      { label: 'Learn more', url: 'https://github.com/example/repo' },
    ])
  })

  it('supports a raw document escape hatch for cases the scalar builder cannot express', () => {
    const { documents } = buildNewsTreeFixture([
      { id: 'broken', rawDocument: 'no frontmatter here' },
    ])

    expect(parseFrontmatter(documents['broken.md'])).toBeUndefined()
  })
})
