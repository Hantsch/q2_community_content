/**
 * Story 016 D1: fuses the three sources that have no status field between them - story 011's
 * `EntryVerdict.delivered`, its `EntryVerdict.visibility`, and story 010's `ContentRepoRead.drafts`
 * - into one `LibraryStatus` per row. Pure, data-in/data-out, and it never throws: its caller (D4's
 * hook) feeds it whatever the bridge returned, so invalid input has to become the `unreadable`
 * state rather than an exception.
 *
 * Three rules are load-bearing and story 017's detail panel has to agree with all three:
 *
 * 1. **Precedence is dropped > draft > visibility** (Decisions (Sprint)). A dropped entry is the
 *    one an author has to act on first, so `delivered === 'dropped'` wins outright; a draft is
 *    never in `index.json` and therefore never reaches the report at all, which makes its status
 *    unconditional; everything else takes its state from the visibility verdict.
 * 2. **Delivered order comes off the pipeline, not off a sort of ours.** Rows the launcher
 *    actually delivers are ordered by `delivered.position` - `filterAndSortSlides()`'s own output
 *    index - never by re-sorting `order` here, the same discipline `visibility-order.ts` and
 *    `repository-findings.ts` already follow. Rows with no delivered position keep the index's own
 *    order behind them.
 * 3. **`unreadable` is the reader's own signal**, reused rather than re-invented: an index that did
 *    not parse, or a directory the reader could not walk. Everything else the reader reports is a
 *    problem with one file, not with forming the list.
 */
import { parseFrontmatter } from '../contract/launcher-contract'
import type { ContentRepoDraft, ContentRepoRead } from '../content-repo/read-content-repo'
import type { ReaderFinding } from '../content-repo/findings'
import type { ContentReport, EntryVerdict, VisibilityVerdict } from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'
import type { LibraryModel, LibraryRow, LibraryStatus } from './library-types'

/**
 * Everything the library is derived from: one read of the working tree (story 010), the
 * declared-vs-delivered report over that same read (story 011) and the repository-level findings
 * over it (story 013). All three are declared as possibly absent because D4 builds them from a
 * bridge response, and "the response was not what we expected" is an `unreadable` model here, not
 * a caller's `try`/`catch`.
 */
export interface BuildLibraryModelInput {
  read: ContentRepoRead | undefined
  report: ContentReport | undefined
  repositoryFindings: readonly RepositoryFinding[] | undefined
}

/**
 * The reader finding codes that mean "no reliable list can be formed", as opposed to "one file has
 * a problem". Taken verbatim from `read-content-repo.ts`'s own vocabulary: the three index codes
 * (the index is the feed - without it there is nothing to list) and the directory walk failing (a
 * drafts list that silently lost a subtree is worse than no list). `missing-document`,
 * `unreadable-document`, `unsafe-document-path` and `unreadable-draft` are deliberately absent:
 * each concerns a single file, which the report already turns into that row's own dropped verdict.
 */
const UNREADABLE_READER_CODES: ReadonlySet<string> = new Set([
  'index-missing',
  'index-unreadable',
  'index-unparseable',
  'unreadable-directory',
])

function emptyModel(
  state: LibraryModel['state'],
  unreadableFindings: readonly ReaderFinding[],
  repositoryFindings: readonly RepositoryFinding[],
): LibraryModel {
  return { state, entries: [], drafts: [], unreadableFindings, repositoryFindings }
}

/** The pipeline's "no usable order value" sentinel (`feed-pipeline.ts`'s `parseOrder()` fallback)
 * is not a number any author wrote, so it is no order at all as far as a row is concerned. */
function usableOrder(order: number): number | undefined {
  return order === Number.MAX_SAFE_INTEGER ? undefined : order
}

/** AC4's reason text: the report has already classified every drop (`classify-warning.ts`), so the
 * first `error` finding on the verdict is the sentence to show - never a string invented here. */
function dropReasonOf(verdict: EntryVerdict): string | undefined {
  return verdict.findings.find((finding) => finding.severity === 'error')?.message
}

/**
 * Rule 1's second half, for an entry that was *not* dropped. `published` is the residual: a row is
 * only `scheduled` or `expired` when the report says a bound put it outside the visibility window.
 * That also absorbs `not-applicable`, which `visibility-order.ts` only ever falls back to when no
 * bound explains the filtering - there is nothing safe to claim there either, and this union has no
 * state for it.
 */
function deliveredStatus(visibility: VisibilityVerdict): LibraryStatus {
  if (visibility.state === 'scheduled') return 'scheduled'
  if (visibility.state === 'expired') return 'expired'
  return 'published'
}

/** AC3: the one date that matters for this state, and only for the two states it means something
 * for. Which bound it is follows from the status, so the row needs no second field. */
function visibilityDateOf(visibility: VisibilityVerdict): string | undefined {
  if (visibility.state === 'scheduled') return visibility.visibleFrom
  if (visibility.state === 'expired') return visibility.visibleUntil
  return undefined
}

function buildEntryRow(verdict: EntryVerdict): LibraryRow {
  const { id, file, declared, delivered } = verdict

  // Rule 1: dropped wins over everything. Nothing was delivered, so there is no delivered
  // template, no order and no visibility date to carry - only the reason.
  if (delivered === 'dropped') {
    return {
      id,
      file,
      title: declared.title,
      declaredTemplate: declared.template,
      templatesDiffer: false,
      status: 'dropped',
      dropReason: dropReasonOf(verdict),
      image: declared.image,
      verdict,
    }
  }

  return {
    id,
    file,
    title: declared.title,
    declaredTemplate: declared.template,
    deliveredTemplate: delivered.template,
    templatesDiffer: declared.template !== delivered.template,
    order: usableOrder(delivered.order),
    status: deliveredStatus(verdict.visibility),
    visibilityDate: visibilityDateOf(verdict.visibility),
    image: declared.image,
    verdict,
  }
}

/**
 * A draft never reaches the report, so its declared side is read here with the same mirrored
 * `parseFrontmatter()` the report uses - never a second studio parser (story 011's Decisions).
 * Unparseable frontmatter is not an error for a draft: it is a file someone is still writing, and
 * it still belongs in the list, just without a title.
 */
function buildDraftRow(draft: ContentRepoDraft): LibraryRow {
  const data = parseFrontmatter(draft.text)?.data
  return {
    id: draft.path,
    file: draft.path,
    title: data?.title,
    declaredTemplate: data?.template,
    templatesDiffer: false,
    status: 'draft',
    image: data?.image,
  }
}

/**
 * Rule 2: the launcher's own delivered order first, then everything it gives no position to.
 * `report.entries` is already in `news/index.json`'s own order, so the second group needs no sort
 * of its own.
 */
function orderEntryRows(entries: readonly EntryVerdict[]): LibraryRow[] {
  const delivered: { row: LibraryRow; position: number }[] = []
  const undelivered: LibraryRow[] = []

  for (const verdict of entries) {
    const row = buildEntryRow(verdict)
    const position = verdict.delivered === 'dropped' ? undefined : verdict.delivered.position
    if (position === undefined) undelivered.push(row)
    else delivered.push({ row, position })
  }

  delivered.sort((a, b) => a.position - b.position)
  return [...delivered.map((placed) => placed.row), ...undelivered]
}

function build({ read, report, repositoryFindings }: BuildLibraryModelInput): LibraryModel {
  const findings = repositoryFindings ?? []

  // Rule 3. No `read` and no `report` are the same thing as a failed read as far as the view is
  // concerned: there is nothing to list and no honest way to say the directory is empty.
  if (!read || !report) return emptyModel('unreadable', [], findings)

  const blocking = read.findings.filter((finding) => UNREADABLE_READER_CODES.has(finding.code))
  if (blocking.length > 0 || !read.index.parsed) return emptyModel('unreadable', blocking, findings)

  const entries = orderEntryRows(report.entries)
  const drafts = read.drafts.map(buildDraftRow)
  const state = entries.length === 0 && drafts.length === 0 ? 'empty' : 'ready'

  return { state, entries, drafts, unreadableFindings: [], repositoryFindings: findings }
}

/**
 * Builds the library model for one read of the working tree. See the file header for the three
 * rules it encodes. The `try` is the "never throws" guarantee, not a substitute for the checks
 * above: the input crosses a JSON boundary in D4, so a shape nobody anticipated must still come
 * back as `unreadable` rather than take the view down.
 */
export function buildLibraryModel(input: BuildLibraryModelInput): LibraryModel {
  try {
    return build(input)
  } catch {
    return emptyModel('unreadable', [], [])
  }
}
