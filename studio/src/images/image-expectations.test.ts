import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_IMAGE_EXPECTATIONS,
  checkImage,
  extractImageGuidance,
  imageFieldValue,
} from './image-expectations'

const readme = (template: string): string =>
  readFileSync(new URL(`../../../news/_templates/${template}/README.md`, import.meta.url), 'utf8')

const templates = ['cover', 'split', 'banner'] as const

describe('image expectations', () => {
  it('a matching image yields no findings', () => {
    for (const template of templates) {
      const { width, height } = TEMPLATE_IMAGE_EXPECTATIONS[template].recommended
      expect(checkImage({ template, width, height, bytes: 100_000 })).toEqual({
        refusals: [],
        warnings: [],
      })
    }
  })

  it('a mismatched image yields a warning with expected and actual values', () => {
    const { refusals, warnings } = checkImage({
      template: 'cover',
      width: 1000,
      height: 1000,
      bytes: 100_000,
    })
    expect(refusals).toEqual([])
    expect(warnings.map((w) => w.rule)).toEqual(['aspect-ratio', 'below-recommended'])
    expect(warnings[0]).toMatchObject({
      expected: '4:1 (2560×640), ±10 %',
      actual: '1000×1000 px',
    })
    expect(warnings[1]).toMatchObject({ expected: '≥ 2560×640 px', actual: '1000×1000 px' })
  })

  it("an image over the launcher's limits is refused, not warned", () => {
    const big = checkImage({ template: 'cover', width: 2560, height: 640, bytes: 6 * 1024 * 1024 })
    expect(big.refusals.map((f) => f.rule)).toEqual(['too-large'])
    expect(big.warnings).toEqual([])

    const wide = checkImage({ template: 'cover', width: 4001, height: 300, bytes: 1000 })
    expect(wide.refusals).toEqual([
      expect.objectContaining({
        rule: 'too-many-pixels',
        expected: '≤ 4000 px',
        actual: '4001×300 px',
      }),
    ])
    expect(wide.warnings.every((w) => w.rule !== 'too-many-pixels')).toBe(true)
  })

  it('the image field value is relative to the document', () => {
    expect(imageFieldValue('a.png')).toBe('img/a.png')
    expect('news/' + imageFieldValue('a.png')).toBe('news/img/a.png')
  })

  it("the image guidance is the README's Image requirements section", () => {
    for (const template of templates) {
      const guidance = extractImageGuidance(readme(template))
      expect(guidance).toBeDefined()
      expect(guidance).toContain('**Accepted formats:**')
      expect(guidance).toContain('### Safe zone')
      expect(guidance).not.toContain('## Image requirements')
      expect(guidance).not.toContain('## Note on schema versions')
      expect(guidance).toBe(guidance?.trim())
    }
    expect(extractImageGuidance(readme('text'))).toBeUndefined()
  })

  it('the expectations match the kit READMEs', () => {
    for (const template of templates) {
      const { width, height } = TEMPLATE_IMAGE_EXPECTATIONS[template].recommended
      const text = readme(template)
      expect(text).toContain(`${width}×${height}`)
      expect(text).toContain('5 MB')
      expect(text).toContain('4000 px')
    }
  })
})
