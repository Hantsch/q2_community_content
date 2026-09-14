/**
 * Studio-owned stand-in for the bare `node:fs` specifier (not `node:fs/promises` - see
 * `nodeFsPromisesStub.ts` for that one), for importers inside the mirrored `src/launcher-core/`
 * tree only.
 *
 * `fs-utils.ts` imports only `constants` from `node:fs`, to pass as the mode flag to
 * `access(target, FS.F_OK)` / `access(target, FS.W_OK)`. Under Vite's browser build the real
 * `node:fs` is externalized to a `Proxy` that throws on any property access, so even reading
 * `constants` off it throws at module-evaluation time - see `nodePathStub.ts`'s doc comment for
 * the full mechanism. `launcherBoundary.ts` redirects the bare specifier here instead.
 *
 * These are plain numeric flags, not filesystem access, so - like the path stub - this computes a
 * real, correct value rather than throwing: copying Node's own documented constants is harmless
 * and lets `fs-utils.ts`'s own throw-on-call `access`/`stat`/... calls (redirected to
 * `nodeFsPromisesStub.ts`) be the single, honest point where "this would touch the filesystem" is
 * reported.
 */

/** Node's documented values (`fs.constants`), not reimplemented, just restated - so this repository
 * has no dependency on `node:fs` to read them. */
export const constants = {
  F_OK: 0,
  X_OK: 1,
  W_OK: 2,
  R_OK: 4,
} as const
