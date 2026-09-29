/**
 * The launcher's limits for a news image, restated for the studio.
 *
 * Source: q2-launcher `src/main/modules/home/images/fetch-image.ts:95-98`. These constants are not
 * mirrored into `launcher-core/` because that file imports Electron, which neither the studio's
 * browser bundle nor its dev-server code can load. Browser-safe on purpose: no imports at all, so
 * both the app and the Node-side file bridge (loaded by Vite's plain config loader) can use it.
 */

/** Largest image file the launcher accepts: 5 MiB. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Largest width or height, in pixels, the launcher accepts. */
export const MAX_IMAGE_DIMENSION_PX = 4000
