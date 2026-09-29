/**
 * Story 018 D1: the slide preview's model. Pure, data in and data out, and it never throws — the
 * same discipline as `library-model.ts`.
 *
 * The previewed slide is never rebuilt from what an entry `declared`: it is the slide the launcher's
 * own pipeline (`resolveFeed()`) resolves from the same read, so what the author sees is what the
 * launcher would render — trimmed titles, allow-listed buttons, downgraded templates and all.
 */
import { resolveFeed, type NewsSlide } from '../contract/launcher-contract'
import { toNewsReportInput } from '../content-types/descriptors'
import type { ContentSourceRead } from '../content-types/descriptor'
import { thumbnailUrlFor } from '../library/use-news-library'
import type { ContentReport } from '../report/report-types'

export type SlidePreviewModel =
  | { state: 'idle' }
  | { state: 'slide'; slide: NewsSlide & { imageUrl?: string } }
  | { state: 'nothing'; reason: string }

export interface BuildSlidePreviewModelInput {
  read: ContentSourceRead | null
  report: ContentReport | null
  entryId: string | null
}

/** A declared image is `img/<file>`; the read lists bare file names. */
function bareName(image: string): string {
  return image.split('/').pop() ?? image
}

const NOT_IN_INDEX = 'Not in news/index.json — the launcher does not show it.'
const DROPPED_FALLBACK = 'The launcher drops this entry.'

function nothing(reason: string): SlidePreviewModel {
  return { state: 'nothing', reason }
}

function build({ read, report, entryId }: BuildSlidePreviewModelInput): SlidePreviewModel {
  if (entryId === null || read === null || report === null) return { state: 'idle' }

  const verdict = report.entries.find((entry) => entry.id === entryId)
  if (!verdict) return nothing(NOT_IN_INDEX)

  if (verdict.delivered === 'dropped') {
    const reasons = verdict.findings
      .filter((finding) => finding.severity === 'error')
      .map((finding) => finding.message)
    return nothing(reasons.length > 0 ? reasons.join('; ') : DROPPED_FALLBACK)
  }

  const { visibility } = verdict
  if (visibility.state === 'scheduled') {
    return nothing(`Scheduled — the launcher shows it from ${visibility.visibleFrom}.`)
  }
  if (visibility.state === 'expired') {
    return nothing(`Expired — the launcher stopped showing it at ${visibility.visibleUntil}.`)
  }

  // `resolveFeed()` reads no clock, so the read's own `now` is irrelevant here.
  const { index, documents } = toNewsReportInput(read, new Date(0))
  const slide = resolveFeed({ index, documents }).slides.find(
    (candidate) => candidate.id === entryId,
  )
  if (!slide) return nothing(DROPPED_FALLBACK)

  // Resolved slides never carry the raw `image` path (`NewsSlide.image` doc), so the reference
  // comes from the verdict's declared side; the slide itself stays the pipeline's.
  const image = verdict.declared.image
  const imageInRepository =
    image !== undefined && read.images.some((entry) => entry.name === bareName(image))
  const imageUrl = imageInRepository ? thumbnailUrlFor({ image }) : undefined
  return { state: 'slide', slide: imageUrl === undefined ? slide : { ...slide, imageUrl } }
}

export function buildSlidePreviewModel(input: BuildSlidePreviewModelInput): SlidePreviewModel {
  try {
    return build(input)
  } catch {
    return { state: 'idle' }
  }
}
