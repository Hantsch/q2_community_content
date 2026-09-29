/**
 * Story 023 D1: lints a slide body. The launcher renders the body as plain text, so markdown
 * syntax shows up literally on the slide, and an empty body makes the launcher drop the entry.
 * Deliberately conservative and hand-written: a false positive is only a dismissible warning, but
 * snake_case, a lone `*` and a plain `<` / `&` in prose must stay clean.
 */
export type BodyFinding = {
  code: 'empty-body' | 'literal-markdown'
  severity: 'error' | 'warning'
  construct?: string
  line?: number
  message: string
}

/** Constructs anchored at the start of a line; a matching line yields one finding and is done. */
const LINE_RULES: Array<[string, RegExp]> = [
  ['horizontal rule', /^\s*(---|\*\*\*)\s*$/],
  ['fenced code', /^\s*```/],
  ['heading', /^\s*#{1,6}\s/],
  ['list item', /^\s*([-*+]|\d+\.)\s/],
  ['blockquote', /^\s*>\s/],
]

/** Constructs that may occur anywhere in a line, once per occurrence. */
const INLINE_RULES: Array<[string, RegExp]> = [
  ['bold', /\*\*[^*\s][^*\n]*\*\*|(?<!\w)__[^_\s][^_\n]*__(?!\w)/g],
  ['italic', /(?<![*\w])\*[^*\s][^*\n]*\*(?![*\w])|(?<!\w)_[^_\s](?:[^_\n]*[^_\s])?_(?!\w)/g],
  ['strikethrough', /~~[^~\n]+~~/g],
  ['inline code', /`[^`\n]+`/g],
  ['image', /!\[[^\]\n]*\]\([^)\n]+\)/g],
  ['link', /(?<!!)\[[^\]\n]+\]\([^)\n]+\)/g],
  ['autolink', /<https?:\/\/[^>\s]+>/g],
  ['HTML tag', /<\/?(?!https?:)[A-Za-z][^<>\n]*>/g],
  ['HTML entity', /&(?:#\d+|#[xX][0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]*);/g],
]

function literal(construct: string, line: number): BodyFinding {
  return {
    code: 'literal-markdown',
    severity: 'warning',
    construct,
    line,
    message: `${construct} is not rendered by the launcher — these characters appear literally on the slide`,
  }
}

export function lintBody(body: string): BodyFinding[] {
  if (body.trim() === '') {
    return [
      {
        code: 'empty-body',
        severity: 'error',
        message: 'The body is empty — the launcher drops the entry and shows nothing.',
      },
    ]
  }

  const findings: BodyFinding[] = []
  body.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1
    const lineRule = LINE_RULES.find(([, pattern]) => pattern.test(text))
    if (lineRule) findings.push(literal(lineRule[0], line))
    if (lineRule && (lineRule[0] === 'horizontal rule' || lineRule[0] === 'fenced code')) return
    for (const [construct, pattern] of INLINE_RULES) {
      findings.push(...Array.from(text.matchAll(pattern), () => literal(construct, line)))
    }
  })
  return findings
}
