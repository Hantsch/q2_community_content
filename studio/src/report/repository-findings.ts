/**
 * Repository-level findings across the `news/` tree (story 013, D1): the model plus the scan
 * adapter. Later deliverables (D2-D6) fill in `collectRepositoryFindings`'s actual logic; this
 * one only lays the shape and wires it to story 010's reader.
 *
 * Unlike story 011's `Finding` (`report-types.ts`), `RepositoryFinding` is its own type — it
 * shares only the `error | warning | info` severity vocabulary, not the type itself, because it
 * reports on the tree as a whole (duplicate ids, orphan images, ...) rather than on one entry's
 * declared-versus-delivered verdict.
 */

import type {
  ContentRepoDocument,
  ContentRepoDraft,
  ContentRepoImage,
  ContentRepoRead,
} from '../content-repo/read-content-repo'
import type { ReaderFinding } from '../content-repo/findings'
import {
  filterAndSortSlides,
  parseFrontmatter,
  resolveFeed,
  type NewsSlide,
} from '../contract/launcher-contract'
import {
  SAFE_NEWS_IMAGE_EXTENSIONS,
  isSafeDeclaredImagePath,
  isSafeNewsDocumentName,
} from '../contract/launcher-safe-names'

/**
 * This union is authoritative for story 013: each of D2-D6 fills in the case(s) it owns and must
 * not invent a kind outside this list. Extend it here first if a later D needs one this D1 did
 * not anticipate.
 */
export type RepositoryFindingKind =
  | 'duplicate-id'
  | 'order-collision'
  | 'draft'
  | 'orphan-image'
  | 'missing-document'
  | 'order-mismatch'
  | 'unsafe-name'

export type RepositoryFindingSeverity = 'error' | 'warning' | 'info'

export interface RepositoryFinding {
  readonly kind: RepositoryFindingKind
  readonly severity: RepositoryFindingSeverity
  readonly message: string
  readonly file?: string
  readonly id?: string
  readonly detail?: string
}

/**
 * The input `collectRepositoryFindings` works from. Built directly on story 010's real
 * `ContentRepoRead` shape: the raw index rows, the documents map, the drafts list, the
 * `news/img/` listing, and the reader's own findings (D4 lifts some of these into
 * `RepositoryFinding`s).
 *
 * D2 adds `resolvedFeed`: the mirrored pipeline's own `resolveFeed()` output (slides only, its
 * warnings are 010/011's business, not this one's) — the source of truth for AC5's "positions
 * [order-collision entries] actually take", never re-sorted or re-resolved here.
 *
 * This fix (AC5 rework) adds `deliveredFeed`: the mirrored `filterAndSortSlides(resolvedFeed, now)`
 * output — the actual delivered order/position, per the same "call the mirror again, never decide
 * ourselves" discipline story 011's `visibility-order.ts` already established for this exact
 * problem. `now` is the current wall-clock time at scan time (`new Date()`): unlike story 011's
 * report, which serves one caller-supplied evaluation instant, a repository-level scan has no
 * caller-supplied clock to thread through, so "the moment this scan ran" is the only meaningful
 * `now` for it.
 */
export interface RepositoryScan {
  /** `news/index.json`'s parsed `entries`, exactly as `ContentRepoRead.index.value` carries them —
   * left as `unknown` here since 010 deliberately does not validate the index's shape. */
  readonly indexValue: unknown
  /** Keyed by the exact `file` value the index used, same as `ContentRepoRead.documents`. */
  readonly documents: Readonly<Record<string, ContentRepoDocument>>
  readonly drafts: readonly ContentRepoDraft[]
  readonly images: readonly ContentRepoImage[]
  readonly readerFindings: readonly ReaderFinding[]
  /** The mirrored pipeline's own validated-but-unfiltered slide list (`resolveFeed()`'s `slides`),
   * in the index's own stable order — never sorted or filtered here (Decisions (Sprint)). */
  readonly resolvedFeed: readonly NewsSlide[]
  /** The mirrored pipeline's own `filterAndSortSlides(resolvedFeed, now)` output — the slides this
   * scan's `now` actually delivers, in delivered order. Used only to read off delivered position
   * (AC5); never re-sorted or re-filtered here. */
  readonly deliveredFeed: readonly NewsSlide[]
}

/**
 * Adapts story 010's real reader output into the shape this report works from. No guessing: every
 * field is a direct read of `ContentRepoRead`, except `resolvedFeed`/`deliveredFeed`, which are the
 * mirrored pipeline's own `resolveFeed()`/`filterAndSortSlides()` called on that same
 * index/documents pair — never a second parser or a second sort.
 */
export function toRepositoryScan(read: ContentRepoRead): RepositoryScan {
  const documentTexts: Record<string, string> = {}
  for (const [file, document] of Object.entries(read.documents)) {
    documentTexts[file] = document.text
  }
  const { slides } = resolveFeed({ index: read.index.value, documents: documentTexts })
  const deliveredFeed = filterAndSortSlides(slides, new Date())

  return {
    indexValue: read.index.value,
    documents: read.documents,
    drafts: read.drafts,
    images: read.images,
    readerFindings: read.findings,
    resolvedFeed: slides,
    deliveredFeed,
  }
}

/** One `news/index.json` row with a usable `id`/`file`, read straight off the raw index value —
 * mirrors `indexEntrySchema`'s own check (`z.string().trim().min(1)`) closely enough to decide
 * whether a row is a candidate at all, without validating anything else. A row failing this check
 * is already reported by 010/011 (missing/invalid index shape); it has nothing to add here. */
interface RawIndexRow {
  readonly id: string
  readonly file: string
  /** The row's own `order` value, exactly as authored — never validated by `resolveFeed()`'s
   * `indexEntrySchema` (the pipeline ignores it entirely; only the document's own frontmatter
   * `order` feeds a slide, see `feed-pipeline.ts`). Kept here, unparsed, only so D4 can compare it
   * against the document's declared order. `undefined` when the row carries no such field. */
  readonly order?: unknown
}

function extractIndexRows(indexValue: unknown): RawIndexRow[] {
  const entries = (indexValue as { entries?: unknown } | null | undefined)?.entries
  if (!Array.isArray(entries)) return []

  const rows: RawIndexRow[] = []
  for (const raw of entries as readonly unknown[]) {
    if (typeof raw !== 'object' || raw === null) continue
    const id = (raw as Record<string, unknown>).id
    const file = (raw as Record<string, unknown>).file
    if (typeof id !== 'string' || id.trim() === '') continue
    if (typeof file !== 'string' || file.trim() === '') continue
    rows.push({ id: id.trim(), file: file.trim(), order: (raw as Record<string, unknown>).order })
  }
  return rows
}

/** The `file` each id first appears with, in row order — the same "first row wins" rule the
 * pipeline itself applies when it drops a later duplicate (`feed-pipeline.ts`'s `seenIds`), used
 * here only to name the file a resolved slide's `id` belongs to (`NewsSlide` carries no `file`). */
function buildFileById(rows: readonly RawIndexRow[]): ReadonlyMap<string, string> {
  const fileById = new Map<string, string>()
  for (const row of rows) {
    if (!fileById.has(row.id)) fileById.set(row.id, row.file)
  }
  return fileById
}

/**
 * AC1: every row after the first to use a given `id` is a duplicate — detected on the reader's own
 * raw rows, not on `resolvedFeed`, because by the time the pipeline produces slides the duplicate
 * has already been silently dropped (Decisions (Sprint)). One `error` finding per discarded row,
 * naming both the row that is kept (first occurrence) and the row this finding is about.
 */
function collectDuplicateIdFindings(rows: readonly RawIndexRow[]): RepositoryFinding[] {
  const findings: RepositoryFinding[] = []
  const kept = new Map<string, RawIndexRow>()

  for (const row of rows) {
    const first = kept.get(row.id)
    if (!first) {
      kept.set(row.id, row)
      continue
    }

    findings.push({
      kind: 'duplicate-id',
      severity: 'error',
      message:
        `id "${row.id}" is already used by ${first.file}, which is kept; ` +
        `${row.file} uses the same id and is dropped`,
      id: row.id,
      file: row.file,
    })
  }

  return findings
}

/**
 * AC5: every resolved slide that shares its `order` with at least one other resolved slide is an
 * order collision, reported with the position `filterAndSortSlides()`'s stable sort actually
 * delivers it to — not an echo of the raw `order` value both entries already declared themselves
 * (that tells the author nothing new). This mirrors story 011's identical problem and its fix
 * (`visibility-order.ts`'s `buildOrderTieFindings`): grouping happens on `resolvedFeed` (so a
 * colliding pair is found regardless of whether either is delivered), but "who comes first" is
 * read off `deliveredFeed` — the mirrored `filterAndSortSlides()` output — never decided here.
 *
 * Entries with no usable declared order (the pipeline's `Number.MAX_SAFE_INTEGER` sentinel) are
 * excluded — they are already reported through the pipeline's own "no usable order value" warning,
 * and grouping them here would flag every such entry as colliding with every other one, which AC5
 * does not describe.
 *
 * A tie group can include a member `deliveredFeed` filtered out entirely (scheduled/expired via its
 * own `visibleFrom`/`visibleUntil` — a repository scan's slides are not exempt from that filter):
 * such a member is still reported as colliding (it does share the raw `order` value), but it is
 * never named "delivered first" or given a delivered position, since it has none. If no group
 * member is actually delivered, there is no real delivery-order collision to explain, so the group
 * is skipped.
 *
 * One `warning` finding per participant, each naming the order value, the other row(s) it collides
 * with, and — for a participant that is itself delivered — which delivered member comes first.
 */
function collectOrderCollisionFindings(
  resolvedFeed: readonly NewsSlide[],
  deliveredFeed: readonly NewsSlide[],
  fileById: ReadonlyMap<string, string>,
): RepositoryFinding[] {
  const groups = new Map<number, NewsSlide[]>()
  for (const slide of resolvedFeed) {
    if (slide.order === Number.MAX_SAFE_INTEGER) continue
    const group = groups.get(slide.order)
    if (group) group.push(slide)
    else groups.set(slide.order, [slide])
  }

  const findings: RepositoryFinding[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue

    const deliveredIndexOf = (id: string): number =>
      deliveredFeed.findIndex((candidate) => candidate.id === id)
    const deliveredMembers = group
      .map((slide) => ({ slide, deliveredIndex: deliveredIndexOf(slide.id) }))
      .filter((member) => member.deliveredIndex >= 0)
      .sort((a, b) => a.deliveredIndex - b.deliveredIndex)
    // No tied member is actually delivered - nothing collided in practice, so nothing to report.
    if (deliveredMembers.length === 0) continue
    const firstId = deliveredMembers[0].slide.id
    const firstFile = fileById.get(firstId) ?? 'unknown file'

    for (const slide of group) {
      const others = group
        .filter((candidate) => candidate.id !== slide.id)
        .map((candidate) => `"${candidate.id}" (${fileById.get(candidate.id) ?? 'unknown file'})`)
        .join(', ')

      const isDeliveredAtAll = deliveredIndexOf(slide.id) >= 0
      const position =
        slide.id === firstId
          ? 'delivered first among the tied entries'
          : isDeliveredAtAll
            ? `delivered after "${firstId}" (${firstFile})`
            : 'not delivered (filtered out), so not ranked'

      findings.push({
        kind: 'order-collision',
        severity: 'warning',
        message: `shares order ${slide.order} with ${others}; ${position}`,
        id: slide.id,
        file: fileById.get(slide.id),
      })
    }
  }

  return findings
}

/**
 * AC2: every `.md` under `news/` the index does not name is a draft. `RepositoryScan.drafts` is
 * already exactly this list - story 010's reader walks `news/` independently of the index and
 * excludes `news/_templates/` and `news/img/` by construction (AC7) - so this only maps each one
 * to a finding, never recomputes the set. `info`, explicitly not an error: an unindexed `.md` is
 * ordinary authoring-in-progress, not something wrong with the repository.
 */
function collectDraftFindings(drafts: readonly ContentRepoDraft[]): RepositoryFinding[] {
  return drafts.map((draft) => ({
    kind: 'draft',
    severity: 'info',
    message: `${draft.path} is not named by any news/index.json row (draft)`,
    file: draft.path,
  }))
}

/** The declared `image` value from one document's frontmatter, read with the mirrored
 * `parseFrontmatter()` - never a second parser (Decisions (Sprint), same precedent as
 * `build-news-report.ts`'s `buildDeclared()`). `undefined` when the document has no well-formed
 * frontmatter block or declares no `image` at all. Exported (D6) so the unsafe-name check reuses
 * this same reading, rather than a second frontmatter walk. */
export function declaredImageOf(documentText: string): string | undefined {
  const parsed = parseFrontmatter(documentText)
  return parsed?.data.image
}

/**
 * True when `declaredImage` (as authored in frontmatter, e.g. `img/foo.png` - the convention this
 * repository's own real documents use) points at `image`. Accepts the real convention (`img/`
 * prefix), the bare filename, and the full repo-relative path, so a document that declares any of
 * those three spellings still counts as a reference.
 */
function declaredImageMatches(declaredImage: string, image: ContentRepoImage): boolean {
  const trimmed = declaredImage.trim()
  return trimmed === image.name || trimmed === image.path || trimmed === `img/${image.name}`
}

/**
 * AC3: a file in `news/img/` that no document's declared `image` field points at is an orphan -
 * the launcher only ever fetches an image because some entry's `image` names it, so a file no
 * entry names is one it never fetches. Reported once per image, as a flat list (Decisions
 * (Sprint)) - not grouped by anything. Only `scan.documents` (the index's own entries) are
 * consulted, never `scan.drafts`: a draft is not a delivered entry, so its `image` declares
 * nothing the launcher would ever act on.
 */
function collectOrphanImageFindings(
  documents: Readonly<Record<string, ContentRepoDocument>>,
  images: readonly ContentRepoImage[],
): RepositoryFinding[] {
  const declaredImages: string[] = []
  for (const document of Object.values(documents)) {
    const declared = declaredImageOf(document.text)
    if (declared !== undefined) declaredImages.push(declared)
  }

  const findings: RepositoryFinding[] = []
  for (const image of images) {
    const referenced = declaredImages.some((declared) => declaredImageMatches(declared, image))
    if (referenced) continue

    findings.push({
      kind: 'orphan-image',
      severity: 'info',
      message: `${image.path} is not referenced by any entry's declared image; the launcher never fetches it`,
      file: image.path,
    })
  }

  return findings
}

/**
 * AC6, first half: lifted straight from story 010's own `missing-document` reader finding
 * (`read-content-repo.ts`'s `readDocuments`) rather than re-detected here, so the reader's answer
 * and this report's can never disagree about what is missing (Decisions (Sprint)). `error`
 * severity, per the story's severity list ("duplicate id and a missing document are error").
 */
function collectMissingDocumentFindings(
  readerFindings: readonly ReaderFinding[],
): RepositoryFinding[] {
  return readerFindings
    .filter((finding) => finding.code === 'missing-document')
    .map((finding) => ({
      kind: 'missing-document' as const,
      severity: 'error' as const,
      message: finding.message,
      file: finding.path,
    }))
}

/**
 * AC6, second half: an index row's own `order` value disagreeing with the document it names'
 * frontmatter `order` is a `warning`, not an `error` — the index decides the feed per the contract
 * (Decisions (Sprint)), so a stale row is a note to fix rather than something broken. Only checked
 * for rows with a matching document (a missing one is already `collectMissingDocumentFindings`'s
 * business), and only when both sides carry a usable numeric order — an entry with no order at all
 * is already 011's own "no usable order value" warning, not a disagreement.
 */
function collectOrderMismatchFindings(
  rows: readonly RawIndexRow[],
  documents: Readonly<Record<string, ContentRepoDocument>>,
): RepositoryFinding[] {
  const findings: RepositoryFinding[] = []

  for (const row of rows) {
    const document = documents[row.file]
    if (!document) continue

    const parsed = parseFrontmatter(document.text)
    const frontmatterOrder = parsed?.data.order
    if (frontmatterOrder === undefined) continue
    if (row.order === undefined) continue

    const indexOrderNumber = Number(row.order)
    const frontmatterOrderNumber = Number(frontmatterOrder)
    if (!Number.isFinite(indexOrderNumber) || !Number.isFinite(frontmatterOrderNumber)) continue
    if (indexOrderNumber === frontmatterOrderNumber) continue

    findings.push({
      kind: 'order-mismatch',
      severity: 'warning',
      message:
        `${row.file}: news/index.json declares order ${indexOrderNumber} but the document's ` +
        `frontmatter declares order ${frontmatterOrder}`,
      id: row.id,
      file: row.file,
    })
  }

  return findings
}

/** `ContentRepoDraft.path` carries the `news/` prefix (e.g. `news/sub/draft.md`); index rows and
 * `ContentRepoDocument` keys never do (they are the index's own `file` value, e.g. `sub/draft.md`).
 * Stripped here so both are tested against `isSafeNewsDocumentName()` on the same footing. */
const NEWS_PATH_PREFIX = 'news/'

function stripNewsPrefix(path: string): string {
  return path.startsWith(NEWS_PATH_PREFIX) ? path.slice(NEWS_PATH_PREFIX.length) : path
}

/**
 * AC4, document-rule half: every distinct name a `.md` document is known by — an index row's own
 * `file`, a document's key in `scan.documents`, or a draft's path (`news/`-stripped, see
 * `stripNewsPrefix`) — is fed through the launcher's own `isSafeNewsDocumentName()`. Collected into
 * one map keyed by the tested name first, so a name reachable from more than one of those three
 * angles (the ordinary case: an index row's `file` is also a `scan.documents` key) still produces
 * exactly one finding (Decisions (Sprint): no literal duplicates for the same name+rule pair).
 */
function collectUnsafeDocumentNameFindings(
  rows: readonly RawIndexRow[],
  documents: Readonly<Record<string, ContentRepoDocument>>,
  drafts: readonly ContentRepoDraft[],
): RepositoryFinding[] {
  const candidates = new Map<string, { readonly file: string; readonly id?: string }>()

  for (const row of rows) {
    if (!candidates.has(row.file)) candidates.set(row.file, { file: row.file, id: row.id })
  }
  for (const file of Object.keys(documents)) {
    if (!candidates.has(file)) candidates.set(file, { file })
  }
  for (const draft of drafts) {
    const name = stripNewsPrefix(draft.path)
    if (!candidates.has(name)) candidates.set(name, { file: draft.path })
  }

  const findings: RepositoryFinding[] = []
  for (const [name, candidate] of candidates) {
    if (isSafeNewsDocumentName(name)) continue

    findings.push({
      kind: 'unsafe-name',
      severity: 'error',
      message: `${candidate.file} is not a safe document name; the launcher would refuse to fetch it`,
      detail: `the document rule refuses "${name}"`,
      file: candidate.file,
      id: candidate.id,
    })
  }

  return findings
}

/** The extension `SAFE_NEWS_IMAGE_EXTENSIONS` checks against, lower-cased; `undefined` for a name
 * with no `.` beyond position 0 (no extension, or a dotfile). */
function extensionOf(name: string): string | undefined {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : undefined
}

function hasAllowedImageExtension(name: string): boolean {
  const extension = extensionOf(name)
  return (
    extension !== undefined && (SAFE_NEWS_IMAGE_EXTENSIONS as readonly string[]).includes(extension)
  )
}

/**
 * AC4, image half: declared `image` values (read the same way `collectOrphanImageFindings` does,
 * via the shared `declaredImageOf()`) and every file under `news/img/` are fed through the
 * launcher's own `isSafeDeclaredImagePath()` — the path-segment rule. A `news/img/` file is tested
 * as it would be declared (`img/<name>`, the convention `declaredImageMatches` already assumes),
 * so the same rule applies to both angles on the same footing. `news/img/` files also get a second,
 * independent check the declared side does not: their extension must be one of
 * `SAFE_NEWS_IMAGE_EXTENSIONS` (`isSafeNewsImageFileName()` is deliberately not used — Decisions
 * (Sprint) — since that predicate asserts the *cache* file-name shape, a 64-hex-digit name, not the
 * author-facing one these are). One finding per offending name and broken rule; a name reachable
 * from more than one angle (a declared image that also happens to equal a `news/img/` entry's
 * `img/<name>` form) still produces one path-segment finding, not two.
 */
function collectUnsafeImageFindings(
  documents: Readonly<Record<string, ContentRepoDocument>>,
  images: readonly ContentRepoImage[],
): RepositoryFinding[] {
  const findings: RepositoryFinding[] = []
  const checkedPathSegments = new Set<string>()

  const pushPathSegmentFinding = (declared: string, file: string): void => {
    if (checkedPathSegments.has(declared)) return
    checkedPathSegments.add(declared)
    if (isSafeDeclaredImagePath(declared)) return

    findings.push({
      kind: 'unsafe-name',
      severity: 'error',
      message: `${file} is not a safe image path; the launcher would refuse to fetch it`,
      detail: `the path-segment rule refuses "${declared}"`,
      file,
    })
  }

  for (const document of Object.values(documents)) {
    const declared = declaredImageOf(document.text)
    if (declared === undefined) continue
    pushPathSegmentFinding(declared.trim(), declared.trim())
  }

  for (const image of images) {
    pushPathSegmentFinding(`img/${image.name}`, image.path)

    if (hasAllowedImageExtension(image.name)) continue
    findings.push({
      kind: 'unsafe-name',
      severity: 'error',
      message: `${image.path} does not have an extension the launcher allows`,
      detail: `the extension allowlist refuses "${image.name}"`,
      file: image.path,
    })
  }

  return findings
}

export function collectRepositoryFindings(scan: RepositoryScan): RepositoryFinding[] {
  const rows = extractIndexRows(scan.indexValue)
  const fileById = buildFileById(rows)

  return [
    ...collectDuplicateIdFindings(rows),
    ...collectOrderCollisionFindings(scan.resolvedFeed, scan.deliveredFeed, fileById),
    ...collectDraftFindings(scan.drafts),
    ...collectOrphanImageFindings(scan.documents, scan.images),
    ...collectMissingDocumentFindings(scan.readerFindings),
    ...collectOrderMismatchFindings(rows, scan.documents),
    ...collectUnsafeDocumentNameFindings(rows, scan.documents, scan.drafts),
    ...collectUnsafeImageFindings(scan.documents, scan.images),
  ]
}
