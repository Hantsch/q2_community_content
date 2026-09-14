/**
 * Text normalisation for the content-repo reader (story 010). Documents in `news/` may arrive
 * with a leading UTF-8 BOM (common from Windows editors) and either CRLF or lone-CR line
 * endings; downstream readers should only ever see LF and no BOM.
 */

const BOM = '﻿'

/** Strips a leading UTF-8 BOM, if present, and converts CRLF/CR line endings to LF. */
export function normaliseText(raw: string): string {
  const withoutBom = raw.startsWith(BOM) ? raw.slice(BOM.length) : raw
  return withoutBom.replace(/\r\n?/g, '\n')
}
