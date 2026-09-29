// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { EntryVerdict } from '../../report/report-types'
import { DraftPreviewNotice } from './DraftPreviewNotice'

afterEach(cleanup)

function verdict(overrides: Partial<EntryVerdict> = {}): EntryVerdict {
  return {
    id: 'draft-cover',
    file: 'draft-cover.md',
    indexPosition: 2,
    declared: {
      template: 'cover',
      title: 'Draft Cover',
      body: 'Body',
      order: '20',
      buttonCount: 0,
      buttons: [],
    },
    delivered: { template: 'text', order: 20, position: 1, buttons: [] },
    visibility: { state: 'published' },
    buttons: [],
    findings: [
      {
        severity: 'warning',
        kind: 'template-fallback',
        message: 'Cover needs an image; falling back to text.',
        source: 'pipeline',
      },
    ],
    ...overrides,
  }
}

test('the notice names the draft and the fallback it would get', () => {
  render(<DraftPreviewNotice verdict={verdict()} deliveredCount={3} />)

  const region = screen.getByRole('region', { name: 'Draft preview' })
  expect(within(region).getByText('Draft')).toBeDefined()
  expect(
    within(region).getByText(/Not in news\/index\.json — the launcher does not show this\./),
  ).toBeDefined()
  expect(within(region).getByText(/delivered as text \(declared cover\)/)).toBeDefined()
  expect(within(region).getByText('Cover needs an image; falling back to text.')).toBeDefined()
  expect(within(region).getByText(/appended to the end of news\/index\.json/)).toBeDefined()
})

test('the notice states the would-be position', () => {
  const { rerender } = render(<DraftPreviewNotice verdict={verdict()} deliveredCount={3} />)
  expect(screen.getByText("Position 2 of 3 in today's feed, by its order 20.")).toBeDefined()

  rerender(
    <DraftPreviewNotice
      verdict={verdict({
        delivered: { template: 'text', order: 20, buttons: [] },
        visibility: { state: 'scheduled', visibleFrom: '2099-01-01' },
      })}
      deliveredCount={3}
    />,
  )
  expect(screen.queryByText(/^Position/)).toBeNull()
  expect(screen.getByText(/Scheduled — visible from 2099-01-01/)).toBeDefined()
})
