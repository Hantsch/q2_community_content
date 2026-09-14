/**
 * Story 017 D2: the validation panel's own view model.
 *
 * Pattern mirrored from `format-text.ts` (see its header): pure, snapshot-in/facts-out, no
 * `node:*` import, no JSX/DOM. This module derives nothing the report/repository findings did not
 * already decide - it only picks the selected entry's own facts out of `ContentReport`, keeps
 * story 013's repository-level findings in their own list (never merged with the entry's), and
 * reshapes both `Finding` and `RepositoryFinding` into one `FindingView` shape a later deliverable
 * (D3) can render without reaching back into either source type.
 *
 * Two derivations are worth calling out:
 *
 * - **`field`** (AC2, AC4's sibling rule): a small `kind -> field` table, not a cross-reference
 *   into `EntryVerdict.buttons`. All three per-button pipeline kinds
 *   (`button-host-not-allowed`/`button-invalid`/`button-cap`, see `button-verdicts.ts`) mean the
 *   same field regardless of *which* button they are about - `'url'` - so naming the offending
 *   button index would answer a question AC2 never asks. `'declared-image-missing'`
 *   (`template-verdict.ts`) is the one other kind with a fixed field, `'image'`. Every other kind
 *   carries no derivable field, so `field` is left absent rather than guessed.
 * - **`status`** (story 016's `LibraryStatus` vocabulary, reused per the story's Decisions): the
 *   same `dropped > visibility` precedence `library-model.ts`'s private `buildEntryRow()` encodes,
 *   reproduced here rather than imported (those helpers are not exported, and this deliverable may
 *   not touch story 016's files). The `draft` status never arises from this module's input - a
 *   draft is never in `ContentReport.entries` to begin with (`library-model.ts`'s own header) - so
 *   only the `dropped`/`published`/`scheduled`/`expired` branches are reachable here, but the type
 *   stays `LibraryStatus` so the two surfaces can never drift into two different words for the same
 *   thing.
 */
import type { LibraryStatus } from '../library/library-types'
import type {
  ContentReport,
  DeclaredEntry,
  DeliveredEntry,
  Finding,
  FindingSeverity,
  VisibilityVerdict,
} from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'

/** AC4: every finding view names a file; this is what a finding with no `file` of its own falls
 * back to - `news/index.json` is the one document every finding in this module ultimately traces
 * back to, entry-level or repository-level. */
const FALLBACK_FILE = 'news/index.json'

/** AC2/AC4's field-to-fix table. See the file header for why this is a flat `kind -> field` map
 * rather than a per-button lookup. Kept as a `Record` over a small closed set of kinds so an
 * unlisted kind reads `undefined` rather than needing an explicit `else` branch at each call site. */
const FIELD_BY_FINDING_KIND: Readonly<Record<string, string>> = {
  'declared-image-missing': 'image',
  'button-host-not-allowed': 'url',
  'button-invalid': 'url',
  'button-cap': 'url',
}

export interface FindingView {
  readonly severity: FindingSeverity
  /** The `Finding`/`RepositoryFinding` `kind`, verbatim - the rule that produced this finding. */
  readonly rule: string
  readonly message: string
  /** Never empty; falls back to {@link FALLBACK_FILE} when the underlying finding names none. */
  readonly file: string
  /** The field an author would fix, where the `kind` makes that derivable (see the file header);
   * absent otherwise. */
  readonly field?: string
  /** Present when this finding is attributable to one entry, so a later deliverable can wire
   * "click jumps to this entry". Carries a `Finding`'s own `entryId` verbatim, or a
   * `RepositoryFinding`'s `id` (the same attribution `repository-findings.ts`'s own findings use
   * it for, e.g. `duplicate-id`/`order-collision`) when present. */
  readonly entryId?: string
}

/** One selected entry's panel-facing facts: its declared and delivered form, its visibility, the
 * reused `LibraryStatus`, and only this entry's own findings (never the repository's). */
export interface PanelEntryView {
  readonly id: string
  readonly file: string
  readonly declared: DeclaredEntry
  readonly delivered: DeliveredEntry
  readonly visibility: VisibilityVerdict
  readonly status: LibraryStatus
  readonly findings: readonly FindingView[]
}

/**
 * The whole panel for one selection. `entry` is `undefined` when nothing is selected
 * (`selectedEntryId === null`) or the id names no row in `report.entries` - both are "nothing
 * valid to show" as far as this model is concerned, and are tested explicitly as one case rather
 * than two, since a stale id after an entry disappears must degrade the same way an empty
 * selection does.
 */
export interface ValidationPanelModel {
  readonly entry: PanelEntryView | undefined
  readonly repositoryFindings: readonly FindingView[]
  /** `true` only when the selected entry's own findings (an empty list when nothing is selected -
   * see `entry`'s doc) AND `repositoryFindings` are both empty. A clean entry sitting beside a
   * repository-level finding is not all-clear, and neither is a dirty entry in an otherwise
   * findings-free repository. */
  readonly allClear: boolean
}

function fileOf(file: string | undefined): string {
  return file && file.length > 0 ? file : FALLBACK_FILE
}

function toFindingView(finding: Finding): FindingView {
  return {
    severity: finding.severity,
    rule: finding.kind,
    message: finding.message,
    file: fileOf(finding.file),
    field: FIELD_BY_FINDING_KIND[finding.kind],
    entryId: finding.entryId,
  }
}

function toRepositoryFindingView(finding: RepositoryFinding): FindingView {
  return {
    severity: finding.severity,
    rule: finding.kind,
    message: finding.message,
    file: fileOf(finding.file),
    field: FIELD_BY_FINDING_KIND[finding.kind],
    entryId: finding.id,
  }
}

/** Story 016's `deliveredStatus()`, reproduced rather than imported - see the file header. Same
 * rule, same residual (`published` unless a bound says otherwise). */
function visibilityStatus(visibility: VisibilityVerdict): LibraryStatus {
  if (visibility.state === 'scheduled') return 'scheduled'
  if (visibility.state === 'expired') return 'expired'
  return 'published'
}

/** Story 016's `dropped > visibility` precedence (`library-model.ts`'s `buildEntryRow()`),
 * reproduced with the same behaviour - see the file header for why it is not imported. */
function deriveStatus(delivered: DeliveredEntry, visibility: VisibilityVerdict): LibraryStatus {
  return delivered === 'dropped' ? 'dropped' : visibilityStatus(visibility)
}

function toPanelEntryView(input: {
  readonly id: string
  readonly file: string
  readonly declared: DeclaredEntry
  readonly delivered: DeliveredEntry
  readonly visibility: VisibilityVerdict
  readonly findings: readonly Finding[]
}): PanelEntryView {
  return {
    id: input.id,
    file: input.file,
    declared: input.declared,
    delivered: input.delivered,
    visibility: input.visibility,
    status: deriveStatus(input.delivered, input.visibility),
    findings: input.findings.map(toFindingView),
  }
}

/**
 * Builds the validation panel's view model for one selection. See the file header and the
 * interfaces above for what each field means and why.
 */
export function buildPanelModel(input: {
  readonly report: ContentReport
  readonly repositoryFindings: readonly RepositoryFinding[]
  readonly selectedEntryId: string | null
}): ValidationPanelModel {
  const verdict =
    input.selectedEntryId === null
      ? undefined
      : input.report.entries.find((candidate) => candidate.id === input.selectedEntryId)

  const entry = verdict === undefined ? undefined : toPanelEntryView(verdict)
  const repositoryFindings = input.repositoryFindings.map(toRepositoryFindingView)

  return {
    entry,
    repositoryFindings,
    allClear: (entry?.findings.length ?? 0) === 0 && repositoryFindings.length === 0,
  }
}
