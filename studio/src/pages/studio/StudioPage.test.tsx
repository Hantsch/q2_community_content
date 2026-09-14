// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import type { ContentRepoDocument, ContentRepoRead } from '../../content-repo/read-content-repo'
import type { ContentTypeSource } from '../../content-types/descriptor'
import { createContentTypeRegistry } from '../../content-types/registry'
import { buildNewsTreeFixture, type EntryDescription } from '../../report/__fixtures__/news-tree'
import { StudioPage } from './StudioPage'

afterEach(cleanup)

/** A fixture `ContentTypeSource` for `news` — mirrors `use-news-library.test.ts`'s own
 * `readFromTree()`, so this test drives the real `useNewsLibrary()`/`buildPanelModel()` wiring
 * end to end rather than stubbing either. */
function newsSourceFor(entries: readonly EntryDescription[]): ContentTypeSource {
  const fixture = buildNewsTreeFixture(entries)
  const documents: Record<string, ContentRepoDocument> = {}
  for (const [file, text] of Object.entries(fixture.documents)) documents[file] = { text }

  const read: ContentRepoRead = {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents,
    drafts: [],
    images: [],
    findings: [],
  }

  return { read: () => Promise.resolve(read) }
}

test('renders the studio heading and its intro line', () => {
  render(<StudioPage />)

  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Q2 Content Studio')
  expect(
    screen.getByText('Author and validate community content for the Q2 Launcher.'),
  ).toBeDefined()
})

test('renders every registered content type in the navigation', () => {
  render(<StudioPage />)

  const registeredLabels = createContentTypeRegistry().map((descriptor) => descriptor.label)
  for (const label of registeredLabels) {
    expect(screen.getAllByText(label).length).toBeGreaterThan(0)
  }
})

// Story 016 D5: `news` is `descriptors[0]`, the default tab, so the studio starts on `news` and
// immediately drives `useNewsLibrary()` off the default (unbound) registry's `news` descriptor —
// no reader has been stubbed, so the bridge client's own `read()` runs for real against whatever
// dev-server route this test's jsdom environment has (none), settling on the `unreadable` state
// `LibraryStateNotice` renders. This proves the shell wires `news` to `LibraryView` in place of
// the deleted `NewsBridgeSummary`, without needing a fixture reader.
test('selecting news renders the library in place of the old bridge summary', async () => {
  render(<StudioPage />)

  expect(screen.getByLabelText('Library content').textContent).toMatch(/Reading news\/…/)

  await waitFor(() => {
    expect(screen.getByLabelText('Library content').textContent).toMatch(
      /news\/ could not be read\./,
    )
  })

  expect(screen.queryByText(/^Index: news\/index\.json$/)).toBeNull()
})

// Story 017 D5: the validation panel sits beside the library, driven by the same
// `useNewsLibrary()` read, and follows the current entry — selecting a row shows that entry's own
// declared/delivered facts and findings.
test('the validation panel renders alongside the library and follows the current entry', async () => {
  const source = newsSourceFor([
    // No `images` are ever returned by this fixture's read, so a declared `image` always triggers
    // `declared-image-missing` — an entry-level finding the panel must show once this row is
    // selected.
    {
      id: 'welcome',
      template: 'text',
      title: 'Welcome',
      body: 'Body',
      order: '10',
      image: 'cover.png',
    },
  ])

  render(<StudioPage source={source} />)

  const region = await screen.findByRole('region', { name: 'Entries' })
  const row = within(region).getByRole('listitem')
  const button = within(row).getByRole('button')

  // Before selection: nothing selected, no entry findings shown yet.
  expect(screen.getByText(/nothing selected/i)).toBeDefined()

  fireEvent.click(button)

  await waitFor(() => expect(button.getAttribute('aria-current')).toBe('true'))

  const entrySection = screen.getByRole('region', { name: 'Entry findings' })
  expect(within(entrySection).getByText('Welcome')).toBeDefined()
  expect(within(entrySection).getByText(/declared image "cover\.png" not found/i)).toBeDefined()
})

test('the re-check control is visible and re-reads through the news source', async () => {
  const source = newsSourceFor([{ id: 'welcome', template: 'text', title: 'Welcome', order: '10' }])
  let readCalls = 0
  const countingSource: ContentTypeSource = {
    read: (directory) => {
      readCalls += 1
      return source.read(directory)
    },
  }

  render(<StudioPage source={countingSource} />)

  await screen.findByRole('region', { name: 'Entries' })
  expect(readCalls).toBe(1)

  const recheckButton = screen.getByRole('button', { name: /re-check/i })
  fireEvent.click(recheckButton)

  await waitFor(() => expect(readCalls).toBe(2))
})
