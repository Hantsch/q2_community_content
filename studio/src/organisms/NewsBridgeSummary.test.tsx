// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { ContentSourceRead } from '../content-types/descriptor'
import { NewsBridgeSummary } from './NewsBridgeSummary'

afterEach(cleanup)

const SUCCESS_READ: ContentSourceRead = {
  repoRoot: '/repo',
  index: {
    text: '{"entries":[{"file":"a.md"},{"file":"b.md"}]}',
    value: { entries: [{ file: 'a.md' }, { file: 'b.md' }] },
    parsed: true,
  },
  documents: { 'a.md': { text: 'A' } },
  drafts: [{ path: 'news/draft.md', text: 'D' }],
  images: [],
  findings: [],
}

const ERROR_READ: ContentSourceRead = {
  repoRoot: '',
  index: { text: '', value: undefined, parsed: false },
  documents: {},
  drafts: [],
  images: [],
  findings: [
    {
      code: 'file-bridge-error',
      severity: 'error',
      message: 'news/ was not read: HTTP 404',
      path: 'news',
    },
  ],
}

test('a successful read shows the index path and the counts of entries, documents and drafts', async () => {
  render(<NewsBridgeSummary reader={() => Promise.resolve(SUCCESS_READ)} />)

  expect(await screen.findByText('Index: news/index.json')).toBeDefined()
  expect(screen.getByText('Entries: 2')).toBeDefined()
  expect(screen.getByText('Documents: 1')).toBeDefined()
  expect(screen.getByText('Drafts: 1')).toBeDefined()
})

test('a read with an error finding shows the finding message instead of counts', async () => {
  render(<NewsBridgeSummary reader={() => Promise.resolve(ERROR_READ)} />)

  expect(await screen.findByText(/news\/ was not read: HTTP 404/)).toBeDefined()
  expect(screen.queryByText(/^Entries:/)).toBeNull()
  expect(screen.queryByText(/^Documents:/)).toBeNull()
  expect(screen.queryByText(/^Drafts:/)).toBeNull()
})
