/**
 * Test fixture builder for story 013's repository-level findings (D2, reused by D3/D4/D6): produces
 * an in-memory `ContentRepoRead`-shaped object — no filesystem, no network — that
 * `toRepositoryScan()` turns into a real `RepositoryScan`, exactly the way the real reader's output
 * would. Mirrors `studio/src/report/__fixtures__/news-tree.ts`'s pattern (an `EntryDescription` per
 * `news/index.json` row, assembled into a `---`-delimited frontmatter document the mirrored
 * `parseFrontmatter()` understands) but yields the wider `ContentRepoRead` shape this story's
 * `collectRepositoryFindings()` needs, rather than just the `{ index, documents }` pair
 * `resolveFeed()` takes.
 *
 * Kept minimal and extensible: `entries` covers what D2's duplicate-id/order-collision tests need,
 * and the `drafts`/`images`/`findings` options are there so D3 (drafts, orphan images) and D4
 * (missing documents, order mismatches) and D6 (unsafe names) can reuse this same builder rather
 * than writing their own.
 */
import type {
  ContentRepoDocument,
  ContentRepoDraft,
  ContentRepoImage,
  ContentRepoRead,
} from '../../../src/content-repo/read-content-repo'
import type { ReaderFinding } from '../../../src/content-repo/findings'

export interface RepositoryFixtureButtonDescription {
  label?: string
  url?: string
}

export interface RepositoryFixtureEntry {
  /** The index row's own `id`. Duplicate ids across entries are allowed on purpose — that is
   * exactly what the duplicate-id tests need to describe. */
  id: string
  /** Defaults to `${id}.md`; set explicitly when two rows share an `id` but need distinct files. */
  file?: string
  template?: string
  title?: string
  /** Defaults to an empty string body — a valid, if unremarkable, document. */
  body?: string
  image?: string
  /** The frontmatter `order:` value, as a string exactly as authored (the mirrored pipeline parses
   * it itself; this builder never pre-parses it). */
  order?: string
  /** The index row's own `order` field (real `news/index.json` rows carry one, see D4), as
   * distinct from the frontmatter `order` above — set only when a test needs the two to disagree.
   * Defaults to unset, i.e. the row carries no `order` at all. */
  indexOrder?: number | string
  visibleFrom?: string
  visibleUntil?: string
  buttons?: RepositoryFixtureButtonDescription[]
  /** Escape hatch for a document whose frontmatter/body this builder's scalar assembly cannot
   * express (e.g. no leading `---` at all). When set, every other document-shaping field is
   * ignored and this text is used verbatim as the document. */
  rawDocument?: string
}

export interface BuildRepositoryScanFixtureOptions {
  /** Defaults to `1`, any of the pipeline's own supported versions. */
  schemaVersion?: number
  /** Defaults to a placeholder path — `RepositoryScan` never touches the filesystem. */
  repoRoot?: string
  drafts?: readonly ContentRepoDraft[]
  images?: readonly ContentRepoImage[]
  /** Reader findings (story 010) to echo back, e.g. a `missing-document` finding D4 needs. */
  findings?: readonly ReaderFinding[]
}

function frontmatterLines(entry: RepositoryFixtureEntry): string[] {
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
function buildDocumentText(entry: RepositoryFixtureEntry): string {
  if (entry.rawDocument !== undefined) return entry.rawDocument
  const body = entry.body ?? ''
  return ['---', ...frontmatterLines(entry), '---', body].join('\n')
}

/**
 * Builds a `ContentRepoRead`-shaped object from entry descriptions, ready for `toRepositoryScan()`.
 */
export function buildRepositoryScanFixture(
  entries: readonly RepositoryFixtureEntry[],
  options: BuildRepositoryScanFixtureOptions = {},
): ContentRepoRead {
  const documents: Record<string, ContentRepoDocument> = {}
  const indexEntries = entries.map((entry) => {
    const file = entry.file ?? `${entry.id}.md`
    documents[file] = { text: buildDocumentText(entry) }
    return {
      id: entry.id,
      file,
      ...(entry.indexOrder !== undefined ? { order: entry.indexOrder } : {}),
    }
  })

  const schemaVersion = options.schemaVersion ?? 1

  return {
    repoRoot: options.repoRoot ?? '/fixture-repo',
    index: {
      text: JSON.stringify({ schemaVersion, entries: indexEntries }),
      value: { schemaVersion, entries: indexEntries },
      parsed: true,
    },
    documents,
    drafts: options.drafts ?? [],
    images: options.images ?? [],
    findings: options.findings ?? [],
  }
}
