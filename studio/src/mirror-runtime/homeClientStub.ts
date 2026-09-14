/**
 * Studio-owned stand-in for the launcher's `src/renderer/src/modules/home/client`.
 *
 * The mirrored `SlideButtons.tsx` imports `openSlideUrl` from `../client`, which in the launcher
 * is the Electron IPC client: it reaches `window.q2` (the preload bridge) at module load time and
 * pulls in the launcher's whole IPC contract. Neither exists in this browser-only studio, and
 * mirroring it would drag `shared/ipc.ts` and `shared/types/` into a content repository for one
 * side effect no acceptance criterion of story 008 observes. `launcherBoundary.ts` resolves that
 * import to this module instead - for mirrored importers only, so nothing under
 * `src/launcher-core/` is ever edited.
 *
 * Opening a URL is not a studio concern, so this is a no-op that reports success. It exports
 * exactly the one binding the mirrored source imports; `launcherBoundary.test.ts` derives that
 * surface from the mirrored file, so a re-sync that widens the import fails a test here instead
 * of failing silently at runtime.
 */

/** The success arm of the launcher's `Outcome<null>`, which is all a no-op can return. */
type OpenSlideUrlOutcome = { readonly ok: true; readonly value: null }

export function openSlideUrl(url: string): Promise<OpenSlideUrlOutcome> {
  void url
  return Promise.resolve({ ok: true, value: null })
}
