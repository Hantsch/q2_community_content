/**
 * Story 017 D1: the one composition step behind every validation surface.
 *
 * Takes a single `ContentRepoRead` (story 010) plus the mirror provenance (story 009) and an
 * evaluation instant, and returns everything the CLI and — from a later deliverable — the browser
 * panel need: story 011's declared-vs-delivered report, story 013's repository-level findings, and
 * story 012's summary of both.
 *
 * Pure, in the same sense as `summary.ts` and `format-json.ts`: data in, data out, no `node:*`
 * import anywhere in this file or its transitive value imports, so it stays import-safe for the
 * browser bundle. The caller does the reading; this module only composes. It derives nothing on its
 * own either — `report`, `repositoryFindings` and `summary` are whatever `buildNewsReport()`,
 * `collectRepositoryFindings()` and `summarise()` say they are.
 */
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { MirrorProvenance } from '../mirror/provenance'
import type { ContentReport } from '../report/report-types'
import { buildNewsReport, type BuildNewsReportInput } from '../report/build-news-report'
import {
  collectRepositoryFindings,
  toRepositoryScan,
  type RepositoryFinding,
} from '../report/repository-findings'
import { summarise, type ValidationSummary } from './summary'

/** One validation run's facts, kept as three separate fields rather than one merged report: the
 * report is story 011's shape and stays exactly that, while `repositoryFindings` is story 013's own
 * type and belongs to the tree rather than to any entry. */
export interface ValidationSnapshot {
  readonly mirror: MirrorProvenance
  readonly report: ContentReport
  readonly repositoryFindings: readonly RepositoryFinding[]
  readonly summary: ValidationSummary
}

/**
 * Adapts a `ContentRepoRead` into `buildNewsReport()`'s input — the same adaptation
 * `content-types/descriptors.ts`'s `toNewsReportInput()` performs, kept identical on purpose so the
 * registry-driven studio surface and this snapshot can never feed the report builder two different
 * views of the same read.
 */
function toNewsReportInput(read: ContentRepoRead, now: Date): BuildNewsReportInput {
  return {
    index: read.index.value,
    documents: Object.fromEntries(
      Object.entries(read.documents).map(([file, document]) => [file, document.text]),
    ),
    now,
    images: read.images.map((image) => ({ name: image.name, size: image.bytes })),
  }
}

/**
 * Composes one read into a full snapshot. `summarise()` already accepts an optional
 * `repositoryFindings` array on the report it is handed, so the findings are passed through that
 * same field rather than by widening its signature — which is why the summary's
 * `repositoryFindings` count is the real one here, where callers that build the report alone still
 * see 0.
 */
export function buildValidationSnapshot(input: {
  read: ContentRepoRead
  mirror: MirrorProvenance
  now: Date
}): ValidationSnapshot {
  const report = buildNewsReport(toNewsReportInput(input.read, input.now))
  const repositoryFindings = collectRepositoryFindings(toRepositoryScan(input.read))
  const summary = summarise({ ...report, repositoryFindings })

  return { mirror: input.mirror, report, repositoryFindings, summary }
}
