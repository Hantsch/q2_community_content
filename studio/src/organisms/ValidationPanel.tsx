/**
 * Story 017 D3: the validation panel's own presentational organism. Renders `ValidationPanelModel`
 * (`studio/src/validate/panel-model.ts`, D2) as-is - no re-derivation of a verdict, a status or the
 * `allClear` flag, mirroring `ContentTypeStateNotice`'s props-in/JSX-out shape
 * (`/frontend-guidelines`).
 *
 * Four regions, always distinct, never collapsed into one another (see the story's Decisions and
 * AC3/AC5):
 * - the selected entry's verdict + its own findings ("Entry findings"), OR
 * - a draft notice (`selectedRow.status === 'draft'`, since `panelModel.entry` never covers a
 *   draft - see `panel-model.ts`'s header), OR
 * - a plain "nothing selected" notice,
 * plus, always:
 * - the repository-findings region ("Repository findings"), shown even when empty, and
 * - the all-clear banner when `panelModel.allClear`.
 *
 * `onSelectEntry` is a later deliverable's "click a finding, jump to its entry" wiring - this
 * component only renders a `<button>` for findings that carry an `entryId`; no routing logic lives
 * here.
 *
 * Story 017 D4 adds an optional, fifth region: the mirror provenance line, shown when a
 * `provenance` prop is supplied. It is kept structurally distinct from the entry/repository
 * findings regions (its own `aria-label`, "Mirror provenance"), the same region-separation pattern
 * the rest of this file already follows. Wording mirrors `formatProvenance`
 * (`studio/src/mirror/provenance.ts`) and reuses its `VERDICT_LABELS` so the verdict word never
 * drifts from the CLI's own wording.
 */
import { SeverityBadge } from './SeverityBadge'
import type { LibraryRow } from '../library/library-types'
import { VERDICT_LABELS, type MirrorProvenance } from '../mirror/provenance'
import type { DeliveredEntry, VisibilityVerdict } from '../report/report-types'
import type { FindingView, PanelEntryView, ValidationPanelModel } from '../validate/panel-model'

export interface ValidationPanelProps {
  readonly panelModel: ValidationPanelModel
  /** Story 016's selected library row - only consulted when `panelModel.entry` is `undefined`, to
   * tell a selected draft apart from nothing being selected at all. See the file header. */
  readonly selectedRow?: LibraryRow
  /** Later deliverable's "jump to entry" hook; optional so a finding with an `entryId` degrades to
   * plain (non-interactive) content when no handler is supplied. */
  readonly onSelectEntry?: (id: string) => void
  /** Story 017 D4: the mirror provenance line is shown only when this is supplied. */
  readonly provenance?: MirrorProvenance
}

function deliveredSummary(delivered: DeliveredEntry): string {
  if (delivered === 'dropped') {
    return 'Dropped — the launcher did not deliver this entry.'
  }
  const position = delivered.position === undefined ? '' : `, position ${delivered.position}`
  return `Delivered as "${delivered.template}"${position}.`
}

function visibilitySummary(visibility: VisibilityVerdict): string | undefined {
  switch (visibility.state) {
    case 'published':
      return 'Visibility: published.'
    case 'scheduled':
      return `Visibility: scheduled — visible from ${visibility.visibleFrom}.`
    case 'expired':
      return `Visibility: expired — was visible until ${visibility.visibleUntil}.`
    case 'not-applicable':
      return undefined
    default: {
      const exhaustive: never = visibility
      throw new Error(`Unhandled visibility state: ${String(exhaustive)}`)
    }
  }
}

interface FindingItemProps {
  readonly finding: FindingView
  readonly onSelectEntry?: (id: string) => void
}

function FindingItem({ finding, onSelectEntry }: FindingItemProps): React.JSX.Element {
  const body = (
    <span className="flex items-center gap-2">
      <SeverityBadge severity={finding.severity} />
      <span>{finding.message}</span>
      <span className="text-text-subtle">{finding.file}</span>
    </span>
  )

  if (finding.entryId !== undefined && onSelectEntry) {
    const entryId = finding.entryId
    return (
      <li>
        <button type="button" className="text-left" onClick={() => onSelectEntry(entryId)}>
          {body}
        </button>
      </li>
    )
  }

  return <li>{body}</li>
}

interface EntrySectionProps {
  readonly entry: PanelEntryView
  readonly onSelectEntry?: (id: string) => void
}

function EntrySection({ entry, onSelectEntry }: EntrySectionProps): React.JSX.Element {
  const visibility = visibilitySummary(entry.visibility)

  return (
    <section aria-label="Entry findings" className="flex flex-col gap-2">
      <h2 className="font-medium">Entry findings</h2>
      <div className="flex flex-col gap-1">
        <p className="font-medium">{entry.declared.title ?? entry.file}</p>
        <p>{entry.file}</p>
        <p>{deliveredSummary(entry.delivered)}</p>
        {visibility && <p>{visibility}</p>}
      </div>
      {entry.findings.length === 0 ? (
        <p>No findings for this entry.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entry.findings.map((finding, index) => (
            <FindingItem key={index} finding={finding} onSelectEntry={onSelectEntry} />
          ))}
        </ul>
      )}
    </section>
  )
}

function DraftNotice({ selectedRow }: { readonly selectedRow: LibraryRow }): React.JSX.Element {
  return (
    <div aria-label="Draft" className="flex flex-col gap-2">
      <p className="font-medium">{selectedRow.title ?? selectedRow.file} is a draft.</p>
      <p>{selectedRow.file}</p>
      <p>
        A draft is invisible to the launcher — it was never delivered, so there is no
        launcher-facing verdict to report.
      </p>
    </div>
  )
}

function ProvenanceSection({
  provenance,
}: {
  readonly provenance: MirrorProvenance
}): React.JSX.Element {
  return (
    <section aria-label="Mirror provenance" className="flex flex-col gap-1">
      <h2 className="font-medium">Mirror provenance</h2>
      <p>Status: {VERDICT_LABELS[provenance.verdict]}</p>
      <p>
        Launcher mirror: commit {provenance.launcherCommitShort}, synced {provenance.syncedAt} (
        {provenance.ageInDays}d ago)
      </p>
      <p>Mirrored files: {provenance.fileCount}</p>
      <p>Out of sync: {provenance.mismatchedFiles.length}</p>
      {provenance.reason !== undefined && <p>Reason: {provenance.reason}</p>}
    </section>
  )
}

function NothingSelectedNotice(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <p>
        Nothing selected. Choose an entry or draft from the library to see its validation verdict.
      </p>
    </div>
  )
}

export function ValidationPanel({
  panelModel,
  selectedRow,
  onSelectEntry,
  provenance,
}: ValidationPanelProps): React.JSX.Element {
  const { entry, repositoryFindings, allClear } = panelModel
  const isDraftSelection = entry === undefined && selectedRow?.status === 'draft'

  return (
    <div className="flex flex-col gap-4">
      {provenance && <ProvenanceSection provenance={provenance} />}

      {entry ? (
        <EntrySection entry={entry} onSelectEntry={onSelectEntry} />
      ) : isDraftSelection && selectedRow ? (
        <DraftNotice selectedRow={selectedRow} />
      ) : (
        <NothingSelectedNotice />
      )}

      <section aria-label="Repository findings" className="flex flex-col gap-2">
        <h2 className="font-medium">Repository findings</h2>
        {repositoryFindings.length === 0 ? (
          <p>No repository-level findings.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {repositoryFindings.map((finding, index) => (
              <FindingItem key={index} finding={finding} onSelectEntry={onSelectEntry} />
            ))}
          </ul>
        )}
      </section>

      {allClear && (
        <p role="status" className="font-medium">
          All clear — no findings for the selected entry or the repository.
        </p>
      )}
    </div>
  )
}
