/**
 * Story 011 D2: the report spine - walks `news/index.json`'s own rows, in their own order, and
 * turns the mirrored pipeline's output into one `EntryVerdict` per row plus report-level findings
 * for anything that concerns no single entry.
 *
 * Per AC8 and the story's Decisions (Sprint), this file decides nothing about the feed itself: it
 * calls the mirrored `resolveFeed()` then `filterAndSortSlides()` (never `buildFeed()` - the
 * difference between the two lists *is* the visibility/order verdict, see the Decisions), reads the
 * declared side with the mirrored `parseFrontmatter()`, and classifies every `NewsFeedWarning` with
 * `classifyWarning()`. The per-button verdicts come from D4's `buildButtonVerdicts()`, whose
 * findings replace this file's own entry-level ones for the button warnings (see
 * `button-verdicts.ts`); the visibility state and order-tie findings come from D5's
 * `visibility-order.ts`.
 */
import {
  filterAndSortSlides,
  resolveFeed,
  parseFrontmatter,
  type NewsFeedWarning,
  type NewsSlide,
} from '../contract/launcher-contract'
import { classifyWarning } from './classify-warning'
import { buildButtonVerdicts, isPerButtonWarningKind } from './button-verdicts'
import { buildDeclaredImageMissingFinding, enrichTemplateFallbackMessage } from './template-verdict'
import { buildOrderTieFindings, buildVisibilityVerdict } from './visibility-order'
import type {
  ContentReport,
  DeclaredEntry,
  DeliveredEntry,
  EntryVerdict,
  Finding,
  ReportSummary,
} from './report-types'

export interface BuildNewsReportInput {
  /** The already-`JSON.parse`d `news/index.json`. Typed `unknown` on purpose - it is foreign JSON,
   * exactly like `resolveFeed()`'s own input. */
  index: unknown
  /** Raw `.md` text keyed by the file name the index refers to. */
  documents: Readonly<Record<string, string>>
  /** The caller's notion of "now" - the pipeline never reads the clock itself. */
  now: Date
  /** The repository's own files, when known - drives D3's studio-sourced "declared image absent
   * from the repository" finding. Omitted entirely means "not checked" (no finding either way),
   * not "nothing found". */
  images?: { name: string; size: number }[]
}

/** One `news/index.json` row with a usable `id`/`file`, mirroring `indexEntrySchema`'s own check
 * (`z.string().trim().min(1)`) closely enough to decide, without validating anything else, whether
 * this row reached `resolveFeed()`'s per-entry step at all. */
function extractIndexRow(raw: unknown): { id: string; file: string } | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const id = (raw as Record<string, unknown>).id
  const file = (raw as Record<string, unknown>).file
  if (typeof id !== 'string' || id.trim() === '') return undefined
  if (typeof file !== 'string' || file.trim() === '') return undefined
  return { id: id.trim(), file: file.trim() }
}

/** "What the author wrote", read with the mirrored `parseFrontmatter()` - never a separate parser
 * (Decisions (Sprint)). A missing document or unparseable frontmatter yields a best-effort partial:
 * the point of `declared` is what was authored, and the finding (not a thrown error) says why it
 * could not be read fully. */
function buildDeclared(documents: Readonly<Record<string, string>>, file: string): DeclaredEntry {
  const text = Object.prototype.hasOwnProperty.call(documents, file) ? documents[file] : undefined
  if (typeof text !== 'string') return { body: '', buttonCount: 0, buttons: [] }

  const parsed = parseFrontmatter(text)
  if (!parsed) return { body: '', buttonCount: 0, buttons: [] }

  const { data, body } = parsed
  // `buttons:` only yields a list when the frontmatter block spells one out; a scalar `buttons: x`
  // lands in `data` as a plain string (see `frontmatter.ts`), which the pipeline then reports as
  // "buttons is not a list" - and which leaves this entry with no declared buttons to attribute
  // anything to.
  const buttons = Array.isArray(data.buttons) ? data.buttons : []
  return {
    template: data.template,
    title: data.title,
    body,
    image: data.image,
    order: data.order,
    visibleFrom: data.visibleFrom,
    visibleUntil: data.visibleUntil,
    buttonCount: (data.buttons ?? []).length,
    buttons,
  }
}

/** "What the pipeline actually resolved" for one id: absent from the resolved (pre-filter) slide
 * list means the pipeline dropped it; present but absent from the delivered (filtered + sorted)
 * list means it resolved but is not currently visible - D5's job to explain, so `position` is simply
 * left out here. */
function buildDelivered(
  id: string,
  resolvedSlides: NewsSlide[],
  deliveredSlides: NewsSlide[],
): DeliveredEntry {
  const slide = resolvedSlides.find((candidate) => candidate.id === id)
  if (!slide) return 'dropped'

  const position = deliveredSlides.findIndex((candidate) => candidate.id === id)
  return {
    template: slide.template,
    order: slide.order,
    buttons: slide.buttons,
    ...(position >= 0 ? { position } : {}),
  }
}

/** Every warning the pipeline attached to this exact id/file pair, in pipeline order. Matching on
 * both - not just `id` - matters for a duplicate id: the dropped row's own warning carries the
 * *duplicate* row's `file`, which is how it lands on that row's verdict and not the row that was
 * kept. */
function selectEntryWarnings(
  warnings: NewsFeedWarning[],
  id: string,
  file: string,
): NewsFeedWarning[] {
  return warnings.filter((warning) => warning.id === id && warning.file === file)
}

/** This entry's own warnings, classified. The per-button ones are left out: D4 re-reports each of
 * them against the button it actually concerns, which a warning like "1 button(s) beyond the cap of
 * 3 were dropped" does not name itself. */
function buildEntryFindings(entryWarnings: NewsFeedWarning[], id: string, file: string): Finding[] {
  return entryWarnings
    .filter((warning) => !isPerButtonWarningKind(classifyWarning(warning).kind))
    .map((warning) => {
      const classified = classifyWarning(warning)
      return {
        severity: classified.severity,
        kind: classified.kind,
        message: classified.message,
        entryId: id,
        file,
        source: 'pipeline' as const,
      }
    })
}

/**
 * Builds the whole declared-vs-delivered report for one feed evaluation. See the file header for
 * what this deliverable does and does not decide.
 */
export function buildNewsReport({
  index,
  documents,
  now,
  images,
}: BuildNewsReportInput): ContentReport {
  const { slides: resolvedSlides, warnings } = resolveFeed({ index, documents })
  const deliveredSlides = filterAndSortSlides(resolvedSlides, now)

  // Warnings with no `id` concern no single entry: a top-level index shape the pipeline could not
  // use at all, a missing schemaVersion, or an index row so malformed it has no usable id/file.
  const reportFindings: Finding[] = warnings
    .filter((warning) => warning.id === undefined)
    .map((warning) => {
      const classified = classifyWarning(warning)
      return {
        severity: classified.severity,
        kind: classified.kind,
        message: classified.message,
        source: 'pipeline' as const,
      }
    })

  const rawEntries = (index as { entries?: unknown } | null | undefined)?.entries
  const indexEntries = Array.isArray(rawEntries) ? rawEntries : []

  // Mirrors `resolveFeed()`'s own step 2 (its `seenIds` set): only the first row for a given id can
  // ever appear in `resolvedSlides`, since a later row sharing that id is dropped for being a
  // duplicate before the pipeline even looks at its document. Without tracking this ourselves, a
  // duplicate row's verdict would wrongly show the *first* row's slide as its own delivery.
  const seenIds = new Set<string>()

  // D5's order-tie findings concern two entries at once, so they are computed in one pass over the
  // whole resolved list, then matched back onto their own entry below - the same reason `fileById`
  // exists at all: `NewsSlide` carries no `file`, only the index row does.
  const fileById = new Map<string, string>()
  indexEntries.forEach((rawEntry) => {
    const row = extractIndexRow(rawEntry)
    if (row && !fileById.has(row.id)) fileById.set(row.id, row.file)
  })
  const orderTieFindings = buildOrderTieFindings(resolvedSlides, deliveredSlides, fileById)

  const entries: EntryVerdict[] = []
  indexEntries.forEach((rawEntry, indexPosition) => {
    const row = extractIndexRow(rawEntry)
    // No usable id/file: `resolveFeed()` already reported this as a report-level warning above
    // (the "index entry at position N ..." reason carries no id), so there is nothing more to add
    // here, and nothing reliable to hang an `EntryVerdict` on (per the story's Decisions).
    if (!row) return

    const { id, file } = row
    const isDuplicate = seenIds.has(id)
    seenIds.add(id)

    const declared = buildDeclared(documents, file)
    const entryWarnings = selectEntryWarnings(warnings, id, file)
    const delivered = isDuplicate ? 'dropped' : buildDelivered(id, resolvedSlides, deliveredSlides)

    // D3: the pipeline's own template-fallback finding, enriched with the declared `image` value
    // it never mentions itself, plus the one studio-decided finding - a declared `image` absent
    // from the repository's own files - computed independently of whatever the pipeline decided.
    const findings = buildEntryFindings(entryWarnings, id, file).map((finding) =>
      enrichTemplateFallbackMessage(finding, declared.image),
    )
    const declaredImageFinding = buildDeclaredImageMissingFinding(declared.image, images, id, file)
    if (declaredImageFinding) findings.push(declaredImageFinding)

    // D4: every declared button as kept or dropped, with the pipeline's own reason attributed to
    // the button it was about.
    const buttons = buildButtonVerdicts({
      declared: declared.buttons,
      delivered,
      warnings: entryWarnings,
      entryId: id,
      file,
    })
    findings.push(...buttons.findings)

    // D5: published/scheduled/expired, and this entry's own share of any order tie. A duplicate
    // row is forced to `'dropped'` above even though its id resolves to the *other*, kept row's
    // slide - so visibility has to follow `delivered`, not repeat the `resolvedSlides` lookup, or a
    // duplicate row would wrongly borrow the kept row's visibility state.
    const { visibility, finding: visibilityFinding } =
      delivered === 'dropped'
        ? { visibility: { state: 'not-applicable' as const }, finding: undefined }
        : buildVisibilityVerdict(id, resolvedSlides, deliveredSlides, now, file)
    if (visibilityFinding) findings.push(visibilityFinding)
    // A duplicate row's `id` is the same string as the surviving row's, but it never reached
    // `resolvedSlides` itself (the pipeline drops it before template resolution even runs) - so the
    // tie-break, which only makes sense for entries that actually reached `resolvedSlides`, must not
    // be attached here. Without this guard the duplicate row would borrow the kept row's finding,
    // `file` value included.
    if (!isDuplicate) findings.push(...orderTieFindings.filter((finding) => finding.entryId === id))

    entries.push({
      id,
      file,
      indexPosition,
      declared,
      delivered,
      visibility,
      buttons: buttons.verdicts,
      findings,
    })
  })

  const allFindings = [...reportFindings, ...entries.flatMap((entry) => entry.findings)]

  const summary: ReportSummary = {
    deliveredAsDeclared: entries.filter(
      (entry) =>
        entry.delivered !== 'dropped' && entry.delivered.template === entry.declared.template,
    ).length,
    fallenBack: entries.filter(
      (entry) =>
        entry.delivered !== 'dropped' && entry.delivered.template !== entry.declared.template,
    ).length,
    dropped: entries.filter((entry) => entry.delivered === 'dropped').length,
    findingsBySeverity: {
      error: allFindings.filter((finding) => finding.severity === 'error').length,
      warning: allFindings.filter((finding) => finding.severity === 'warning').length,
      info: allFindings.filter((finding) => finding.severity === 'info').length,
    },
  }

  return { entries, findings: reportFindings, summary }
}
