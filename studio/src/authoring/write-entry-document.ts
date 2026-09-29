/**
 * Lossless writer for a news entry document (frontmatter block + body).
 *
 * The mirrored `parseFrontmatter` silently ignores every line it does not understand (comments,
 * blank lines, unknown shapes), so re-serialising from parsed data would destroy them. This
 * writer instead edits the original text line by line: a line the patch does not name is copied
 * byte for byte, and every value it writes is chosen so that `parseFrontmatter` reads it back
 * exactly. As a final guard the whole result is parsed again and compared with the expected
 * entry; a mismatch is refused instead of written.
 */
import { parseFrontmatter, type ButtonLink } from '../contract/launcher-contract'

export interface EntryPatch {
  /** `null` removes the key; a string sets it. A key absent here keeps its line untouched. */
  fields?: Record<string, string | null>
  /** `null` removes the block; an array replaces it. Absent keeps it untouched. */
  buttons?: ButtonLink[] | null
  body?: string
}

export type WriteEntryResult = { ok: true; text: string } | { ok: false; reason: string }

// The line shapes `parseFrontmatter` understands, spelled the same way it spells them.
const DELIMITER = /^---\s*$/
const BUTTONS_LINE = /^\s*buttons:\s*$/
const LABEL_LINE = /^\s*-\s*label:\s*(.*)$/
const URL_LINE = /^\s*url:\s*(.*)$/
const SCALAR_LINE = /^([A-Za-z0-9_]+)(:\s*)(.*)$/
const KEY = /^[A-Za-z0-9_]+$/

type Wrap = (text: string) => string
const RAW: Wrap = (text) => text
const DOUBLE: Wrap = (text) => `"${text}"`
const SINGLE: Wrap = (text) => `'${text}'`

function styleOf(rawValue: string): Wrap {
  const trimmed = rawValue.trim()
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) return DOUBLE
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) return SINGLE
  return RAW
}

/** The first line built from `preferred`, raw, `"…"`, `'…'` that `readsBack` accepts. */
function encode(
  value: string,
  build: (text: string) => string,
  readsBack: (line: string) => boolean,
  preferred: Wrap = RAW,
): string | undefined {
  for (const wrap of [preferred, RAW, DOUBLE, SINGLE]) {
    const line = build(wrap(value))
    if (readsBack(line)) return line
  }
  return undefined
}

function scalarLine(key: string, separator: string, value: string, preferred?: Wrap) {
  return encode(
    value,
    (text) => (text === '' ? `${key}:` : `${key}${separator}${text}`),
    (line) => parseFrontmatter(`---\n${line}\n---\n`)?.data[key] === value,
    preferred,
  )
}

function buttonLines(buttons: ButtonLink[]): string[] | { failed: string } {
  const out: string[] = []
  for (const [index, { label, url }] of buttons.entries()) {
    const labelLine = encode(
      label,
      (text) => `  - label: ${text}`,
      (line) =>
        parseFrontmatter(`---\nbuttons:\n${line}\n    url: u\n---\n`)?.data.buttons?.[0]?.label ===
        label,
    )
    if (labelLine === undefined) return { failed: `buttons[${index}].label` }
    const urlLine = encode(
      url,
      (text) => `    url: ${text}`,
      (line) =>
        parseFrontmatter(`---\nbuttons:\n  - label: l\n${line}\n---\n`)?.data.buttons?.[0]?.url ===
        url,
    )
    if (urlLine === undefined) return { failed: `buttons[${index}].url` }
    out.push(labelLine, urlLine)
  }
  return out
}

function sameButtons(a: ButtonLink[], b: ButtonLink[]): boolean {
  return a.length === b.length && a.every((x, i) => x.label === b[i].label && x.url === b[i].url)
}

function canonical(data: Record<string, unknown>): string {
  return JSON.stringify(
    Object.keys(data)
      .sort()
      .map((key) => [key, data[key]]),
  )
}

/**
 * Where the parser sees scalars and `buttons:` blocks. A block's extent runs past the parser's
 * own stop over the lines that still belong to it textually (comments, indented lines, entries
 * after a comment), but never over a line the parser reads as a scalar.
 */
function layoutOf(lines: string[], closing: number) {
  const scalars = new Map<number, string>()
  const parserBlocks: { start: number; end: number }[] = []
  for (let i = 1; i < closing; i++) {
    if (BUTTONS_LINE.test(lines[i])) {
      let j = i + 1
      while (j < closing && LABEL_LINE.test(lines[j])) {
        j += URL_LINE.test(lines[j + 1] ?? '') ? 2 : 1
      }
      parserBlocks.push({ start: i, end: j })
      i = j - 1
      continue
    }
    const match = SCALAR_LINE.exec(lines[i])
    if (match) scalars.set(i, match[1])
  }
  const blocks = parserBlocks.map(({ start, end }) => {
    let k = end
    while (
      k < closing &&
      !scalars.has(k) &&
      !BUTTONS_LINE.test(lines[k]) &&
      (/^\s*#/.test(lines[k]) ||
        /^\s+\S/.test(lines[k]) ||
        LABEL_LINE.test(lines[k]) ||
        URL_LINE.test(lines[k]))
    ) {
      k++
    }
    return { start, end: k }
  })
  return { scalars, blocks }
}

export function writeEntryDocument(original: string, patch: EntryPatch): WriteEntryResult {
  const parsed = parseFrontmatter(original)
  const lines = original.split('\n')
  const closing = lines.findIndex((line, i) => i > 0 && DELIMITER.test(line))
  if (parsed === undefined || !DELIMITER.test(lines[0]) || closing === -1) {
    return { ok: false, reason: 'the document has no frontmatter block' }
  }

  const fields = patch.fields ?? {}
  for (const key of Object.keys(fields)) {
    if (!KEY.test(key) || key === 'buttons') {
      return { ok: false, reason: `"${key}" cannot be written as a frontmatter field` }
    }
  }

  const { scalars, blocks } = layoutOf(lines, closing)
  const lastLineOf = new Map<string, number>()
  for (const [index, key] of scalars) lastLineOf.set(key, index)

  const parsedButtons = parsed.data.buttons ?? []
  const buttons =
    patch.buttons === undefined ||
    (patch.buttons !== null && sameButtons(patch.buttons, parsedButtons))
      ? undefined
      : patch.buttons
  let entryLines: string[] = []
  if (buttons) {
    const built = buttonLines(buttons)
    if (!Array.isArray(built)) {
      return { ok: false, reason: `${built.failed} cannot be written so that it reads back` }
    }
    entryLines = built
  }

  const out: string[] = [lines[0]]
  const lastBlock = blocks.at(-1)
  for (let i = 1; i < closing; i++) {
    const block = blocks.find(({ start }) => start === i)
    if (block) {
      const region = lines.slice(block.start, block.end)
      if (buttons === undefined || (buttons !== null && block !== lastBlock)) {
        out.push(...region)
      } else {
        // Replaced or removed: every line that is not a button entry is kept, after the entries.
        const kept = region.slice(1).filter((l) => !LABEL_LINE.test(l) && !URL_LINE.test(l))
        if (buttons !== null) out.push(region[0], ...entryLines)
        out.push(...kept)
      }
      i = block.end - 1
      continue
    }

    const key = scalars.get(i)
    const value = key === undefined ? undefined : fields[key]
    if (key === undefined || value === undefined) {
      out.push(lines[i])
    } else if (value === null) {
      // removed: every occurrence goes, or an earlier shadowed one would surface
    } else if (lastLineOf.get(key) !== i || value === parsed.data[key]) {
      out.push(lines[i])
    } else {
      const [, , separator, rawValue] = SCALAR_LINE.exec(lines[i]) ?? []
      const spaced = /\s/.test(separator) ? separator : ': '
      const line = scalarLine(key, spaced, value, styleOf(rawValue))
      if (line === undefined) return { ok: false, reason: refusal(key) }
      out.push(line)
    }
  }

  for (const [key, value] of Object.entries(fields)) {
    if (value === null || lastLineOf.has(key)) continue
    const line = scalarLine(key, ': ', value)
    if (line === undefined) return { ok: false, reason: refusal(key) }
    out.push(line)
  }
  if (buttons && lastBlock === undefined) out.push('buttons:', ...entryLines)
  out.push(lines[closing])

  const body = patch.body?.trim()
  const text =
    body === undefined || body === parsed.body
      ? [...out, ...lines.slice(closing + 1)].join('\n')
      : `${out.join('\n')}\n${body === '' ? '' : `${body}\n`}`

  const expected: Record<string, unknown> = { ...parsed.data }
  for (const [key, value] of Object.entries(fields)) {
    if (value === null) delete expected[key]
    else expected[key] = value
  }
  if (buttons === null) delete expected.buttons
  else if (buttons) expected.buttons = buttons.map(({ label, url }) => ({ label, url }))
  const readBack = parseFrontmatter(text)
  if (
    readBack === undefined ||
    canonical(readBack.data) !== canonical(expected) ||
    readBack.body !== (body ?? parsed.body)
  ) {
    return { ok: false, reason: 'the written document would not read back as the patched entry' }
  }
  return { ok: true, text }
}

function refusal(key: string): string {
  return `the value of "${key}" cannot be written so that it reads back (a line break, say)`
}
