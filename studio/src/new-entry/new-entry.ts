/**
 * Story 025 D1: the pure core of "new entry from a template". Turns the kit's own `template.md`
 * text into the starting text of a new entry, and answers the two questions that must be settled
 * before a file may be created - is the name usable, and does it collide with something already
 * in `news/`. No IO and no `node:` import: the caller supplies the template text and the rows.
 *
 * The kit stays the single source of starter content. Nothing here knows what a placeholder says;
 * a placeholder is recognised by its `<...>` shape only.
 */
import { isSafeNewsDocumentName } from '../contract/launcher-safe-names'
import type { LibraryRow } from '../library/library-types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Any valid date works: only the shape of the whole file name is being checked. */
const PROBE_DATE = '2000-01-01'

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && isSafeNewsDocumentName(newEntryFileName(PROBE_DATE, slug))
}

export function newEntryFileName(date: string, slug: string): string {
  return `${date}-${slug}.md`
}

/** A refusal carries the existing row so the UI can name its title and file. */
export type NewEntryConflict =
  | { readonly kind: 'file-exists'; readonly existing: LibraryRow }
  | { readonly kind: 'id-collision'; readonly existing: LibraryRow }

function baseName(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1)
}

function draftSlug(file: string): string {
  return baseName(file)
    .replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .replace(/\.md$/, '')
}

export function findNewEntryConflict(args: {
  fileName: string
  slug: string
  rows: readonly LibraryRow[]
}): NewEntryConflict | undefined {
  const { fileName, slug, rows } = args
  const sameFile = rows.find((row) => baseName(row.file) === fileName)
  if (sameFile) return { kind: 'file-exists', existing: sameFile }
  const sameId = rows.find((row) =>
    row.status === 'draft' ? draftSlug(row.file) === slug : row.id === slug,
  )
  if (sameId) return { kind: 'id-collision', existing: sameId }
  return undefined
}

function splitLines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) ?? []
}

function content(line: string): string {
  return line.replace(/\r?\n$/, '')
}

/** Double quotes only when the launcher's reader would otherwise change or misread the value. */
function titleValue(title: string): string {
  const clean = title.replace(/\s+/g, ' ').trim()
  if (clean === '') return ''
  const needsQuotes = /[:#]/.test(clean) || /^["']/.test(clean) || /["']$/.test(clean)
  return needsQuotes ? `"${clean}"` : clean
}

export function buildNewEntryText(templateText: string, title: string): string {
  const out: string[] = []
  const body: string[] = []
  let state: 'before' | 'frontmatter' | 'body' = 'before'

  for (const line of splitLines(templateText)) {
    const text = content(line)
    if (state === 'before') {
      out.push(line)
      if (/^---\s*$/.test(text)) state = 'frontmatter'
    } else if (state === 'frontmatter') {
      if (/^---\s*$/.test(text)) {
        out.push(line)
        state = 'body'
        continue
      }
      const match = /^([A-Za-z][\w-]*):[ \t]*(.*)$/.exec(text)
      const eol = line.slice(text.length)
      if (match && match[1] === 'title') {
        const value = titleValue(title)
        out.push(`title:${value === '' ? '' : ' ' + value}${eol}`)
      } else if (match && /<[^>]*>/.test(match[2])) {
        out.push(`${match[1]}:${eol}`)
      } else {
        out.push(line)
      }
    } else {
      body.push(line)
    }
  }

  // Body: drop every paragraph that is a <...> placeholder, then any leading blank lines.
  const kept: string[] = []
  let paragraph: string[] = []
  const flush = (): void => {
    const joined = paragraph.map(content).join('\n').trim()
    if (!(joined.startsWith('<') && joined.endsWith('>'))) kept.push(...paragraph)
    paragraph = []
  }
  for (const line of body) {
    if (content(line).trim() === '') {
      flush()
      kept.push(line)
    } else {
      paragraph.push(line)
    }
  }
  flush()
  while (kept.length > 0 && content(kept[0]).trim() === '') kept.shift()

  return out.join('') + kept.join('')
}
