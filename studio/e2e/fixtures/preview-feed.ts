/**
 * Story 018 D4: a stubbed `GET /__studio/fs/read` response for the slide preview specs, installed
 * via `page.route` before `goto('/')` (the same technique as `library-feed.ts`). The repository's
 * own `news/` has no entry that falls back to text, carries an off-allowlist button or is dropped,
 * so this feed supplies those with only the file bytes replaced.
 */
import type { Page } from '@playwright/test'

export const TEXT_TITLE = 'Plain Text Entry'
export const FALLBACK_TITLE = 'Cover Without Image'
export const BUTTONS_TITLE = 'Entry With Four Buttons'
export const DROPPED_FILE = 'dropped-entry.md'
export const KEPT_BUTTON_LABELS = ['Kept One', 'Kept Two', 'Kept Three'] as const
export const OFF_ALLOWLIST_LABEL = 'Off Allowlist Button'

const TEXT_DOC = [
  '---',
  'template: text',
  `title: ${TEXT_TITLE}`,
  'order: 10',
  '---',
  'Body.',
].join('\n')

// No `image:` line: `cover` needs one, so the launcher downgrades it to a text slide.
const FALLBACK_DOC = [
  '---',
  'template: cover',
  `title: ${FALLBACK_TITLE}`,
  'order: 20',
  '---',
  'Cover body.',
].join('\n')

const BUTTONS_DOC = [
  '---',
  'template: text',
  `title: ${BUTTONS_TITLE}`,
  'order: 30',
  'buttons:',
  `  - label: ${KEPT_BUTTON_LABELS[0]}`,
  '    url: https://github.com/Hantsch/one',
  `  - label: ${OFF_ALLOWLIST_LABEL}`,
  '    url: https://example.com/elsewhere',
  `  - label: ${KEPT_BUTTON_LABELS[1]}`,
  '    url: https://github.com/Hantsch/two',
  `  - label: ${KEPT_BUTTON_LABELS[2]}`,
  '    url: https://github.com/Hantsch/three',
  '---',
  'Buttons body.',
].join('\n')

// An unknown template with no title and no body: nothing to fall back to, so the entry is dropped.
const DROPPED_DOC = ['---', 'template: unknown-template', '---'].join('\n')

function feedBody() {
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'text-entry', file: 'text-entry.md' },
      { id: 'fallback-entry', file: 'fallback-entry.md' },
      { id: 'buttons-entry', file: 'buttons-entry.md' },
      { id: 'dropped-entry', file: DROPPED_FILE },
    ],
  }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'text-entry.md': { text: TEXT_DOC },
      'fallback-entry.md': { text: FALLBACK_DOC },
      'buttons-entry.md': { text: BUTTONS_DOC },
      [DROPPED_FILE]: { text: DROPPED_DOC },
    },
    drafts: [],
    images: [],
    findings: [],
  }
}

export async function stubPreviewFeed(page: Page): Promise<void> {
  await page.route('**/__studio/fs/read*', async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
