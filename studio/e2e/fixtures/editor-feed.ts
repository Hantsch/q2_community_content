/**
 * Story 022 D3: a stubbed `GET /__studio/fs/read?type=news` response for the frontmatter editor
 * spec, installed with `page.route` before `goto('/')` (same approach as `library-feed.ts`). One
 * entry declares every contract field, one entry declares an unknown template, and one draft has
 * no frontmatter block at all.
 */
import type { Page } from '@playwright/test'

export const FULL_TITLE = 'Full Entry'
export const UNKNOWN_TEMPLATE_TITLE = 'Odd Template Entry'
export const UNREADABLE_DRAFT_FILE = 'news/broken-draft.md'

const FULL_DOC = [
  '---',
  'template: split',
  `title: ${FULL_TITLE}`,
  'order: 10',
  'image: img/cover.png',
  'visibleFrom: 2000-01-01T00:00:00Z',
  'visibleUntil: 2099-01-01T00:00:00Z',
  'buttons:',
  '  - label: Repo',
  '    url: https://github.com/q2/one',
  '  - label: Raw',
  '    url: https://raw.githubusercontent.com/q2/two',
  '  - label: Third',
  '    url: https://github.com/q2/three',
  '---',
  'Full body.',
].join('\n')

const ODD_DOC = [
  '---',
  'template: hologram',
  `title: ${UNKNOWN_TEMPLATE_TITLE}`,
  'order: 20',
  '---',
  'Odd body.',
].join('\n')

const BROKEN_DRAFT = 'no frontmatter block here'

function feedBody() {
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'full-entry', file: 'full-entry.md' },
      { id: 'odd-entry', file: 'odd-entry.md' },
    ],
  }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'full-entry.md': { text: FULL_DOC },
      'odd-entry.md': { text: ODD_DOC },
    },
    drafts: [{ path: UNREADABLE_DRAFT_FILE, text: BROKEN_DRAFT }],
    images: [],
    findings: [],
  }
}

export async function stubEditorFeed(page: Page): Promise<void> {
  await page.route('**/__studio/fs/read*', async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
