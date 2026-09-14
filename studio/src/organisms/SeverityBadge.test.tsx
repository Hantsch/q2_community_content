// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { FindingSeverity } from '../report/report-types'
import { SeverityBadge } from './SeverityBadge'

afterEach(cleanup)

const SEVERITIES: readonly FindingSeverity[] = ['error', 'warning', 'info']

const LABEL_BY_SEVERITY: Readonly<Record<FindingSeverity, string>> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

const GLYPH_BY_SEVERITY: Readonly<Record<FindingSeverity, string>> = {
  error: '⛔',
  warning: '⚠',
  info: 'ℹ',
}

describe.each(SEVERITIES)('SeverityBadge severity=%s', (severity) => {
  test('renders a distinct text label', () => {
    render(<SeverityBadge severity={severity} />)

    const label = screen.getByText(LABEL_BY_SEVERITY[severity])
    expect(label).toBeDefined()
  })

  test('renders a distinct glyph alongside the label, independent of colour', () => {
    render(<SeverityBadge severity={severity} />)

    const glyph = screen.getByText(GLYPH_BY_SEVERITY[severity])
    expect(glyph).toBeDefined()
  })
})

test('every severity renders a different label, so no two severities collapse onto the same text', () => {
  const labels = SEVERITIES.map((severity) => {
    const { unmount } = render(<SeverityBadge severity={severity} />)
    const text = screen.getByText(LABEL_BY_SEVERITY[severity]).textContent
    unmount()
    return text
  })

  expect(new Set(labels).size).toBe(SEVERITIES.length)
})

test('every severity renders a different glyph, so the distinction reads without colour', () => {
  const glyphs = SEVERITIES.map((severity) => {
    const { unmount } = render(<SeverityBadge severity={severity} />)
    const text = screen.getByText(GLYPH_BY_SEVERITY[severity]).textContent
    unmount()
    return text
  })

  expect(new Set(glyphs).size).toBe(SEVERITIES.length)
})
