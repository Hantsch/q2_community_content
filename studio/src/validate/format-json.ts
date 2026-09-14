/**
 * Story 012 D3: the JSON payload for `npm run validate -- --json`.
 *
 * Pure - no `node:*` imports, since this is imported by the CLI's stdout writer but must stay
 * import-safe for the browser bundle too, matching the split the other files in this directory use.
 * Every field is taken verbatim from story 011's report or D1's summary; this module aggregates and
 * shapes only, it never re-derives a verdict (Decisions (Sprint)).
 */
import type { ContentReport, EntryVerdict } from '../report/report-types'
import type { MirrorProvenance } from '../mirror/provenance'
import type { ValidationSummary } from './summary'

/** Bumped whenever the shape of {@link ValidationPayload} changes in a way a consumer parsing the
 * JSON stream would need to know about. */
export const VALIDATE_SCHEMA_VERSION = 1

/** The single JSON document `--json` mode writes to stdout - the same facts as the text output
 * (Decisions (Sprint)), so nothing needs reverse-engineering out of the human-readable layout. */
export interface ValidationPayload {
  schemaVersion: number
  mirror: MirrorProvenance
  entries: EntryVerdict[]
  /** Story 013's field, consumed here as optional and empty until that story lands (Decisions
   * (Sprint)). */
  repositoryFindings: unknown[]
  summary: ValidationSummary
}

/**
 * Builds the `--json` payload from the mirror provenance (story 009), the report (story 011) and
 * the summary (D1). Every field is copied verbatim - `entries` and `repositoryFindings` come
 * straight off the report, `summary` straight off `summarise()` - so the JSON and text outputs can
 * never disagree about the facts.
 */
export function toValidationPayload(input: {
  mirror: MirrorProvenance
  report: ContentReport & { repositoryFindings?: readonly unknown[] }
  summary: ValidationSummary
}): ValidationPayload {
  return {
    schemaVersion: VALIDATE_SCHEMA_VERSION,
    mirror: input.mirror,
    entries: input.report.entries,
    repositoryFindings: [...(input.report.repositoryFindings ?? [])],
    summary: input.summary,
  }
}
