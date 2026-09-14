/**
 * Story 012 D1: the pure summary core the rest of the validate CLI builds on.
 *
 * Aggregates and formats only - every count here is read straight off story 011's `ContentReport`,
 * never recomputed by re-checking the launcher's own rules. `repositoryFindings` belongs to story
 * 013 and is supplied by story 017's `buildValidationSnapshot()`; the field stays optional, so a
 * caller holding a bare report still gets 0 rather than a wrong count (Decisions (Sprint)).
 */
import type { ContentReport } from '../report/report-types'

/** Counts a person can act on (AC7): entries delivered as declared, falling back, dropped, plus
 * repository-level findings and the total entry count. */
export interface ValidationSummary {
  deliveredAsDeclared: number
  fallingBack: number
  dropped: number
  repositoryFindings: number
  total: number
}

/** Rolls up story 011's report into the four AC7 counts. `repositoryFindings` reads an optional
 * field story 011's own `ContentReport` never carries: callers that have story 013's findings
 * (`buildValidationSnapshot()`) pass them in on the report; absence still counts as 0. */
export function summarise(report: ContentReport & { repositoryFindings?: readonly unknown[] }): ValidationSummary {
  return {
    deliveredAsDeclared: report.summary.deliveredAsDeclared,
    fallingBack: report.summary.fallenBack,
    dropped: report.summary.dropped,
    repositoryFindings: (report.repositoryFindings ?? []).length,
    total: report.entries.length,
  }
}

/** AC3: only drops fail the default exit code; `--strict` also fails on fallbacks. Exit codes are
 * 0 and 1 only (Decisions (Sprint)). */
export function exitCodeFor(summary: ValidationSummary, options?: { strict?: boolean }): 0 | 1 {
  if (summary.dropped > 0) {
    return 1
  }
  if (options?.strict && summary.fallingBack > 0) {
    return 1
  }
  return 0
}
