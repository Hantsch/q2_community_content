/**
 * Story 021 D1: decides whether the slide preview renders an entry that the launcher would not show
 * right now (scheduled or expired), and whether the author's "show anyway" override is on offer.
 *
 * Read entirely off the report's own `EntryVerdict` - the reason text is the entry's own
 * `scheduled`/`expired` finding, verbatim - so nothing here re-checks a visibility window or reads a
 * clock. Dropped and not-applicable entries are not handled here; story 018's drop state owns them.
 */
import type { EntryVerdict } from '../report/report-types'

export type PreviewVisibilityDecision =
  /** Not handled here: defer to the existing drop/nothing state. The override flag is ignored. */
  | { kind: 'deferred'; overrideAvailable: false }
  | { kind: 'render'; override: false; overrideAvailable: false }
  | { kind: 'render'; override: true; overrideAvailable: true; realState: string }
  | { kind: 'hidden'; reason: string; overrideAvailable: true }

export function decidePreviewVisibility(
  verdict: EntryVerdict,
  overrideOn: boolean,
): PreviewVisibilityDecision {
  if (verdict.delivered === 'dropped') return { kind: 'deferred', overrideAvailable: false }

  const state = verdict.visibility.state
  if (state === 'published') return { kind: 'render', override: false, overrideAvailable: false }
  if (state !== 'scheduled' && state !== 'expired') {
    return { kind: 'deferred', overrideAvailable: false }
  }

  const finding = verdict.findings.find((candidate) => candidate.kind === state)
  if (!finding) return { kind: 'deferred', overrideAvailable: false }

  return overrideOn
    ? { kind: 'render', override: true, overrideAvailable: true, realState: finding.message }
    : { kind: 'hidden', reason: finding.message, overrideAvailable: true }
}
