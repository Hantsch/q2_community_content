/**
 * Story 016 D5: a stubbed `GET /__studio/fs/read?type=news` response, installed via `page.route`
 * before `goto('/')`. The repository's own `news/` (see `file-bridge.spec.ts`) holds only four
 * plain published entries, so the states `library-view.spec.ts` needs to prove — scheduled,
 * expired, dropped, a template mismatch, drafts, empty and unreadable — have no real-surface
 * trigger; this fixture gives the real app, the real bridge client, the real model
 * (`buildLibraryModel`) and the real rendering something that exercises all of them, with only the
 * file bytes replaced (Decisions (Sprint)).
 *
 * Frontmatter shape mirrors `studio/src/report/__fixtures__/news-tree.ts` and
 * `studio/tests/fixtures/content-repo/ok/news/`: a `---`-delimited block the mirrored
 * `parseFrontmatter()` reads, then the body. `order` lives in the document's frontmatter, not on
 * the index row — the index row only ever carries `id` and `file` (see the real
 * `news/index.json` and `build-news-report.ts`'s `order: data.order`).
 */
import type { Page } from '@playwright/test'

/** Well outside any plausible test-run date, so "scheduled"/"expired" never depend on when this
 * suite actually runs. */
const FAR_FUTURE = '2099-01-01T00:00:00Z'
const FAR_PAST = '2000-01-01T00:00:00Z'

export const PUBLISHED_TITLE = 'Published Entry'
export const SCHEDULED_TITLE = 'Scheduled Entry'
export const EXPIRED_TITLE = 'Expired Entry'
export const DROPPED_TITLE_FILE = 'dropped-entry.md'
export const MISMATCH_TITLE = 'Mismatch Entry'
export const DRAFT_ONE_TITLE = 'Draft One'
export const DRAFT_TWO_TITLE = 'Draft Two'

const PUBLISHED_DOC = [
  '---',
  'template: text',
  `title: ${PUBLISHED_TITLE}`,
  'order: 10',
  '---',
  'Published body.',
].join('\n')

const SCHEDULED_DOC = [
  '---',
  'template: text',
  `title: ${SCHEDULED_TITLE}`,
  'order: 20',
  `visibleFrom: ${FAR_FUTURE}`,
  '---',
  'Scheduled body.',
].join('\n')

const EXPIRED_DOC = [
  '---',
  'template: text',
  `title: ${EXPIRED_TITLE}`,
  'order: 30',
  `visibleUntil: ${FAR_PAST}`,
  '---',
  'Expired body.',
].join('\n')

// Deliberately no template and no title: `resolveTemplate()` has nothing to fall back to a text
// slide with, so the pipeline drops the entry (mirrors `library-model.test.ts`'s own dropped
// case).
const DROPPED_DOC = ['---', '---', 'Body without a title.'].join('\n')

// `split` needs a declared image; without one the pipeline falls back to `text` (AC5).
const MISMATCH_DOC = [
  '---',
  'template: split',
  `title: ${MISMATCH_TITLE}`,
  'order: 50',
  '---',
  'Mismatch body.',
].join('\n')

const DRAFT_ONE_DOC = ['---', `title: ${DRAFT_ONE_TITLE}`, '---', 'Not in the index yet.'].join(
  '\n',
)
const DRAFT_TWO_DOC = [
  '---',
  `title: ${DRAFT_TWO_TITLE}`,
  '---',
  'Also not in the index yet.',
].join('\n')

/** The mixed-state feed: one of each published/scheduled/expired/dropped/mismatch entry, plus two
 * drafts. Matches `ContentRepoRead` (`BridgeReadResponse`) exactly — `repoRoot`, `index.{text,
 * value, parsed}`, `documents`, `drafts`, `images`, `findings`. */
function mixedFeedBody() {
  const index = {
    schemaVersion: 1,
    entries: [
      { id: 'published-entry', file: 'published-entry.md' },
      { id: 'scheduled-entry', file: 'scheduled-entry.md' },
      { id: 'expired-entry', file: 'expired-entry.md' },
      { id: 'dropped-entry', file: DROPPED_TITLE_FILE },
      { id: 'mismatch-entry', file: 'mismatch-entry.md' },
    ],
  }

  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'published-entry.md': { text: PUBLISHED_DOC },
      'scheduled-entry.md': { text: SCHEDULED_DOC },
      'expired-entry.md': { text: EXPIRED_DOC },
      [DROPPED_TITLE_FILE]: { text: DROPPED_DOC },
      'mismatch-entry.md': { text: MISMATCH_DOC },
    },
    drafts: [
      { path: 'news/draft-one.md', text: DRAFT_ONE_DOC },
      { path: 'news/draft-two.md', text: DRAFT_TWO_DOC },
    ],
    images: [],
    findings: [],
  }
}

function emptyFeedBody() {
  const index = { schemaVersion: 1, entries: [] }
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {},
    drafts: [],
    images: [],
    findings: [],
  }
}

const NEWS_READ_ROUTE = '**/__studio/fs/read*'

/** Installs the mixed-state feed. Call before `goto('/')` — `news` is `descriptors[0]`, the
 * default tab, so no navigation is needed after the route is armed. */
export async function stubLibraryFeed(page: Page): Promise<void> {
  await page.route(NEWS_READ_ROUTE, async (route) => {
    await route.fulfill({ json: mixedFeedBody() })
  })
}

/** Installs a feed with no entries and no drafts — AC7's "empty" state. */
export async function stubEmptyLibraryFeed(page: Page): Promise<void> {
  await page.route(NEWS_READ_ROUTE, async (route) => {
    await route.fulfill({ json: emptyFeedBody() })
  })
}

/** Installs a failing bridge response — AC7's "unreadable" state. `createBridgeClient()` turns any
 * non-2xx response into a well-formed, empty read with `index.parsed: false`, which
 * `buildLibraryModel` already treats as unreadable regardless of the finding code. */
export async function stubUnreadableLibraryFeed(page: Page): Promise<void> {
  await page.route(NEWS_READ_ROUTE, async (route) => {
    await route.fulfill({ status: 500, json: { error: 'news/ could not be read from disk.' } })
  })
}
