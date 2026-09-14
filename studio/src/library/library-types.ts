/**
 * Story 016 D1: the library's own model - one flat row per thing an author can see in `news/`,
 * plus the three non-list states the view has to tell apart.
 *
 * Types only, mirroring `report/report-types.ts`: the derivation lives in `library-model.ts`. The
 * point of this shape is that the view (D3) and story 017's detail panel read *these* fields and
 * never reach back into `EntryVerdict` internals to re-derive a status - there is exactly one place
 * where `delivered`, `visibility` and the reader's drafts are fused, and it is `library-model.ts`.
 */
import type { ReaderFinding } from '../content-repo/findings'
import type { EntryVerdict } from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'

/**
 * The five states an author sees. Derived, never read off a field: `report-types.ts` has no single
 * status (Decisions (Sprint)). Precedence is **dropped > draft > visibility**, see
 * `deriveStatus()`.
 */
export type LibraryStatus = 'published' | 'scheduled' | 'expired' | 'dropped' | 'draft'

/**
 * AC7's three distinct answers to "why is there no list": `ready` (there is one), `empty` (the
 * repository was read and genuinely holds nothing) and `unreadable` (it could not be read, so any
 * list would be a guess). The view must never collapse the last two into one message.
 */
export type LibraryState = 'ready' | 'empty' | 'unreadable'

/** One row of the library - an `news/index.json` entry or a draft, already reduced to what a row
 * renders. Every field here is UI-facing on purpose; `verdict` is the escape hatch for detail
 * views, not a licence to re-derive anything this row already answers. */
export interface LibraryRow {
  /** Stable selection key (AC6). The index row's own `id` for an entry, the repository-relative
   * path for a draft - a draft is not in `index.json` and therefore has no id. */
  readonly id: string
  /** The index row's `file` value for an entry, the repository-relative path for a draft. */
  readonly file: string
  /** The declared `title`; absent when the document declares none (which, for an entry, is
   * usually also why it was dropped). */
  readonly title?: string
  /** The `template` the author declared; absent when the document declares none. */
  readonly declaredTemplate?: string
  /** The template the pipeline actually resolved. Absent for a dropped entry (nothing was
   * delivered) and for a draft (the launcher never sees it). */
  readonly deliveredTemplate?: string
  /** AC5's "shows both": true only when there is a delivered template and it is not the declared
   * one. Uses the same comparison `ReportSummary.fallenBack` does, so a row flagged here is
   * exactly a row the report counts as fallen back - including the "declared nothing, got `text`"
   * case, which is equally worth showing. Always false for dropped entries and drafts. */
  readonly templatesDiffer: boolean
  /** The order value the pipeline resolved for this entry. Absent for a dropped entry, for a draft
   * (neither has a delivered position), and when the document declares no usable order - the
   * pipeline's `Number.MAX_SAFE_INTEGER` sentinel is not an order an author wrote. */
  readonly order?: number
  readonly status: LibraryStatus
  /** AC3: `visibleFrom` when `status === 'scheduled'`, `visibleUntil` when `'expired'`, absent
   * otherwise. Which of the two it is follows from `status`, so it needs no second field. */
  readonly visibilityDate?: string
  /** AC4: the reason the report already classified for the drop, verbatim. Set only when
   * `status === 'dropped'`. */
  readonly dropReason?: string
  /** The declared `image` reference, exactly as authored (e.g. `img/picture.png`). Resolving it to
   * a bridge URL is D4's job; this model does no IO. */
  readonly image?: string
  /** The full report verdict this row was derived from, for detail views. Absent for drafts -
   * a draft never reaches the report at all. */
  readonly verdict?: EntryVerdict
}

/** The whole library for one read of the working tree. */
export interface LibraryModel {
  readonly state: LibraryState
  /**
   * Every `news/index.json` row, delivered ones first in the launcher's own delivered order, then
   * the rows the launcher gives no position at all (scheduled, expired, dropped) in the index's
   * own order. Named `entries` rather than `published` because it deliberately carries the
   * non-published statuses too - they belong beside the feed, not in the drafts section.
   */
  readonly entries: readonly LibraryRow[]
  /** AC2: `ContentRepoRead.drafts`, always `status: 'draft'` and never with an order value. */
  readonly drafts: readonly LibraryRow[]
  /** Non-empty only when `state === 'unreadable'`: the reader's own findings that prevented a
   * reliable list, so the view can say what went wrong rather than just that something did. */
  readonly unreadableFindings: readonly ReaderFinding[]
  /** Story 013's repository-level findings, passed through untouched for the view and story 017's
   * panel. They never influence `state`: `RepositoryFindingKind` has no kind meaning "the news
   * directory could not be read", that signal lives in the reader's findings alone. */
  readonly repositoryFindings: readonly RepositoryFinding[]
}
