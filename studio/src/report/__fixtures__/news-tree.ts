/**
 * Test fixture builder for story 011's report tests: produces the in-memory `{ index, documents }`
 * shape `resolveFeed()` takes (and story 010's reader will hand over for real) - no filesystem, no
 * network. Mirrors the pattern of `studio/src/mirror/__fixtures__/build-mirror-fixture.ts`: a small
 * builder over plain data, kept to what D1's own tests and D2-D5 will plausibly need.
 *
 * Each `EntryDescription` describes one `news/index.json` row plus its document's frontmatter; the
 * builder assembles the `---\nkey: value\n---\nbody` block the mirrored `parseFrontmatter()`
 * understands (see `studio/src/launcher-core/src/main/modules/home/news/frontmatter.ts`).
 */

export interface EntryButtonDescription {
  label?: string
  url?: string
}

export interface EntryDescription {
  /** The index row's own `id`. Also used as the default `file` (`${id}.md`) when `file` is omitted. */
  id: string
  file?: string
  template?: string
  title?: string
  /** Defaults to an empty string body - a valid, if unremarkable, document. */
  body?: string
  image?: string
  order?: string
  visibleFrom?: string
  visibleUntil?: string
  buttons?: EntryButtonDescription[]
  /** Escape hatch for the handful of cases a test wants a document whose frontmatter/body the
   * builder's own scalar assembly cannot express (e.g. no leading `---` at all, to exercise the
   * "frontmatter could not be read" drop). When set, every other document-shaping field above is
   * ignored and this text is used verbatim as the document. */
  rawDocument?: string
}

export interface NewsTreeFixture {
  /** The already-`JSON.parse`d shape `resolveFeed()` expects for `news/index.json`. */
  index: { schemaVersion: number; entries: { id: string; file: string }[] }
  /** Raw `.md` text keyed by file name, exactly `resolveFeed()`'s `documents` input. */
  documents: Record<string, string>
}

function frontmatterLines(entry: EntryDescription): string[] {
  const lines: string[] = []
  if (entry.template !== undefined) lines.push(`template: ${entry.template}`)
  if (entry.title !== undefined) lines.push(`title: ${entry.title}`)
  if (entry.image !== undefined) lines.push(`image: ${entry.image}`)
  if (entry.order !== undefined) lines.push(`order: ${entry.order}`)
  if (entry.visibleFrom !== undefined) lines.push(`visibleFrom: ${entry.visibleFrom}`)
  if (entry.visibleUntil !== undefined) lines.push(`visibleUntil: ${entry.visibleUntil}`)
  if (entry.buttons !== undefined) {
    lines.push('buttons:')
    for (const button of entry.buttons) {
      if (button.label !== undefined) lines.push(`  - label: ${button.label}`)
      if (button.url !== undefined) lines.push(`    url: ${button.url}`)
    }
  }
  return lines
}

/** Assembles one document's markdown text: a `---`-delimited frontmatter block, then the body. */
function buildDocument(entry: EntryDescription): string {
  if (entry.rawDocument !== undefined) return entry.rawDocument
  const body = entry.body ?? ''
  return ['---', ...frontmatterLines(entry), '---', body].join('\n')
}

/**
 * Builds a `{ index, documents }` tree from entry descriptions. `schemaVersion` defaults to `1`
 * (any of the pipeline's own supported versions); pass a different one to exercise the
 * schema-ahead/missing-schema-version paths.
 */
export function buildNewsTreeFixture(
  entries: readonly EntryDescription[],
  schemaVersion = 1,
): NewsTreeFixture {
  const documents: Record<string, string> = {}
  const indexEntries = entries.map((entry) => {
    const file = entry.file ?? `${entry.id}.md`
    documents[file] = buildDocument(entry)
    return { id: entry.id, file }
  })

  return { index: { schemaVersion, entries: indexEntries }, documents }
}
