/**
 * Story 082 D3: the pure feed pipeline - the whole of AC2-AC6 in one place.
 *
 * `buildFeed({ index, documents, now })` takes the already-`JSON.parse`d
 * `news/index.json`, the raw text of the `.md` documents it references, and the
 * caller's notion of "now", and answers the delivered slides plus a warning per
 * genuinely invalid thing it had to drop. No filesystem, no network, no logger and
 * no reading of the clock - fetching is D5's job, logging the warnings is D6's, and
 * `now` is a parameter so the visibility window is testable (AC10).
 *
 * Foreign network data reaches the launcher here, so every step is defensive:
 * a bad entry is dropped, never thrown on, and the rest of the feed still
 * arrives (AC2).
 *
 * The decision order per entry matters, because the drop rules interact - an
 * entry with an unknown template AND no image AND no title must fold into one
 * decision, not three partial ones:
 *
 *   1. index entry valid (`id`, `file`)?           else drop
 *   2. `id` not already seen?                      else drop (first wins)
 *   3. document present in `documents`?             else drop
 *   4. frontmatter parses?                          else drop
 *   5. resolve the template: declared template if it is one of split/banner/
 *      text and satisfies its own content schema; otherwise fall back to `text`
 *      if title AND body both exist; otherwise drop  <- the single folded decision
 *   6. only for survivors: sanitize buttons (allowlist, then cap at 3)
 *   7. only for survivors: keep it if `now` is inside its visibility window
 *   8. sort what is left by `order` ascending, stable on the index's own order
 *
 * Steps 1-6 are `resolveFeed()`: everything that validates and resolves an entry, with no notion of
 * "now" at all, in the index's own stable order. Steps 7-8 are `filterAndSortSlides()`. `buildFeed()`
 * is the thin composition of both (`resolveFeed()` then `filterAndSortSlides()`), kept around because
 * every existing caller wants the fully-filtered-and-sorted result in one call.
 *
 * The split exists because the cache stores validated-but-unfiltered slides (Decisions (Sprint)):
 * `news-service.ts` persists `resolveFeed()`'s output, not `buildFeed()`'s, and calls
 * `filterAndSortSlides()` itself on every delivery against the *current* `now`. That is what lets a
 * slide whose `visibleFrom` was still in the future at fetch time - and so would have been dropped by
 * `buildFeed()`'s own filter there and then - surface once `now` catches up to it on a later
 * delivery, even if every following fetch answers a `304` and the cache is never rebuilt.
 */

import {
  NEWS_SCHEMA_VERSION,
  isAllowedButtonHost,
  newsBannerContentSchema,
  newsButtonSchema,
  newsCoverContentSchema,
  newsSplitContentSchema,
  newsTextContentSchema,
  type NewsButton,
  type NewsSlide,
  type NewsTemplate,
} from '@shared/modules/home'
import { z } from 'zod'
import { parseFrontmatter } from './frontmatter'

/** One row of `news/index.json`: which document to fetch, under which id. */
export interface NewsIndexEntry {
  id: string
  file: string
}

/**
 * `news/index.json` as a whole. `schemaVersion` is feed-level (one number for the
 * whole feed), which is what makes `schemaAhead` a single boolean rather than a
 * per-slide flag.
 */
export interface NewsIndex {
  schemaVersion: number
  entries: NewsIndexEntry[]
}

/**
 * One dropped-something-invalid note. Deliberately flat prose plus the ids it
 * concerns: D6 iterates and hands `reason` to `log.warn`, it does not pattern-match
 * on the fields.
 */
export interface NewsFeedWarning {
  reason: string
  id?: string
  file?: string
}

/** `resolveFeed()`'s input: validation and resolution only, so there is deliberately no `now` here -
 * see the file header for why filtering must not happen at this step. */
export interface ResolveFeedInput {
  /** The parsed `news/index.json`. Typed `unknown` on purpose - it is foreign JSON. */
  index: unknown
  /** Raw `.md` text keyed by the file name the index refers to. */
  documents: Readonly<Record<string, string>>
}

export interface BuildFeedInput extends ResolveFeedInput {
  /** Passed in by the caller; the pipeline never reads the clock itself. */
  now: Date
}

export interface BuildFeedResult {
  slides: NewsSlide[]
  warnings: NewsFeedWarning[]
  schemaAhead: boolean
}

/** AC6: at most this many buttons per entry reach the renderer. */
export const MAX_BUTTONS_PER_SLIDE = 3

/** Shape check only - the entries themselves are validated one by one, so a single
 * bad row cannot take the feed with it. Unknown top-level keys are ignored rather
 * than rejected: a newer feed may carry fields this launcher does not know. */
const indexShapeSchema = z.object({
  schemaVersion: z.unknown(),
  entries: z.array(z.unknown()),
})

const indexEntrySchema = z.object({
  id: z.string().trim().min(1),
  file: z.string().trim().min(1),
})

/** What every template's content schema yields once parsed - `image` only ever set by
 * the two schemas that carry the field. */
interface NewsTemplateContent {
  title: string
  body: string
  image?: string
}

const TEMPLATE_CONTENT_SCHEMAS: Record<NewsTemplate, z.ZodType<NewsTemplateContent>> = {
  split: newsSplitContentSchema,
  banner: newsBannerContentSchema,
  text: newsTextContentSchema,
  cover: newsCoverContentSchema,
}

function isNewsTemplate(value: unknown): value is NewsTemplate {
  return value === 'split' || value === 'banner' || value === 'text' || value === 'cover'
}

/** Templates that render nothing sensible without an image, so a missing image falls back to
 * `text` rather than being delivered as-is (AC5). `banner` is "optionally backed by an image" per
 * the contract and stays a banner without one, so it is deliberately not in this set. */
const TEMPLATES_REQUIRING_IMAGE: ReadonlySet<NewsTemplate> = new Set(['split', 'cover'])

/**
 * Whether a resolved template can be delivered with the fields it has.
 *
 * The content schemas keep `image` optional (see `newsSplitContentSchema`'s doc
 * comment) because a missing image is a fallback trigger, not a schema error. That
 * rule is spelled out here instead: `split` and `cover` have nothing to render without an image, so
 * they fall back to `text`. `banner` is "optionally backed by an image" per the contract and stays
 * a banner without one.
 */
function templateIsSatisfied(template: NewsTemplate, image: string | undefined): boolean {
  return !TEMPLATES_REQUIRING_IMAGE.has(template) || image !== undefined
}

function parseOrder(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * A visibility bound. `at: undefined` means "no bound on this side" - which is both
 * the missing-field case and, deliberately, the malformed-date case: a feed with a
 * typo in `visibleUntil` shows its entry rather than hiding it silently. The
 * malformed case is reported through `malformed` so the caller still gets a warning.
 */
function parseBound(value: string | undefined): { at: number | undefined; malformed: boolean } {
  if (value === undefined || value.trim() === '') return { at: undefined, malformed: false }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return { at: undefined, malformed: true }
  return { at: parsed, malformed: false }
}

/**
 * AC6, in this order: drop malformed buttons, then drop off-allowlist hosts, then
 * cap what is left at three. Filter-then-cap, so an entry with five buttons of which
 * two point somewhere off-allowlist still delivers three - counting the rejected ones
 * against the cap would silently swallow a valid button as well.
 */
function sanitizeButtons(raw: unknown, warn: (reason: string) => void): NewsButton[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    warn('buttons is not a list; no buttons delivered')
    return []
  }

  const allowed: NewsButton[] = []
  for (const candidate of raw) {
    const parsed = newsButtonSchema.safeParse(candidate)
    if (!parsed.success) {
      warn('a button without a usable label/url pair was dropped')
      continue
    }
    if (!isAllowedButtonHost(parsed.data.url)) {
      warn(`button url is not https on an allowlisted host and was dropped: ${parsed.data.url}`)
      continue
    }
    allowed.push(parsed.data)
  }

  if (allowed.length > MAX_BUTTONS_PER_SLIDE) {
    warn(
      `${allowed.length - MAX_BUTTONS_PER_SLIDE} button(s) beyond the cap of ` +
        `${MAX_BUTTONS_PER_SLIDE} were dropped`,
    )
  }
  return allowed.slice(0, MAX_BUTTONS_PER_SLIDE)
}

interface ResolvedTemplate {
  template: NewsTemplate
  title: string
  body: string
  image?: string
}

/**
 * Step 5 of the per-entry order: the one folded decision. Answers the template to
 * deliver, or `undefined` when the entry has to be dropped - and in both cases a
 * single reason, never one warning per failed sub-check.
 */
function resolveTemplate(
  declared: string | undefined,
  title: string | undefined,
  body: string,
  image: string | undefined,
): { resolved: ResolvedTemplate | undefined; reason: string | undefined } {
  if (isNewsTemplate(declared)) {
    const candidate: Record<string, unknown> = { title, body }
    if (image !== undefined) candidate.image = image
    const parsed = TEMPLATE_CONTENT_SCHEMAS[declared].safeParse(candidate)
    if (parsed.success && templateIsSatisfied(declared, parsed.data.image)) {
      return {
        resolved: {
          template: declared,
          title: parsed.data.title,
          body: parsed.data.body,
          ...(parsed.data.image !== undefined ? { image: parsed.data.image } : {}),
        },
        reason: undefined,
      }
    }
  }

  // Either the template is unknown, or it is known but its own field set is not
  // satisfied (a `split` without an image being the case the story names). Both
  // arrive at the same question: can this still be a text slide?
  const asText = newsTextContentSchema.safeParse({ title, body })
  if (!asText.success) {
    return {
      resolved: undefined,
      reason:
        declared === undefined
          ? 'dropped: no template, and no title or body to fall back to a text slide'
          : `dropped: template "${declared}" could not be delivered and there is no title or body to fall back to a text slide`,
    }
  }

  return {
    resolved: { template: 'text', title: asText.data.title, body: asText.data.body },
    reason: !isNewsTemplate(declared)
      ? `unknown template ${declared === undefined ? '(none given)' : `"${declared}"`}; delivered as a text slide`
      : `template "${declared}" is missing the fields it needs; delivered as a text slide`,
  }
}

/**
 * Steps 1-6 of the file header's decision order: validates and resolves every index entry into a
 * slide, in the index's own stable order. Deliberately does not filter by visibility or sort by
 * `order` - see the file header and `news-service.ts`'s module comment for why the cache needs
 * exactly this, unfiltered, shape.
 */
export function resolveFeed({ index, documents }: ResolveFeedInput): BuildFeedResult {
  const warnings: NewsFeedWarning[] = []
  const parsedIndex = indexShapeSchema.safeParse(index)
  if (!parsedIndex.success) {
    warnings.push({
      reason:
        'the news index is not usable (expected { schemaVersion, entries: [...] }); no feed built',
    })
    return { slides: [], warnings, schemaAhead: false }
  }

  const rawVersion = parsedIndex.data.schemaVersion
  const schemaVersion =
    typeof rawVersion === 'number' && Number.isFinite(rawVersion) ? rawVersion : undefined
  if (schemaVersion === undefined) {
    warnings.push({
      reason:
        "the news index carries no numeric schemaVersion; assuming this launcher's own version",
    })
  }
  const schemaAhead = schemaVersion !== undefined && schemaVersion > NEWS_SCHEMA_VERSION

  const seenIds = new Set<string>()
  const kept: { slide: NewsSlide; position: number }[] = []

  parsedIndex.data.entries.forEach((rawEntry, position) => {
    const parsedEntry = indexEntrySchema.safeParse(rawEntry)
    if (!parsedEntry.success) {
      warnings.push({
        reason: `index entry at position ${position} has no usable id/file and was dropped`,
      })
      return
    }
    const { id, file } = parsedEntry.data
    const warn = (reason: string): void => {
      warnings.push({ id, file, reason })
    }

    if (seenIds.has(id)) {
      warn('duplicate id; the first entry with this id is kept and this one dropped')
      return
    }
    seenIds.add(id)

    const text = Object.prototype.hasOwnProperty.call(documents, file) ? documents[file] : undefined
    if (typeof text !== 'string') {
      warn('the document this entry names was not fetched; entry dropped')
      return
    }

    const parsedDocument = parseFrontmatter(text)
    if (!parsedDocument) {
      warn('frontmatter could not be read; entry dropped')
      return
    }
    const { data, body } = parsedDocument

    const { resolved, reason } = resolveTemplate(data.template, data.title, body, data.image)
    if (reason !== undefined) warn(reason)
    if (!resolved) return

    const order = parseOrder(data.order)
    if (order === undefined) {
      warn('no usable order value; this entry sorts after the ordered ones')
    }

    const from = parseBound(data.visibleFrom)
    if (from.malformed) warn(`visibleFrom is not a date and was ignored: ${data.visibleFrom}`)
    const until = parseBound(data.visibleUntil)
    if (until.malformed) warn(`visibleUntil is not a date and was ignored: ${data.visibleUntil}`)

    const buttons = sanitizeButtons(data.buttons, warn)

    kept.push({
      position,
      slide: {
        id,
        template: resolved.template,
        order: order ?? Number.MAX_SAFE_INTEGER,
        title: resolved.title,
        body: resolved.body,
        ...(resolved.image !== undefined ? { image: resolved.image } : {}),
        buttons,
        ...(data.visibleFrom !== undefined ? { visibleFrom: data.visibleFrom } : {}),
        ...(data.visibleUntil !== undefined ? { visibleUntil: data.visibleUntil } : {}),
      },
    })
  })

  // Unfiltered, index-stable order on purpose (Decisions (Sprint)): every slide that made it this
  // far is kept regardless of visibility window or `order` - `buildFeed()` below and every delivery
  // in `news-service.ts` apply `filterAndSortSlides()` against their own notion of "now".
  return { slides: kept.map((entry) => entry.slide), warnings, schemaAhead }
}

/**
 * `resolveFeed()` plus AC3's visibility window and AC4's `order` sort, both against `now`. Kept as a
 * thin wrapper for callers that want a fully-filtered-and-sorted feed in one call (this pipeline's
 * own tests, and any one-off use); `news-service.ts`'s cached-refresh path calls `resolveFeed()`
 * directly instead, precisely so the cache does not inherit this function's filtering.
 */
export function buildFeed({ index, documents, now }: BuildFeedInput): BuildFeedResult {
  const resolved = resolveFeed({ index, documents })
  return { ...resolved, slides: filterAndSortSlides(resolved.slides, now) }
}

/**
 * AC3 + AC4 over already-valid slides: drop anything outside `now`'s visibility window, then sort
 * what is left by `order` ascending, stable on the slides' own incoming order (which is why this
 * function must not reorder before filtering). Exported so `news-service.ts` can re-apply both
 * rules on every delivery against the *current* `now`, not just once at build time - a slide cached
 * days ago has to age out of the window even though `buildFeed()` is never called again for it
 * (Decisions (Sprint)).
 */
export function filterAndSortSlides(slides: NewsSlide[], now: Date): NewsSlide[] {
  const nowMs = now.getTime()
  return slides
    .filter((slide) => {
      const from = parseBound(slide.visibleFrom)
      const until = parseBound(slide.visibleUntil)
      if (from.at !== undefined && nowMs < from.at) return false
      if (until.at !== undefined && nowMs > until.at) return false
      return true
    })
    .map((slide, position) => ({ slide, position }))
    .sort((a, b) => a.slide.order - b.slide.order || a.position - b.position)
    .map((entry) => entry.slide)
}
