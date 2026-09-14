/**
 * The content-repository reader (story 010, D2): turns a working tree of this repository into
 * everything the studio needs to say something about it — the raw `news/index.json`, the text of
 * every document the index names, the text of every `.md` the index does *not* name (drafts), and
 * a finding for every fact that would also break the launcher's own fetch.
 *
 * Two properties make this module what it is:
 *
 * - **It never throws and never gives up half-way.** A missing or unparseable `index.json` is a
 *   finding, and the drafts walk still runs and still returns its files (AC3). A document that is
 *   named but refused or absent is a finding and *no* entry at all — never an empty document
 *   (AC4/AC6), because an empty document would be indistinguishable from a genuinely empty file
 *   for stories 011/013.
 * - **It only ever reads.** `readFileSync` / `readdirSync` / `statSync`, never a write, a `mkdir`
 *   or a delete (AC5).
 *
 * Non-goals, on purpose: this module does not validate the index's *shape*. A parsed index whose
 * `entries` is missing or is not an array simply names no documents; saying whether that is legal
 * belongs to story 011's declared-vs-delivered report, which gets the parsed `value` verbatim.
 */
import { type Dirent, readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'

import type { ReaderFinding } from './findings'
import { resolveInsideNews, resolveRepoRoot } from './paths'
import { normaliseText } from './text'

const NEWS_DIR_NAME = 'news'
const INDEX_FILE_NAME = 'index.json'
const INDEX_REPO_PATH = `${NEWS_DIR_NAME}/${INDEX_FILE_NAME}`
const IMG_DIR_NAME = 'img'
const TEMPLATES_DIR_NAME = '_templates'

/** Directories directly under `news/` that are never walked for drafts. */
const SKIPPED_TOP_LEVEL_DIRECTORIES = new Set([IMG_DIR_NAME, TEMPLATES_DIR_NAME])

/** The raw `news/index.json` as found on disk. */
export interface ContentRepoIndexRead {
  /** Normalised raw text, exactly as read (empty when the file could not be read at all). */
  readonly text: string
  /** `JSON.parse`'s result when parsing succeeded, `undefined` otherwise. */
  readonly value: unknown
  /** True only when the file was read *and* parsed; when false, `findings` says why. */
  readonly parsed: boolean
}

/** A `.md` document the index names, read from disk. */
export interface ContentRepoDocument {
  /** Normalised document text (BOM stripped, CRLF/CR → LF). */
  readonly text: string
}

/** A `.md` file under `news/` that the index does not name. */
export interface ContentRepoDraft {
  /** Repository-relative path with forward slashes, e.g. `news/sub/draft.md`. */
  readonly path: string
  /** Normalised document text (BOM stripped, CRLF/CR → LF). */
  readonly text: string
}

/** A direct file entry under `news/img/` (non-recursive). */
export interface ContentRepoImage {
  /** The filename alone, e.g. `picture.png`. */
  readonly name: string
  /** Repository-relative path with forward slashes, e.g. `news/img/picture.png`. */
  readonly path: string
  /** File size in bytes, via `statSync`. */
  readonly bytes: number
}

/** Everything one read of the working tree produced. */
export interface ContentRepoRead {
  /** The root the read was performed against — echoed back so callers can report paths. */
  readonly repoRoot: string
  readonly index: ContentRepoIndexRead
  /** Keyed by the exact `file` value the index used, never by the resolved absolute path. */
  readonly documents: Readonly<Record<string, ContentRepoDocument>>
  readonly drafts: readonly ContentRepoDraft[]
  /** A flat, non-recursive listing of `news/img/`; empty when that directory does not exist. */
  readonly images: readonly ContentRepoImage[]
  readonly findings: readonly ReaderFinding[]
}

export interface ReadContentRepoOptions {
  /** Defaults to the real checkout root; tests point it at a fixture tree. */
  readonly repoRoot?: string
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
}

/**
 * Key used to decide whether a walked file was already claimed by the index. Absolute and
 * resolved, so `a.md`, `./a.md` and `sub/../a.md` all claim the same file; case-folded on Windows
 * because `A.md` in the index and `a.md` on disk are the same file there and would otherwise be
 * reported as a document *and* a draft.
 */
function claimKey(absolutePath: string): string {
  const resolved = resolve(absolutePath)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

/**
 * True when `absolutePath` falls inside `news/img/` or `news/_templates/`. `resolveInsideNews`
 * only guarantees a path stays inside `news/` as a whole; the index must not be able to smuggle
 * an image or a template into `documents` by naming one of those subtrees directly (AC7).
 */
function isUnderSkippedDirectory(absolutePath: string, newsDir: string): boolean {
  const key = claimKey(absolutePath)
  for (const dirName of SKIPPED_TOP_LEVEL_DIRECTORIES) {
    const dirKey = claimKey(join(newsDir, dirName)) + sep
    if (key.startsWith(dirKey)) return true
  }
  return false
}

function error(code: string, message: string, path?: string): ReaderFinding {
  return path === undefined
    ? { code, severity: 'error', message }
    : { code, severity: 'error', message, path }
}

/** Reads and parses `news/index.json`; every failure is a finding, never a throw. */
function readIndex(newsDir: string, findings: ReaderFinding[]): ContentRepoIndexRead {
  let raw: string
  try {
    raw = readFileSync(join(newsDir, INDEX_FILE_NAME), 'utf8')
  } catch (cause) {
    findings.push(
      isNotFound(cause)
        ? error(
            'index-missing',
            `${INDEX_REPO_PATH}: not found (${messageOf(cause)})`,
            INDEX_REPO_PATH,
          )
        : error('index-unreadable', `${INDEX_REPO_PATH}: ${messageOf(cause)}`, INDEX_REPO_PATH),
    )
    return { text: '', value: undefined, parsed: false }
  }

  const text = normaliseText(raw)
  try {
    return { text, value: JSON.parse(text) as unknown, parsed: true }
  } catch (cause) {
    // The parser's own message is the useful part — it carries the position of the syntax error.
    findings.push(
      error('index-unparseable', `${INDEX_REPO_PATH}: ${messageOf(cause)}`, INDEX_REPO_PATH),
    )
    return { text, value: undefined, parsed: false }
  }
}

interface RawIndexEntry {
  readonly file?: unknown
}

interface RawIndex {
  readonly entries?: unknown
}

/** The `file` values the parsed index names, in index order; anything else is ignored here. */
function namedFiles(indexValue: unknown): string[] {
  const entries = (indexValue as RawIndex | undefined)?.entries
  if (!Array.isArray(entries)) return []

  const files: string[] = []
  for (const entry of entries as readonly RawIndexEntry[]) {
    const file = entry?.file
    if (typeof file === 'string' && file.trim() !== '') files.push(file)
  }
  return files
}

/**
 * Reads every document the index names. A refused path is never touched on disk, and neither a
 * refused nor an absent nor an unreadable document ever produces an entry — only a finding.
 * Returns the claim keys of the documents that were genuinely read, which is all the drafts walk
 * needs to know about the index.
 */
function readDocuments(
  newsDir: string,
  indexValue: unknown,
  documents: Record<string, ContentRepoDocument>,
  findings: ReaderFinding[],
): Set<string> {
  const claimed = new Set<string>()

  for (const file of namedFiles(indexValue)) {
    const resolution = resolveInsideNews(newsDir, file)
    if (!resolution.ok) {
      findings.push(
        error(
          'unsafe-document-path',
          `${INDEX_REPO_PATH} names a document outside news/ and it was not read: ${resolution.reason}`,
          file,
        ),
      )
      continue
    }

    if (isUnderSkippedDirectory(resolution.absolutePath, newsDir)) {
      findings.push(
        error(
          'unsafe-document-path',
          `${INDEX_REPO_PATH} names ${file}, which is under news/${IMG_DIR_NAME}/ or news/${TEMPLATES_DIR_NAME}/ and is never returned as a document`,
          file,
        ),
      )
      continue
    }

    const repoPath = `${NEWS_DIR_NAME}/${file}`
    let isFile: boolean
    try {
      isFile = statSync(resolution.absolutePath).isFile()
    } catch (cause) {
      findings.push(
        isNotFound(cause)
          ? error(
              'missing-document',
              `${repoPath}: named by ${INDEX_REPO_PATH} but not found on disk`,
              repoPath,
            )
          : error('unreadable-document', `${repoPath}: ${messageOf(cause)}`, repoPath),
      )
      continue
    }

    if (!isFile) {
      findings.push(
        error(
          'missing-document',
          `${repoPath}: named by ${INDEX_REPO_PATH} but is not a file`,
          repoPath,
        ),
      )
      continue
    }

    let text: string
    try {
      text = normaliseText(readFileSync(resolution.absolutePath, 'utf8'))
    } catch (cause) {
      findings.push(error('unreadable-document', `${repoPath}: ${messageOf(cause)}`, repoPath))
      continue
    }

    documents[file] = { text }
    claimed.add(claimKey(resolution.absolutePath))
  }

  return claimed
}

/**
 * Walks `news/` recursively for `.md` files that no document claimed. Deliberately independent of
 * the index: it needs only the set of claimed files, so a broken index yields an empty claim set
 * and every `.md` still comes back as a draft (AC3).
 */
function walkDrafts(
  newsDir: string,
  claimed: ReadonlySet<string>,
  findings: ReaderFinding[],
): ContentRepoDraft[] {
  const drafts: ContentRepoDraft[] = []

  const visit = (absoluteDir: string, relativeDir: string): void => {
    const repoDirPath = relativeDir === '' ? NEWS_DIR_NAME : `${NEWS_DIR_NAME}/${relativeDir}`
    let entries: Dirent[]
    try {
      entries = readdirSync(absoluteDir, { withFileTypes: true })
    } catch (cause) {
      findings.push(
        error('unreadable-directory', `${repoDirPath}: ${messageOf(cause)}`, repoDirPath),
      )
      return
    }

    // Sorted by raw name (not locale-aware) so a read is byte-for-byte reproducible across
    // platforms and filesystems.
    const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

    for (const entry of sorted) {
      const relative = relativeDir === '' ? entry.name : `${relativeDir}/${entry.name}`
      const absolute = join(absoluteDir, entry.name)

      if (entry.isDirectory()) {
        // Only the two top-level directories are skipped; a nested `img/` inside a post folder is
        // an ordinary folder. Symlinked directories report `false` here and are never followed,
        // which also rules out link cycles.
        if (relativeDir === '' && SKIPPED_TOP_LEVEL_DIRECTORIES.has(entry.name)) continue
        visit(absolute, relative)
        continue
      }

      if (!entry.isFile()) continue
      if (extname(entry.name).toLowerCase() !== '.md') continue
      if (claimed.has(claimKey(absolute))) continue

      const repoPath = `${NEWS_DIR_NAME}/${relative}`
      try {
        drafts.push({ path: repoPath, text: normaliseText(readFileSync(absolute, 'utf8')) })
      } catch (cause) {
        findings.push(error('unreadable-draft', `${repoPath}: ${messageOf(cause)}`, repoPath))
      }
    }
  }

  visit(newsDir, '')
  return drafts
}

/**
 * Lists the direct file entries of `news/img/` — never recursing into subdirectories. A missing
 * `img/` folder is not a failure: it simply yields an empty list, no finding.
 */
function listImages(newsDir: string): ContentRepoImage[] {
  const imgDir = join(newsDir, IMG_DIR_NAME)

  let entries: Dirent[]
  try {
    entries = readdirSync(imgDir, { withFileTypes: true })
  } catch {
    return []
  }

  const images: ContentRepoImage[] = []
  for (const entry of [...entries].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )) {
    if (!entry.isFile()) continue

    const absolute = join(imgDir, entry.name)
    let bytes: number
    try {
      bytes = statSync(absolute).size
    } catch {
      continue
    }

    images.push({ name: entry.name, path: `${NEWS_DIR_NAME}/${IMG_DIR_NAME}/${entry.name}`, bytes })
  }

  return images
}

/**
 * Reads the `news/` tree of a working copy of this repository. Synchronous, read-only and
 * never throwing: every failure it meets is reported in `findings`.
 */
export function readContentRepo(options: ReadContentRepoOptions = {}): ContentRepoRead {
  const repoRoot = options.repoRoot ?? resolveRepoRoot()
  const newsDir = join(repoRoot, NEWS_DIR_NAME)

  const findings: ReaderFinding[] = []
  const documents: Record<string, ContentRepoDocument> = {}

  const index = readIndex(newsDir, findings)
  const claimed = readDocuments(newsDir, index.value, documents, findings)
  const drafts = walkDrafts(newsDir, claimed, findings)
  const images = listImages(newsDir)

  return { repoRoot, index, documents, drafts, images, findings }
}

export type ReadTemplateFileResult =
  { readonly ok: true; readonly text: string } | { readonly ok: false; readonly reason: string }

/**
 * Reads a single file from `news/_templates/<relativePath>` — the only entry point that may look
 * inside `_templates/`, since the main walk skips it entirely (see `SKIPPED_TOP_LEVEL_DIRECTORIES`).
 * Reuses `resolveInsideNews`'s path guard against the templates directory itself, so the same
 * escape rules (no absolute paths, no `..`, no drive letters, no UNC) apply here too. Never throws:
 * a refused or missing file comes back as `{ ok: false, reason }`.
 */
export function readTemplateFile(
  relativePath: string,
  options: ReadContentRepoOptions = {},
): ReadTemplateFileResult {
  const repoRoot = options.repoRoot ?? resolveRepoRoot()
  const newsDir = join(repoRoot, NEWS_DIR_NAME)
  const templatesDir = join(newsDir, TEMPLATES_DIR_NAME)

  const resolution = resolveInsideNews(templatesDir, relativePath)
  if (!resolution.ok) {
    return { ok: false, reason: resolution.reason }
  }

  try {
    const isFile = statSync(resolution.absolutePath).isFile()
    if (!isFile) {
      return { ok: false, reason: `${relativePath}: not a file` }
    }
  } catch (cause) {
    return { ok: false, reason: `${relativePath}: ${messageOf(cause)}` }
  }

  try {
    const text = normaliseText(readFileSync(resolution.absolutePath, 'utf8'))
    return { ok: true, text }
  } catch (cause) {
    return { ok: false, reason: `${relativePath}: ${messageOf(cause)}` }
  }
}
