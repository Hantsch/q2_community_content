import { SlideBanner } from '../launcher-core/src/renderer/src/modules/home/components/SlideBanner'
import { SlideCover } from '../launcher-core/src/renderer/src/modules/home/components/SlideCover'
import { SlideSplit } from '../launcher-core/src/renderer/src/modules/home/components/SlideSplit'
import { SlideText } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'
import { resolveSlideTemplate } from '../launcher-core/src/renderer/src/modules/home/components/resolveSlideTemplate'
import type { SlideTemplateProps } from '../launcher-core/src/renderer/src/modules/home/components/SlideText'

/** Template name -> mirrored slide component; shared by the mirror-check page and the preview frame. */
export const TEMPLATE_COMPONENTS = {
  text: SlideText,
  split: SlideSplit,
  banner: SlideBanner,
  cover: SlideCover,
} as const satisfies Record<
  ReturnType<typeof resolveSlideTemplate>,
  (props: SlideTemplateProps) => React.JSX.Element
>
