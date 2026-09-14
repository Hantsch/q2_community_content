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

  // Safe names
  //
  // Story 013 D5: the import closure of the launcher's two safe-name predicates,
  // `isSafeNewsDocumentName()` (`news/feed-fetcher.ts`) and `isSafeDeclaredImagePath()`
  // (`images/resolve-feed-images.ts`), plus the extension allowlist in `images/paths.ts`.
  //
  // The story named eight files; six are here. The two missing ones are both imports of
  // `resolve-feed-images.ts` that only its download-and-cache path (`resolveOneImage()` ->
  // `resolveFeedImages()`) ever touches - never `isSafeDeclaredImagePath()` - and each is
  // redirected to a studio-owned stub by the same mechanism `./harness` and `../client` already
  // use, so the mirror stays verbatim and is never hand-edited (`src/mirror-runtime/
  // launcherBoundary.ts`, `tsconfig.json`'s `rootDirs`):
  //   - `images/fetch-image.ts` does `await import('electron')` for `nativeImage`. Mirroring it
  //     would put an Electron import inside a content repository, which D5 forbids outright.
  //   - `lib/renderer-source.ts` builds a `Response` from a Node `Buffer`. The launcher checks its
  //     main process with `lib: ["ES2023"]`/`types: ["node"]`, where `BodyInit` accepts a `Buffer`;
  //     this repository must check the same file against the browser `lib` its studio app needs,
  //     where `BufferSource` is `ArrayBufferView<ArrayBuffer>` and `Buffer<ArrayBufferLike>` is not
  //     assignable. The file is correct - the two programs' type environments simply differ, and
  //     nothing here can reconcile them without editing the mirror.
  entry('src/main/modules/home/news/feed-fetcher.ts'),
  entry('src/main/lib/content-repo.ts'),
  entry('src/main/lib/fs-utils.ts'),
  entry('src/main/modules/home/images/paths.ts'),
  entry('src/main/modules/home/images/image-cache.ts'),
  entry('src/main/modules/home/images/resolve-feed-images.ts'),

  // Rendering
  entry('src/renderer/src/modules/home/components/SlideBanner.tsx'),
  entry('src/renderer/src/modules/home/components/SlideCover.tsx'),
  entry('src/renderer/src/modules/home/components/SlideSplit.tsx'),
  entry('src/renderer/src/modules/home/components/SlideText.tsx'),
  entry('src/renderer/src/modules/home/components/SlideButtons.tsx'),
  entry('src/renderer/src/modules/home/components/resolveSlideTemplate.ts'),

  // Rendering support
  entry('src/renderer/src/components/ui/Button.tsx'),
  entry('src/renderer/src/lib/cn.ts'),

  // Styles
  entry('src/renderer/src/styles/home-hero.css'),
  entry('src/renderer/src/styles/index.css'),
  entry('src/renderer/src/styles/surfaces.css'),
  entry('src/renderer/src/styles/controls-grid.css'),
  entry('src/renderer/src/styles/config-syntax.css'),
  entry('src/renderer/src/styles/dashboard.css'),
]
