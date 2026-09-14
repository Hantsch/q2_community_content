/**
 * Story 017 D5: a stubbed `GET /__studio/fs/read?type=news` response, installed via `page.route`
 * before `goto('/')` — the same convention `library-feed.ts` (story 016 D5) already established,
 * kept as its own module so the two stories' fixtures never drift into one another (see the story's
 * plan).
 *
 * The real `news/` tree cannot produce an entry-level finding (`declared-image-missing`) or a
 * repository-level finding (`order-mismatch`) on demand, so this fixture builds a small feed that
 * carries both, plus a second entry so "clicking a finding selects its entry" has somewhere else to
 * jump to. `ContentRepoRead` shape matches `library-feed.ts` exactly: `repoRoot`,
 * `index.{text,value,parsed}`, `documents`, `drafts`, `images`, `findings`.
 */
import type { Page } from '@playwright/test'

export const ENTRY_A_ID = 'entry-a'
export const ENTRY_A_TITLE = 'Entry A'
export const ENTRY_B_ID = 'entry-b'
export const ENTRY_B_TITLE = 'Entry B'

/** `entry-a` declares an `image` the feed's own `images: []` list never carries — triggers
 * `declared-image-missing` (`template-verdict.ts`), an entry-level finding naming the `image`
 * field. */
const ENTRY_A_DOC = [
  '---',
  'template: text',
  `title: ${ENTRY_A_TITLE}`,
  'order: 10',
  'image: cover.png',
  '---',
  'Entry A body.',
].join('\n')

const ENTRY_B_DOC = [
  '---',
  'template: text',
  `title: ${ENTRY_B_TITLE}`,
  'order: 20',
  '---',
  'Entry B body.',
].join('\n')

const NEWS_READ_ROUTE = '**/__studio/fs/read*'

function feedBody() {
  // The index row itself declares `order: 5` for entry-b, while entry-b's own document frontmatter
  // declares `order: 20` above — the mismatch `collectOrderMismatchFindings`
  // (`repository-findings.ts`) reports as a `warning`, attributed to `entry-b` via its own `id`
  // field. This is the one repository-level finding this fixture needs: it names a *different*
  // entry than whichever one the test currently has selected, so clicking it can be asserted to
  // move the current-entry selection.
  const index = {
    schemaVersion: 1,
    entries: [
      { id: ENTRY_A_ID, file: 'entry-a.md' },
      { id: ENTRY_B_ID, file: 'entry-b.md', order: 5 },
    ],
  }

  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(index), value: index, parsed: true },
    documents: {
      'entry-a.md': { text: ENTRY_A_DOC },
      'entry-b.md': { text: ENTRY_B_DOC },
    },
    drafts: [],
    images: [],
    findings: [],
  }
}

/** Installs the two-entry feed described above. Call before `goto('/')` — `news` is
 * `descriptors[0]`, the default tab, so no navigation is needed after the route is armed. */
export async function stubValidationPanelFeed(page: Page): Promise<void> {
  await page.route(NEWS_READ_ROUTE, async (route) => {
    await route.fulfill({ json: feedBody() })
  })
}
