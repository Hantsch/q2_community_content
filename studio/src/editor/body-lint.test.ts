import { describe, expect, it } from 'vitest'
import { lintBody } from './body-lint'

describe('lintBody', () => {
  it('an empty or whitespace-only body is flagged as the drop cause', () => {
    for (const body of ['', '   ', '\n\n', ' \t\r\n ']) {
      const findings = lintBody(body)
      expect(findings).toHaveLength(1)
      expect(findings[0].code).toBe('empty-body')
      expect(findings[0].severity).toBe('error')
      expect(findings[0].message).toMatch(/drops the entry/)
      expect(findings[0].message).toMatch(/shows nothing/)
    }
    expect(lintBody('Hello').some((f) => f.code === 'empty-body')).toBe(false)
  })

  it('every markdown construct the launcher does not render is flagged with its line', () => {
    const cases: Array<[string, string]> = [
      ['bold', 'a **x** b'],
      ['bold', 'a __x__ b'],
      ['italic', 'a *x* b'],
      ['italic', 'a _x_ b'],
      ['strikethrough', 'a ~~x~~ b'],
      ['inline code', 'a `x` b'],
      ['fenced code', '```js'],
      ['heading', '## Title'],
      ['list item', '- one'],
      ['list item', '* one'],
      ['list item', '+ one'],
      ['list item', '1. one'],
      ['blockquote', '> quoted'],
      ['link', 'see [t](https://x.example)'],
      ['image', '![alt](https://x.example/a.png)'],
      ['autolink', 'go <https://x.example>'],
      ['HTML tag', 'a <b>x</b>'],
      ['HTML tag', 'end</p>'],
      ['horizontal rule', '---'],
      ['horizontal rule', '***'],
      ['HTML entity', 'Tom &amp; Jerry'],
      ['HTML entity', 'it&#39;s'],
    ]
    for (const [construct, text] of cases) {
      // Two clean lines first: the finding must carry its own 1-based line, not line 1.
      const findings = lintBody(`plain\nplain\n${text}\n`)
      const hit = findings.filter((f) => f.construct === construct)
      expect(hit.length, `${construct}: ${text}`).toBeGreaterThanOrEqual(1)
      for (const f of hit) {
        expect(f.code).toBe('literal-markdown')
        expect(f.severity).toBe('warning')
        expect(f.line).toBe(3)
        expect(f.message).toBe(
          `${construct} is not rendered by the launcher — these characters appear literally on the slide`,
        )
      }
      expect(
        findings.every((f) => f.line === 3),
        text,
      ).toBe(true)
    }
  })

  it('reports one finding per occurrence', () => {
    const findings = lintBody('**a** and **b**\n[x](u) [y](v)')
    expect(findings.map((f) => [f.construct, f.line])).toEqual([
      ['bold', 1],
      ['bold', 1],
      ['link', 2],
      ['link', 2],
    ])
  })

  it('plain prose with underscores, a lone asterisk and an ampersand is not flagged', () => {
    const prose = [
      'Set the snake_case_name and my_var_2 in the config.',
      'Compute 5 * 3 and 2 * 4 for the total.',
      'Fish & chips, R&D, and a < b > c are fine.',
      'Cost: 5 < 10 & 10 > 5.',
      'Ends with a dash - not a list, and a 3.5 rating.',
    ].join('\n')
    expect(lintBody(prose)).toEqual([])
  })
})
