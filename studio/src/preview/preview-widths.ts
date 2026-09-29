/**
 * The widths the slide preview can be switched between. Source: the launcher window's minimum
 * width is 940 and its default 1280; it is commonly maximised to 1920 (see
 * news/_templates/cover/README.md).
 */
export interface PreviewWidth {
  readonly px: number
  readonly note?: string
}

export const PREVIEW_WIDTHS: readonly PreviewWidth[] = [
  { px: 940, note: 'launcher minimum' },
  { px: 1280, note: 'launcher default' },
  { px: 1920 },
]

export const DEFAULT_PREVIEW_WIDTH = 1280
