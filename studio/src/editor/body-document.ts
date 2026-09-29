/**
 * Story 023 D1: splits a news document into its frontmatter head and its body, and puts them back
 * together. The head is kept byte-for-byte so editing the body can never disturb the frontmatter.
 *
 * The fence rule is the mirrored parser's own (`parseFrontmatter`): the first line must be `---`
 * (trailing whitespace allowed), the next `---` line closes the block. A document with no such
 * block - missing or unterminated fence - has no head; the whole text is body.
 */
const FENCE = /^---\s*$/

export function splitDocument(text: string): { head: string; body: string } {
  const lines = text.split('\n')
  if (!FENCE.test(lines[0] ?? '')) return { head: '', body: text }

  let offset = lines[0].length + 1
  for (let i = 1; i < lines.length; i++) {
    offset += lines[i].length + 1
    if (FENCE.test(lines[i])) {
      // The closing line's own line ending is part of the head; at end of text there is none.
      const end = Math.min(offset, text.length)
      return { head: text.slice(0, end), body: text.slice(end) }
    }
  }
  return { head: '', body: text }
}

export function withBody(text: string, body: string): string {
  return splitDocument(text).head + body
}
