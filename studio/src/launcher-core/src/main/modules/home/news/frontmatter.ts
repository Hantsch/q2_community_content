/**
 * Story 082 D2: a hand-written, restricted-subset frontmatter reader.
 *
 * Deliberately not a YAML parser - the repo has no YAML dependency, and the
 * input is foreign network text (fetched community news documents), so a
 * full YAML surface is more attack surface than the contract needs. This
 * only understands:
 *   - a leading `---` block, closed by a second `---` on its own line
 *   - `key: value` scalars inside that block (quotes stripped from the value)
 *   - one `buttons:` list, each entry a `- label: ...` line followed by a
 *     `  url: ...` line
 * Anything else inside the block is ignored, not an error.
 */

export interface ButtonLink {
  label: string
  url: string
}

export interface ParsedFrontmatter {
  data: Record<string, string> & { buttons?: ButtonLink[] }
  body: string
}

const DELIMITER = /^---\s*$/

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

/**
 * Parses a `- label: ...` / `  url: ...` pair starting at `index`. Returns
 * the parsed button and the next index to continue scanning from, or
 * `undefined` if the entry at `index` isn't a button entry at all (caller
 * should stop the buttons list there).
 *
 * A malformed entry - missing `label` or `url` - is dropped rather than
 * failing the whole document (this story's general "drop the bad part, keep
 * going" philosophy for defensive parsing of foreign network data).
 */
function parseButtonEntry(
  lines: string[],
  index: number,
): { button: ButtonLink | undefined; next: number } | undefined {
  const labelLine = lines[index]
  const labelMatch = labelLine.match(/^\s*-\s*label:\s*(.*)$/)
  if (!labelMatch) return undefined

  let next = index + 1
  let url: string | undefined
  const urlLine = lines[next]
  if (urlLine !== undefined) {
    const urlMatch = urlLine.match(/^\s*url:\s*(.*)$/)
    if (urlMatch) {
      url = stripQuotes(urlMatch[1])
      next += 1
    }
  }

  const label = stripQuotes(labelMatch[1])
  const button = label && url ? { label, url } : undefined
  return { button, next }
}

/**
 * Parses a leading YAML-like frontmatter block from `text`.
 *
 * Returns `undefined` when the block is missing entirely (the whole text
 * has no leading `---` block at all) or unterminated (an opening `---` with
 * no matching closing `---`). Both are treated as malformed input, not as
 * "the whole text is body" - a document without a well-formed frontmatter
 * block carries no reliable `id`/`order`/etc., so the feed pipeline (D3)
 * cannot use it as a news entry.
 *
 * A valid block followed immediately by end of string, or only whitespace,
 * is a normal case and yields `body: ''`.
 */
export function parseFrontmatter(text: string): ParsedFrontmatter | undefined {
  const normalized = text.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  if (!DELIMITER.test(lines[0] ?? '')) return undefined

  let closingIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (DELIMITER.test(lines[i])) {
      closingIndex = i
      break
    }
  }
  if (closingIndex === -1) return undefined

  const data: Record<string, string> & { buttons?: ButtonLink[] } = {}

  for (let i = 1; i < closingIndex; i++) {
    const line = lines[i]

    if (/^\s*buttons:\s*$/.test(line)) {
      const buttons: ButtonLink[] = []
      let j = i + 1
      while (j < closingIndex) {
        const parsed = parseButtonEntry(lines, j)
        if (!parsed) break
        if (parsed.button) buttons.push(parsed.button)
        j = parsed.next
      }
      data.buttons = buttons
      i = j - 1
      continue
    }

    const scalarMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (scalarMatch) {
      data[scalarMatch[1]] = stripQuotes(scalarMatch[2])
    }
    // anything else in the block is ignored
  }

  const body = lines.slice(closingIndex + 1).join('\n').trim()

  return { data, body }
}
