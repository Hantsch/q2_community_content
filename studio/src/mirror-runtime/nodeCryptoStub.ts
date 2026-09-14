/**
 * Studio-owned stand-in for the bare `node:crypto` specifier, for importers inside the mirrored
 * `src/launcher-core/` tree only.
 *
 * `images/paths.ts` imports `createHash` from `node:crypto` at module top level, to content-address
 * cached image file names. Under Vite's browser build the real module is externalized to a `Proxy`
 * that throws on any property access, so merely importing `createHash` throws at
 * module-evaluation time - see `nodePathStub.ts`'s doc comment for the full mechanism.
 * `launcherBoundary.ts` redirects the bare specifier here instead.
 *
 * The studio never runs the launcher's image-caching path client-side (see
 * `nodeFsPromisesStub.ts`), so - same reasoning as that stub - this throws a clear error the
 * moment it is actually called, rather than computing a browser-side hash that would let a caller
 * silently believe the real cache-naming scheme ran.
 */

export function createHash(): never {
  throw new Error(
    'node:crypto.createHash() is not available in the browser studio - this mirrored ' +
      'Electron-main-process function must never run client-side.',
  )
}
