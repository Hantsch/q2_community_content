/**
 * Declared set of launcher files mirrored verbatim into `studio/src/launcher-core/`.
 *
 * This is the one place the mirrored file list lives. Both the sync command (story 005,
 * deliverable D3) and the drift check (story 006) import it — a rename in the launcher
 * becomes a reviewed one-line edit here instead of a silent guess.
 *
 * `source` is the launcher-relative path (relative to a `q2-launcher` checkout root).
 * `mirror` is this repository's relative path under `studio/src/launcher-core/`, preserving
 * the launcher-relative structure so relative imports between mirrored files keep resolving.
 */
export interface LauncherCoreManifestEntry {
  readonly source: string
  readonly mirror: string
}

function mirrorOf(source: string): string {
  return `studio/src/launcher-core/${source}`
}

function entry(source: string): LauncherCoreManifestEntry {
  return { source, mirror: mirrorOf(source) }
}

export const launcherCoreManifest: readonly LauncherCoreManifestEntry[] = [
  // Contract
  entry('src/shared/modules/home.ts'),
  entry('src/main/modules/home/news/feed-pipeline.ts'),
  entry('src/main/modules/home/news/frontmatter.ts'),

  // Rendering
  entry('src/renderer/src/modules/home/components/SlideBanner.tsx'),
  entry('src/renderer/src/modules/home/components/SlideCover.tsx'),
  entry('src/renderer/src/modules/home/components/SlideSplit.tsx'),
  entry('src/renderer/src/modules/home/components/SlideText.tsx'),
  entry('src/renderer/src/modules/home/components/SlideButtons.tsx'),
  entry('src/renderer/src/modules/home/components/resolveSlideTemplate.ts'),

  // Styles
  entry('src/renderer/src/styles/home-hero.css'),
  entry('src/renderer/src/styles/index.css'),
]
