/**
 * Story 020 D2: a stubbed `GET /__studio/fs/read` response for the draft preview specs, installed
 * via `page.route` before `goto('/')` (same technique as `library-feed.ts` and `preview-feed.ts`).
 * Two published `text` entries bracket the drafts by order (10 and 30).
 */
import type { Page } from '@playwright/test'

export const PUBLISHED_ONE_TITLE = 'Published Ten'
export const PUBLISHED_TWO_TITLE = 'Published Thirty'
export const DRAFT_COVER_PATH = 'news/draft-cover.md'
export const DRAFT_COVER_TITLE = 'Draft Cover Title'
export const DRAFT_BROKEN_PATH = 'news/draft-broken.md'
/** The broken draft has no readable title, so the library shows its file name. */
export const DRAFT_BROKEN_LABEL = 'draft-broken.md'
export const DRAFT_UNORDERED_PATH = 'news/draft-unordered.md'
export const DRAFT_UNORDERED_TITLE = 'Draft Unordered Title'

const doc = (lines: string[]): string => lines.join('\n')

const PUBLISHED_ONE_DOC = doc([
  '---',
  'template: text',
  `title: ${PUBLISHED_ONE_TITLE}`,
  'order: 10',
  '---',
  'Body.',
])
const PUBLISHED_TWO_DOC = doc([
  '---',
  'template: text',
  `title: ${PUBLISHED_TWO_TITLE}`,
  'order: 30',
  '---',
  'Body.',
])

// No `image:` line on purpose: the pipeline only falls back to text when the declared image is
// unusable, and a declared but merely absent image file keeps `cover`. Without any declared image
// `cover` is downgraded to a text slide (same as FALLBACK_DOC in preview-feed.ts).
const DRAFT_COVER_DOC = doc([
  '---',
  'template: cover',
  `title: ${DRAFT_COVER_TITLE}`,
  'order: 20',
  '---',
  'Cover body.',
])

// An unterminated `---` block: the mirrored parseFrontmatter() rejects it.
const DRAFT_BROKEN_DOC = doc(['---', 'template: text', 'title: Never closed', 'Body.'])

const DRAFT_UNORDERED_DOC = doc([
  '---',
  'template: text',
  `title: ${DRAFT_UNORDERED_TITLE}`,
  '---',
  'No order declared.',
])

function feedBody() {
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'published-ten', file: 'published-ten.md' },
      { id: 'published-thirty', file: 'published-thirty.md' },
    ],
  }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'published-ten.md': { text: PUBLISHED_ONE_DOC },
      'published-thirty.md': { text: PUBLISHED_TWO_DOC },
    },
    drafts: [
      { path: DRAFT_COVER_PATH, text: DRAFT_COVER_DOC },
      { path: DRAFT_BROKEN_PATH, text: DRAFT_BROKEN_DOC },
      { path: DRAFT_UNORDERED_PATH, text: DRAFT_UNORDERED_DOC },
    ],
    images: [],
    findings: [],
  }
}

export async function stubDraftPreviewFeed(page: Page): Promise<void> {
  await page.route('**/__studio/fs/read*', async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
