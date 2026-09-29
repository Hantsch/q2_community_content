import { describe, expect, it } from 'vitest'
import { isAllowedButtonHost, newsButtonSchema } from '../contract/launcher-contract'
import { canSave, validateDraft } from './field-rules'
import type { DraftButton, DraftFields, EntryDraft } from './frontmatter-draft'

function draftWith(patch: Partial<DraftFields> = {}): EntryDraft {
  const fields: DraftFields = {
    template: 'text',
    title: 'Hello',
    order: '1',
    image: '',
    visibleFrom: '',
    visibleUntil: '',
    buttons: [],
    ...patch,
  }
  return { file: 'news/a.md', originalText: '', fields, initialFields: fields }
}

const btn = (n: number, url = `https://github.com/q2/${n}`): DraftButton => ({
  label: `B${n}`,
  url,
})

describe('field rules', () => {
  it('a rejected button url names the rule it breaks', () => {
    const cases: [DraftButton, string][] = [
      [{ label: '', url: 'https://github.com/x' }, 'missing label'],
      [{ label: 'a', url: 'nope' }, 'not a URL'],
      [{ label: 'a', url: 'http://github.com/x' }, 'not https'],
      [
        { label: 'a', url: 'https://evil.example/x' },
        'host evil.example is not exactly github.com / raw.githubusercontent.com',
      ],
      [{ label: 'a', url: 'https://gist.github.com/x' }, 'host gist.github.com is not exactly'],
    ]
    for (const [button, text] of cases) {
      const issues = validateDraft(draftWith({ buttons: [button] }))
      expect(issues).toHaveLength(1)
      expect(issues[0].message).toContain(text)
      expect(issues[0].blocksSave).toBe(false)
    }
  })

  it("the url verdict agrees with the launcher's allowlist", () => {
    const urls = [
      'https://github.com/a',
      'https://raw.githubusercontent.com/a/b',
      'http://github.com/a',
      'https://www.github.com/a',
      'https://github.com.evil.io/a',
      'ftp://github.com/a',
      'github.com/a',
      '',
      'https://example.org',
    ]
    for (const url of urls) {
      const button = { label: 'x', url }
      const launcherKeeps = newsButtonSchema.safeParse(button).success && isAllowedButtonHost(url)
      const dropped = validateDraft(draftWith({ buttons: [button] })).some(
        (i) => i.field === 'buttons',
      )
      expect(dropped, url).toBe(!launcherKeeps)
    }
  })

  it('the button beyond the cap of three survivors is named as dropped', () => {
    const four = validateDraft(draftWith({ buttons: [btn(1), btn(2), btn(3), btn(4)] }))
    expect(four).toHaveLength(1)
    expect(four[0].index).toBe(3)
    expect(four[0].message).toContain('button 4 "B4"')
    expect(four[0].message).toContain('dropped: beyond the cap of 3')

    const withInvalid = validateDraft(
      draftWith({ buttons: [btn(1), btn(2, 'http://x.io'), btn(3), btn(4)] }),
    )
    expect(withInvalid.map((i) => i.index)).toEqual([1])
  })

  it('only a full ISO 8601 instant with a zone passes', () => {
    const ok = [
      '',
      '2026-08-01T00:00:00Z',
      '2026-08-01T10:30+02:00',
      '2026-08-01T10:30:15.250-05:30',
      '2028-02-29T00:00Z',
    ]
    const bad = [
      '2026-08-01',
      '2026-02-30T00:00:00Z',
      '2026-13-01T00:00:00Z',
      '2026-08-01T24:00:00Z',
      '2026-08-01T00:00:00',
      '2026-08-01 00:00:00Z',
      'soon',
      '2027-02-29T00:00Z',
    ]
    for (const v of ok) {
      expect(validateDraft(draftWith({ visibleFrom: v, visibleUntil: v }))).toEqual([])
    }
    for (const v of bad) {
      const issues = validateDraft(draftWith({ visibleUntil: v }))
      expect(issues, v).toHaveLength(1)
      expect(issues[0].blocksSave).toBe(true)
    }
    expect(validateDraft(draftWith({ visibleFrom: '2026-08-01' }))[0].message).toContain(
      'a date alone is not an instant — add a time and a zone, e.g. 2026-08-01T00:00:00Z',
    )
  })

  it('presentation values are refused in every free-text field', () => {
    const values: [string, string][] = [
      ['<b>x</b>', 'HTML tag'],
      ['</p>', 'HTML tag'],
      ['a <!-- c', 'HTML tag or comment'],
      ['color: red;', 'CSS declaration'],
      ['x style="a"', 'CSS declaration'],
      ['rgb(1,2,3)', 'CSS function'],
      ['var(--a)', 'CSS function'],
      ['calc(1+1)', 'CSS function'],
      ['url(x)', 'CSS function'],
      ['#fff', 'hex colour'],
      ['#a1b2c3d4', 'hex colour'],
      ['12px', 'CSS length'],
      ['1.5rem', 'CSS length'],
      ['100vh', 'CSS length'],
    ]
    const makers = [
      (v: string) => draftWith({ title: v }),
      (v: string) => draftWith({ image: v }),
      (v: string) => draftWith({ buttons: [{ label: v, url: 'https://github.com/a' }] }),
    ]
    for (const [value, rule] of values) {
      for (const make of makers) {
        const issues = validateDraft(make(value))
        expect(
          issues.some((i) => i.rule === 'presentation' && i.message.includes(rule)),
          value,
        ).toBe(true)
        expect(issues.every((i) => i.rule !== 'presentation' || i.blocksSave)).toBe(true)
      }
    }
  })

  it('ordinary titles are not mistaken for presentation', () => {
    for (const title of ['Patch #123', '50% off', 'Quake II: the return', 'Issue #1234']) {
      expect(validateDraft(draftWith({ title })), title).toEqual([])
    }
  })

  it('canSave is false while an error stands', () => {
    expect(canSave(draftWith())).toBe(true)
    expect(canSave(draftWith({ template: 'weird', buttons: [btn(1, 'http://x.io')] }))).toBe(true)
    expect(canSave(draftWith({ title: '<b>x</b>' }))).toBe(false)
    expect(canSave(draftWith({ visibleFrom: '2026-08-01' }))).toBe(false)
    expect(validateDraft(draftWith({ template: 'weird' }))[0].message).toBe(
      'unknown template, delivered as text',
    )
  })
})
