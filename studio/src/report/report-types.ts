/**
 * Story 011 D1: the report's own model.
 *
 * Types only, deliberately - the shapes here name what D2-D5 fill in, but attaching any logic to
 * them would blur the line the story draws: a report is derived from the mirrored pipeline's
 * output (AC8), never computed by re-checking the launcher's own rules. `NewsTemplate`/`NewsButton`
 * come straight from the mirror so "declared"/"delivered" template values always mean what the
 * launcher itself means by them.
 */
import type { NewsTemplate, NewsButton } from '../contract/launcher-contract'

/** Severity model per the user's Decisions (Sprint): drops are `error`, fallbacks/notes not fatal
 * but almost always a mistake are `warning`, states like scheduled/expired are `info`. */
export type FindingSeverity = 'error' | 'warning' | 'info'

/** Whether a finding was produced by classifying the mirrored pipeline's own output - a
 * `NewsFeedWarning.reason` string, or (D5's scheduled/expired verdicts) plain presence or absence of
 * an id across the pipeline's own `resolvedSlides`/`deliveredSlides` lists, both of which AC8's own
 * wording admits as "the mirrored pipeline's own output" - or added by the report itself from a
 * source the pipeline never sees at all (e.g. a declared image path checked against the repository's
 * own file listing, or D5's order-tie explanation - the pipeline sorts silently and warns about
 * neither). Exists so AC8 - every verdict traces to the pipeline, the report classifies and explains
 * but does not decide - is checkable in the data, not only in the tests. */
export type FindingSource = 'pipeline' | 'studio'

/**
 * One reportable fact about the feed: a dropped entry, a fallback, a button decision, a visibility
 * state, an index-level problem, and so on. `entryId`/`file` are omitted for report-level findings
 * (bad index shape, missing schemaVersion) that concern no single entry.
 */
export interface Finding {
  severity: FindingSeverity
  /** Stable classifier tag, e.g. `'duplicate-id'`, `'template-fallback'`, `'button-cap'`. See
   * `classify-warning.ts` for the vocabulary drawn from the pipeline's own warnings. */
  kind: string
  message: string
  entryId?: string
  file?: string
  source: FindingSource
}

/** What the author wrote for one entry, read with the mirrored `parseFrontmatter()` - "declared"
 * means exactly what the launcher would read, never a separate studio parse. */
export interface DeclaredEntry {
  template?: string
  title?: string
  body: string
  image?: string
  order?: string
  visibleFrom?: string
  visibleUntil?: string
  buttonCount: number
  /** The declared buttons in declaration order - the same list, in the same order, that the
   * pipeline's `sanitizeButtons()` iterated, which is what makes D4's per-button attribution
   * possible. */
  buttons: DeclaredButton[]
}

/** A button as the author declared it, before the pipeline's allowlist/cap decide its fate. */
export interface DeclaredButton {
  label?: string
  url?: string
}

/** One button's kept/dropped verdict. */
export interface ButtonVerdict {
  declared: DeclaredButton
  kept: boolean
  /** Why this button was dropped, as the `Finding.kind` of the finding that spells it out
   * (`'button-host-not-allowed'`, `'button-invalid'`, `'button-cap'`). Absent for a kept button.
   * Two values name a case with no finding of its own: `'entry-dropped'` (the entry itself was
   * dropped, so the pipeline never judged its buttons - the entry's own finding says why) and
   * `'unclassified'` (no pipeline warning explains this button; see `button-verdicts.ts`). */
  reason?: string
}

/** What the pipeline actually resolved an entry to, once template resolution (and later,
 * button/visibility/order) has run. `'dropped'` is a `NewsFeedWarning` reason away from a `Finding`
 * at severity `error` - see `classify-warning.ts`. */
export type DeliveredEntry =
  | 'dropped'
  | {
      template: NewsTemplate
      order: number
      /** Position in the delivered (filtered + sorted) slide list; absent while an entry is only
       * resolved but not yet placed by `filterAndSortSlides()`. */
      position?: number
      buttons: NewsButton[]
    }

/** AC6's three visibility states. `published` needs no extra data; `scheduled`/`expired` carry the
 * date the pipeline read off the entry's frontmatter. */
export type VisibilityVerdict =
  | { state: 'published' }
  | { state: 'scheduled'; visibleFrom: string }
  | { state: 'expired'; visibleUntil: string }
  | { state: 'not-applicable' }

/** One index row's full verdict: what was declared, what was delivered, and every finding that
 * explains the difference (if any). */
export interface EntryVerdict {
  id: string
  file: string
  /** Position of this row in `news/index.json`'s own `entries` array. */
  indexPosition: number
  declared: DeclaredEntry
  delivered: DeliveredEntry
  visibility: VisibilityVerdict
  buttons: ButtonVerdict[]
  findings: Finding[]
}

/** Per-severity finding counts, and the three delivery outcomes named in the plan's step 7 -
 * the raw material story 012's summary line needs. */
export interface ReportSummary {
  deliveredAsDeclared: number
  fallenBack: number
  dropped: number
  findingsBySeverity: Record<FindingSeverity, number>
}

/** The whole report for one feed evaluation: every index row's verdict, plus findings that concern
 * no single entry (bad index shape, missing schemaVersion), plus the roll-up summary. */
export interface ContentReport {
  entries: EntryVerdict[]
  findings: Finding[]
  summary: ReportSummary
}
