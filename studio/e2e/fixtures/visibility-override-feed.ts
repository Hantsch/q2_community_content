/**
 * Story 021 D2: a stubbed `GET /__studio/fs/read?type=news` response for the visibility override.
 * The repository's own `news/` has no scheduled or expired entry, so this fixture supplies one of
 * each (plus a scheduled entry that the pipeline delivers as `text`) with only the file bytes
 * replaced. Same shape and dates convention as `library-feed.ts`.
 */
import type { Page } from '@playwright/test'

const FAR_FUTURE = '2099-01-01T00:00:00Z'
const FAR_PAST = '2000-01-01T00:00:00Z'

export const PUBLISHED_TITLE = 'Published Entry'
export const SCHEDULED_TITLE = 'Scheduled Entry'
export const EXPIRED_TITLE = 'Expired Entry'
export const FALLBACK_TITLE = 'Scheduled Fallback'
export const SCHEDULED_VISIBLE_FROM = '2099-01-01'
export const EXPIRED_VISIBLE_UNTIL = '2000-01-01'

function doc(lines: readonly string[]): string {
  return ['---', ...lines, '---', 'Body.'].join('\n')
}

const DOCUMENTS = {
  'published-entry.md': doc(['template: text', `title: ${PUBLISHED_TITLE}`, 'order: 10']),
  'scheduled-entry.md': doc([
    'template: text',
    `title: ${SCHEDULED_TITLE}`,
    'order: 20',
    `visibleFrom: ${FAR_FUTURE}`,
  ]),
  'expired-entry.md': doc([
    'template: text',
    `title: ${EXPIRED_TITLE}`,
    'order: 30',
    `visibleUntil: ${FAR_PAST}`,
  ]),
  // `split` needs a declared image; without one the pipeline delivers it as `text`.
  'scheduled-fallback.md': doc([
    'template: split',
    `title: ${FALLBACK_TITLE}`,
    'order: 40',
    `visibleFrom: ${FAR_FUTURE}`,
  ]),
}

function feedBody() {
  const index = {
    schemaVersion: 1,
    entries: Object.keys(DOCUMENTS).map((file) => ({ id: file.replace(/\.md$/, ''), file })),
  }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: Object.fromEntries(
      Object.entries(DOCUMENTS).map(([file, text]) => [file, { text }]),
    ),
    drafts: [],
    images: [],
    findings: [],
  }
}

/** Call before `goto('/')`. */
export async function stubVisibilityOverrideFeed(page: Page): Promise<void> {
  await page.route('**/__studio/fs/read*', async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
