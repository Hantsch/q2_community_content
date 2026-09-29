/**
 * Story 023 D4: a stubbed `GET /__studio/fs/read?type=news` response for the body editor spec,
 * installed with `page.route` before `goto('/')` (same approach as `editor-feed.ts`). One `text`
 * entry with a one-line body and one `cover` entry with an image.
 *
 * D4 adds three entries for the overflow indicator: a short body that fits at every width, a long
 * one that is cut at every width, and a `cover` body at the boundary - its text column is 45% of
 * the slide capped at 560px, so it is narrower at 940 than at 1920. That body was calibrated in
 * Chromium against the real frame: five lines in the 409px column at 940 (cut by the four-line
 * clamp), four in the 560px column at 1280 and 1920 (fits).
 */
import type { Page } from '@playwright/test'

export const TEXT_TITLE = 'Body Entry'
export const COVER_TITLE = 'Cover Piece'
export const TEXT_BODY = 'Plain body.'

const TEXT_DOC = [
  '---',
  'template: text',
  `title: ${TEXT_TITLE}`,
  'order: 10',
  '---',
  TEXT_BODY,
].join('\n')

const COVER_DOC = [
  '---',
  'template: cover',
  `title: ${COVER_TITLE}`,
  'order: 20',
  'image: img/cover.png',
  '---',
  'Cover body.',
].join('\n')

// No title: the launcher drops an entry only when it has neither a title nor a body, so this is the
// entry whose emptied body makes it disappear.
export const UNTITLED_FILE = 'untitled-entry.md'
const UNTITLED_DOC = ['---', 'template: text', 'order: 30', '---', 'Only body.'].join('\n')

export const SENTENCE = 'The quick brown fox jumps over the lazy dog near the quiet river bank. '

export const SHORT_TITLE = 'Short Fit'
export const SHORT_BODY = 'Short body.'
export const LONG_TITLE = 'Long Overflow'
export const LONG_BODY = SENTENCE.repeat(17).trim()
export const BOUNDARY_TITLE = 'Cover Boundary'
export const BOUNDARY_BODY = `${SENTENCE.repeat(3)}The quick brown fox jumps over the lazy dog.`

function overflowDoc(template: string, title: string, order: number, body: string): string {
  const image = template === 'cover' ? ['image: img/cover.png'] : []
  return [
    '---',
    `template: ${template}`,
    `title: ${title}`,
    `order: ${order}`,
    ...image,
    '---',
    body,
  ].join('\n')
}

function feedBody() {
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'body-entry', file: 'body-entry.md' },
      { id: 'cover-entry', file: 'cover-entry.md' },
      { id: 'untitled-entry', file: UNTITLED_FILE },
      { id: 'short-entry', file: 'short-entry.md' },
      { id: 'long-entry', file: 'long-entry.md' },
      { id: 'boundary-entry', file: 'boundary-entry.md' },
    ],
  }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'body-entry.md': { text: TEXT_DOC },
      'cover-entry.md': { text: COVER_DOC },
      [UNTITLED_FILE]: { text: UNTITLED_DOC },
      'short-entry.md': { text: overflowDoc('text', SHORT_TITLE, 40, SHORT_BODY) },
      'long-entry.md': { text: overflowDoc('text', LONG_TITLE, 50, LONG_BODY) },
      'boundary-entry.md': { text: overflowDoc('cover', BOUNDARY_TITLE, 60, BOUNDARY_BODY) },
    },
    drafts: [],
    images: [{ name: 'cover.png', path: 'news/img/cover.png', bytes: 1 }],
    findings: [],
  }
}

export async function stubBodyEditorFeed(page: Page): Promise<void> {
  await page.route('**/__studio/fs/read*', async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
