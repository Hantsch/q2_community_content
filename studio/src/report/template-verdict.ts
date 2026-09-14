/**
 * Story 011 D3: explains a template fallback in terms of the declared `image` value, and (the
 * one studio-decided finding in this story) flags a declared `image` absent from the repository's
 * own file listing.
 *
 * Per AC8 and the story's Decisions (Sprint) ("AC2 vs AC8, resolved"): the pipeline's own
 * `template-fallback` warning (see `feed-pipeline.ts`'s `resolveTemplate()`) never mentions
 * `image` at all, for either of its two reasons ("unknown template" or "missing the fields it
 * needs") - so `enrichTemplateFallbackMessage()` only appends what the pipeline's own wording
 * left out, it never rewrites or discards it. Whether an entry's declared `image` exists in the
 * repository is a fact this repo (not the mirrored pipeline) can check, so
 * `buildDeclaredImageMissingFinding()` is a separate, independently-computed `source: 'studio'`
 * finding - it never claims a fallback happened, since that would be the report deciding, which
 * AC8 forbids.
 */
import type { Finding } from './report-types'

/**
 * Enriches a `kind: 'template-fallback'` finding with the declared `image` value (or the fact
 * that none was declared). Any other finding is returned unchanged - this only ever touches the
 * one kind of finding the pipeline's own wording leaves image out of.
 */
export function enrichTemplateFallbackMessage(
  finding: Finding,
  declaredImage: string | undefined,
): Finding {
  if (finding.kind !== 'template-fallback') return finding

  const suffix =
    declaredImage === undefined ? '(no image declared)' : `(declared image: "${declaredImage}")`
  return { ...finding, message: `${finding.message} ${suffix}` }
}

/**
 * The one studio-decided finding in story 011: an entry's declared `image` is not among the
 * repository's own files. Returns `undefined` - no finding, not a finding stating "ok" - when
 * there is nothing to check (`images` was not supplied at all: the studio stays silent, not
 * wrong) or nothing wrong (no `image` was declared, or the declared one is present).
 *
 * Deliberately independent of whatever `enrichTemplateFallbackMessage()`/the pipeline decided
 * about the template for the same entry: a `split`/`cover` can fall back to `text` for its own
 * reasons *and* separately have a declared `image` this function flags, or have neither, or have
 * only one of the two - this never branches on the other's result.
 */
export function buildDeclaredImageMissingFinding(
  declaredImage: string | undefined,
  images: readonly { name: string; size: number }[] | undefined,
  entryId: string,
  file: string,
): Finding | undefined {
  if (images === undefined) return undefined
  if (declaredImage === undefined) return undefined
  if (images.some((image) => image.name === declaredImage)) return undefined

  return {
    severity: 'warning',
    kind: 'declared-image-missing',
    message: `declared image "${declaredImage}" not found`,
    entryId,
    file,
    source: 'studio',
  }
}
