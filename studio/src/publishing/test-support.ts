import type { ContentRepoRead } from '../content-repo/read-content-repo'
import { buildNewsTreeFixture, type EntryDescription } from '../report/__fixtures__/news-tree'

export function makeRead(entries: readonly EntryDescription[]): ContentRepoRead {
  const fixture = buildNewsTreeFixture(entries)
  return {
    repoRoot: '/fixture',
    index: { text: JSON.stringify(fixture.index), value: fixture.index, parsed: true },
    documents: Object.fromEntries(
      Object.entries(fixture.documents).map(([file, text]) => [file, { text }]),
    ),
    drafts: [],
    images: [],
    findings: [],
  }
}
