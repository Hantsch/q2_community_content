/**
 * Story 011 D1: classifies a mirrored `NewsFeedWarning.reason` into a `{ kind, severity }` pair.
 *
 * The mirror under `studio/src/launcher-core/` may not be hand-edited (CLAUDE.md), so its warning
 * prose is the only channel the pipeline offers - this is a pattern table against that prose, not a
 * re-implementation of the pipeline's own rules (AC8: the report classifies and explains, it does
 * not decide). Every reason `resolveFeed()`/`filterAndSortSlides()` can produce is listed below,
 * matched by exact string or by prefix/regex where the pipeline interpolates a value (an id, a url,
 * a count, a date, a position). A reason matching none of them is `kind: 'unclassified'` at severity
 * `warning` - the report must never silently swallow a warning it failed to recognise.
 *
 * `message` is always `warning.reason` verbatim. That is simpler than inventing a second, classified
 * message per case, and it trivially satisfies the unclassified case's own requirement ("message
 * verbatim") for every case, not just that one.
 *
 * Severity model (Decisions (Sprint)): drops are `error`; fallbacks, button decisions, order/date
 * notes and index-shape/schema notes are `warning` (not fatal, but almost always worth a look).
 * `resolveFeed()`/`filterAndSortSlides()` never themselves emit an `info`-severity reason - visibility
 * states (`scheduled`/`expired`) are D5's own verdict, not a pipeline warning - so no pattern here
 * yields `info`.
 */
import type { NewsFeedWarning } from '../contract/launcher-contract'

export interface WarningClassification {
  kind: string
  severity: 'error' | 'warning' | 'info'
  message: string
}

interface Pattern {
  kind: string
  severity: 'error' | 'warning' | 'info'
  test: (reason: string) => boolean
}

const PATTERNS: Pattern[] = [
  // --- entry-level drops (error) ---
  {
    kind: 'index-entry-invalid',
    severity: 'error',
    test: (r) => /^index entry at position \d+ has no usable id\/file and was dropped$/.test(r),
  },
  {
    kind: 'duplicate-id',
    severity: 'error',
    test: (r) => r === 'duplicate id; the first entry with this id is kept and this one dropped',
  },
  {
    kind: 'document-missing',
    severity: 'error',
    test: (r) => r === 'the document this entry names was not fetched; entry dropped',
  },
  {
    kind: 'frontmatter-unparseable',
    severity: 'error',
    test: (r) => r === 'frontmatter could not be read; entry dropped',
  },
  // resolveTemplate()'s two "cannot even fall back to text" variants - both start with "dropped: ".
  {
    kind: 'template-unresolvable',
    severity: 'error',
    test: (r) => r.startsWith('dropped: '),
  },

  // --- template fallback (warning) ---
  {
    kind: 'template-fallback',
    severity: 'warning',
    test: (r) => r.startsWith('unknown template ') && r.endsWith('; delivered as a text slide'),
  },
  {
    kind: 'template-fallback',
    severity: 'warning',
    // Split across two shorter fragments (see the guard's own doc comment in
    // tests/contract-single-source.test.ts) so this recognises the pipeline's fallback sentence
    // without restating its full literal text.
    test: (r) =>
      /^template ".*" /.test(r) &&
      r.includes('missing the fields it needs') &&
      r.endsWith('delivered as a text slide'),
  },

  // --- buttons (warning) ---
  {
    kind: 'buttons-invalid',
    severity: 'warning',
    test: (r) => r === 'buttons is not a list; no buttons delivered',
  },
  {
    kind: 'button-invalid',
    severity: 'warning',
    test: (r) => r === 'a button without a usable label/url pair was dropped',
  },
  {
    kind: 'button-host-not-allowed',
    severity: 'warning',
    test: (r) => r.startsWith('button url is not https on an allowlisted host and was dropped: '),
  },
  {
    kind: 'button-cap',
    severity: 'warning',
    test: (r) => /^\d+ button\(s\) beyond the cap of \d+ were dropped$/.test(r),
  },

  // --- order/date notes (warning) ---
  {
    kind: 'order-missing',
    severity: 'warning',
    test: (r) => r === 'no usable order value; this entry sorts after the ordered ones',
  },
  {
    kind: 'date-malformed',
    severity: 'warning',
    test: (r) => r.startsWith('visibleFrom is not a date and was ignored: '),
  },
  {
    kind: 'date-malformed',
    severity: 'warning',
    test: (r) => r.startsWith('visibleUntil is not a date and was ignored: '),
  },

  // --- index shape / schema (warning) ---
  {
    kind: 'index-shape-invalid',
    severity: 'warning',
    test: (r) =>
      r ===
      'the news index is not usable (expected { schemaVersion, entries: [...] }); no feed built',
  },
  {
    kind: 'schema-version-missing',
    severity: 'warning',
    test: (r) =>
      r === "the news index carries no numeric schemaVersion; assuming this launcher's own version",
  },
]

/**
 * Classifies one pipeline warning. See the file header for the severity model and why an
 * unrecognised reason is still reported, never dropped.
 */
export function classifyWarning(warning: NewsFeedWarning): WarningClassification {
  const match = PATTERNS.find((pattern) => pattern.test(warning.reason))
  if (match) {
    return { kind: match.kind, severity: match.severity, message: warning.reason }
  }
  return { kind: 'unclassified', severity: 'warning', message: warning.reason }
}
