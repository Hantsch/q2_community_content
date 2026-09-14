/**
 * The one door into the mirrored launcher contract (`src/launcher-core/`).
 *
 * Story 007 D2 (AC5): every other studio module that needs a contract rule - the news feed
 * pipeline, the button host allowlist, the button cap - imports it from here, never directly
 * from `src/launcher-core/` or via the `@shared/*` alias. That keeps a later re-sync of the
 * mirror to a single import site, and is what lets D4's guard test forbid every other import.
 *
 * Pure re-export only: no rule logic lives in this file. Adding a computation here would be
 * exactly the "rule re-implemented outside the mirror" this story exists to prevent.
 */
export {
  buildFeed,
  resolveFeed,
  filterAndSortSlides,
  MAX_BUTTONS_PER_SLIDE,
} from '../launcher-core/src/main/modules/home/news/feed-pipeline'
export type { NewsFeedWarning } from '../launcher-core/src/main/modules/home/news/feed-pipeline'
export { parseFrontmatter } from '../launcher-core/src/main/modules/home/news/frontmatter'
export type {
  ParsedFrontmatter,
  ButtonLink,
} from '../launcher-core/src/main/modules/home/news/frontmatter'
export {
  NEWS_BUTTON_HOST_ALLOWLIST,
  isAllowedButtonHost,
  newsButtonSchema,
} from '@shared/modules/home'
export type { NewsSlide, NewsTemplate, NewsButton } from '@shared/modules/home'
