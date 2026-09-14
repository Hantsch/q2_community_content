import type { NewsSlide } from '@shared/modules/home'
import { newsImageUrl } from './newsImageUrl'

/**
 * One `NewsSlide` fixture per rendered template (`text`, `split`, `banner`, `cover`), for D3's
 * mirrored-render test (`mirroredSlides.test.tsx`). These are studio-authored fixtures, not
 * mirrored content - they exist only to drive the real, unmodified mirrored components with a
 * plausible slide shape.
 */

export const textSlideFixture: NewsSlide = {
  id: 'slide-text-welcome',
  template: 'text',
  order: 1,
  title: 'Welcome to the community hub',
  body: 'Find guides, mod spotlights and community events here, updated every week.',
  buttons: [],
}

export const splitSlideFixture: NewsSlide = {
  id: 'slide-split-mod-spotlight',
  template: 'split',
  order: 2,
  title: 'Mod spotlight: Arena Overhaul',
  body: 'A closer look at one of the most downloaded gameplay mods this month.',
  // A real file under news/img/ (review finding F7 - the previous placeholder name did not
  // exist on disk, which broke this slide's image on the live /mirror-check.html page).
  imageUrl: newsImageUrl('split-bootstrap.png'),
  buttons: [
    { label: 'View mod', url: 'https://github.com/example/arena-overhaul' },
    {
      label: 'Read changelog',
      url: 'https://raw.githubusercontent.com/example/arena-overhaul/main/CHANGELOG.md',
    },
  ],
}

export const bannerSlideFixture: NewsSlide = {
  id: 'slide-banner-event',
  template: 'banner',
  order: 3,
  title: 'Community game night this Friday',
  body: 'Join the weekly community game night - all skill levels welcome.',
  buttons: [{ label: 'RSVP', url: 'https://github.com/example/community/discussions/1' }],
}

/** Carries a real `imageUrl` (AC6's "a slide with an image") - a placeholder path for this
 * deliverable's jsdom tests; D5 wires the real dev-server mount later. */
export const coverSlideFixture: NewsSlide = {
  id: 'slide-cover-welcome',
  template: 'cover',
  order: 0,
  title: 'Welcome to Q2 Community Content',
  body: 'A community-run feed of news, mods and events for the Q2 launcher.',
  imageUrl: newsImageUrl('cover-community-welcome.png'),
  buttons: [
    { label: 'Get started', url: 'https://github.com/example/q2-community-content' },
    {
      label: 'Join the discussion',
      url: 'https://github.com/example/q2-community-content/discussions',
    },
    {
      label: 'Read the docs',
      url: 'https://raw.githubusercontent.com/example/q2-community-content/main/README.md',
    },
  ],
}

export const slideFixtures = [
  textSlideFixture,
  splitSlideFixture,
  bannerSlideFixture,
  coverSlideFixture,
]
