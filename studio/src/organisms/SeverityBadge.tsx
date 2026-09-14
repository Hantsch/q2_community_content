/**
 * Story 017 D3: a small badge for one `FindingView.severity` (`studio/src/validate/panel-model.ts`,
 * re-exporting `report-types.ts`'s `FindingSeverity`). Mirrors `EntryStatusBadge`'s pattern
 * (`studio/src/molecules/status/EntryStatusBadge.tsx`) exactly: props-in/JSX-out, no derivation of
 * the severity itself.
 *
 * AC6: colour is never the only signal. Each severity renders a text label AND a glyph, both as
 * visible text content - so the distinction reads in a screen reader, in a colour-blind-safe
 * rendering, and in a test that only ever queries text/role, never a class name.
 */
import type { FindingSeverity } from '../report/report-types'

export interface SeverityBadgeProps {
  readonly severity: FindingSeverity
}

const SEVERITY_LABEL: Readonly<Record<FindingSeverity, string>> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
}

/** One visually and semantically distinct glyph per severity, so the label is never the only thing
 * that tells two severities apart. */
const SEVERITY_GLYPH: Readonly<Record<FindingSeverity, string>> = {
  error: '⛔',
  warning: '⚠',
  info: 'ℹ',
}

const SEVERITY_STYLES: Readonly<Record<FindingSeverity, string>> = {
  error: 'bg-severity-error-soft text-severity-error border-severity-error-border',
  warning: 'bg-severity-warning-soft text-severity-warning border-severity-warning-border',
  info: 'bg-severity-info-soft text-severity-info border-severity-info-border',
}

export function SeverityBadge({ severity }: SeverityBadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm font-medium ${SEVERITY_STYLES[severity]}`}
    >
      <span>{SEVERITY_GLYPH[severity]}</span>
      {SEVERITY_LABEL[severity]}
    </span>
  )
}
