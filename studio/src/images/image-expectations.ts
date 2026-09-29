/**
 * What a news template expects of its image, and the launcher's hard limits.
 *
 * Pure and browser-safe: the only import is the shared limits module. The numbers restate the
 * `## Image requirements` sections of `news/_templates/{cover,split,banner}/README.md`; a test
 * keeps them in step.
 */
import { MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION_PX } from './image-limits'

export interface ImageExpectation {
  recommended: { width: number; height: number }
  /** Accepted width / height range before an aspect-ratio warning is raised. */
  ratio: { min: number; max: number }
}

export const TEMPLATE_IMAGE_EXPECTATIONS: Record<'cover' | 'banner' | 'split', ImageExpectation> = {
  cover: { recommended: { width: 2560, height: 640 }, ratio: { min: 3.6, max: 4.4 } },
  banner: { recommended: { width: 1600, height: 480 }, ratio: { min: 3, max: 3.667 } },
  // Square or portrait: the image fills a column and is cropped top and bottom, never at the sides.
  split: { recommended: { width: 900, height: 900 }, ratio: { min: 0, max: 1.1 } },
}

export interface Finding {
  rule: 'too-large' | 'too-many-pixels' | 'aspect-ratio' | 'below-recommended'
  message: string
  expected: string
  actual: string
}

export interface ImageCheckInput {
  template: string
  width: number
  height: number
  bytes: number
}

const MIB = 1024 * 1024

const RATIO_LABEL: Record<'cover' | 'banner' | 'split', string> = {
  cover: '4:1 (2560×640), ±10 %',
  banner: '10:3 (1600×480), ±10 %',
  split: 'square or portrait (900×900)',
}

function isKnownTemplate(template: string): template is keyof typeof TEMPLATE_IMAGE_EXPECTATIONS {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_IMAGE_EXPECTATIONS, template)
}

/**
 * Refusals are the launcher's hard limits and apply to every template, `text` included. Warnings
 * come from the template's expectations; a template without any (`text`) gets none.
 */
export function checkImage({ template, width, height, bytes }: ImageCheckInput): {
  refusals: Finding[]
  warnings: Finding[]
} {
  const refusals: Finding[] = []
  const warnings: Finding[] = []

  if (bytes > MAX_IMAGE_BYTES) {
    refusals.push({
      rule: 'too-large',
      message: 'The image file is larger than the launcher accepts.',
      expected: `≤ ${MAX_IMAGE_BYTES / MIB} MB`,
      actual: `${(bytes / MIB).toFixed(1)} MB`,
    })
  }
  if (width > MAX_IMAGE_DIMENSION_PX || height > MAX_IMAGE_DIMENSION_PX) {
    refusals.push({
      rule: 'too-many-pixels',
      message: 'The image is wider or taller than the launcher accepts.',
      expected: `≤ ${MAX_IMAGE_DIMENSION_PX} px`,
      actual: `${width}×${height} px`,
    })
  }

  if (!isKnownTemplate(template)) return { refusals, warnings }
  const { recommended, ratio } = TEMPLATE_IMAGE_EXPECTATIONS[template]
  const actual = `${width}×${height} px`

  const aspect = width / height
  if (aspect < ratio.min || aspect > ratio.max) {
    warnings.push({
      rule: 'aspect-ratio',
      message: `The image's proportions do not suit the ${template} template.`,
      expected: RATIO_LABEL[template],
      actual,
    })
  }
  if (width < recommended.width || height < recommended.height) {
    warnings.push({
      rule: 'below-recommended',
      message: 'The image is smaller than the recommended source size and may look soft.',
      expected: `≥ ${recommended.width}×${recommended.height} px`,
      actual,
    })
  }
  return { refusals, warnings }
}

/** The frontmatter `image` value for a file stored in `news/img/`, relative to the document. */
export function imageFieldValue(name: string): string {
  return 'img/' + name
}

const GUIDANCE_HEADING = /^## Image requirements[ \t]*$/m

/** The README's `## Image requirements` section, without its heading; undefined if absent. */
export function extractImageGuidance(readmeText: string): string | undefined {
  const start = GUIDANCE_HEADING.exec(readmeText)
  if (!start) return undefined
  const rest = readmeText.slice(start.index + start[0].length)
  const next = /^## /m.exec(rest)
  return (next ? rest.slice(0, next.index) : rest).trim()
}
