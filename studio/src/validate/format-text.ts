/**
 * Story 012 D2: the plain-text formatter for `npm run validate`.
 *
 * Pure - no `node:*` imports, no ANSI colour, no TTY detection (Decisions (Sprint)). Every fact
 * printed here is read straight off story 011's `ContentReport` and story 012's own
 * `ValidationSummary`; this file classifies nothing and decides nothing, it only lays facts out as
 * lines of text a terminal (or a pipe) can show.
 */
import type { MirrorProvenance } from '../mirror/provenance'
import { formatProvenance } from '../mirror/provenance'
import type { ContentReport, EntryVerdict, Finding } from '../report/report-types'
import type { ValidationSummary } from './summary'

function formatDeclared(entry: EntryVerdict): string {
  return entry.declared.template ?? 'none declared'
}

function formatDelivered(entry: EntryVerdict): string {
  return entry.delivered === 'dropped' ? 'dropped' : entry.delivered.template
}

function formatFinding(finding: Finding): string {
  return `  [${finding.severity}] ${finding.message}`
}

function formatEntry(entry: EntryVerdict): string[] {
  const lines = [
    `${entry.id} (${entry.file}): declared ${formatDeclared(entry)} -> delivered ${formatDelivered(entry)}`,
  ]
  lines.push(...entry.findings.map(formatFinding))
  return lines
}

function formatSummary(summary: ValidationSummary): string {
  return (
    `${summary.deliveredAsDeclared} delivered as declared, ` +
    `${summary.fallingBack} falling back, ` +
    `${summary.dropped} dropped, ` +
    `${summary.repositoryFindings} repository finding(s)`
  )
}

/** Renders the whole validation result as plain ASCII lines: the mirror provenance header (verbatim
 * from story 009's `formatProvenance`), one block per entry (declared/delivered form plus its
 * findings), then the AC7 summary line. */
export function formatValidationText(input: {
  mirror: MirrorProvenance
  report: ContentReport
  summary: ValidationSummary
}): string[] {
  return [
    ...formatProvenance(input.mirror),
    '',
    ...input.report.entries.flatMap(formatEntry),
    '',
    formatSummary(input.summary),
  ]
}
