/**
 * Studio-owned stand-in for the bare `node:fs/promises` specifier, for importers inside the
 * mirrored `src/launcher-core/` tree only.
 *
 * `fs-utils.ts`, `images/paths.ts` and `images/image-cache.ts` import `access`, `mkdir`, `readdir`,
 * `realpath`, `rename`, `stat`, `writeFile` and `unlink` from `node:fs/promises` at module top
 * level. Under Vite's browser build the real module is externalized to a `Proxy` that throws on
 * any property access, so merely importing one of those names throws at module-evaluation time -
 * see `nodePathStub.ts`'s doc comment for the full mechanism. `launcherBoundary.ts` redirects the
 * bare specifier here instead.
 *
 * Unlike the path stub, these are not pure data: every one of them is a real filesystem operation,
 * and the studio never performs Electron-main-process file I/O client-side - it reads repository
 * files only through the dev-server-mediated bridge (`studio/src/bridge/`), never through this
 * mirrored code path. So each export below is a function that throws a clear error the moment it
 * is actually *called*; a silent no-op would instead hide a real bug by pretending an unsupported
 * operation quietly succeeded. Nothing on the studio's reachable paths (`isSafeDeclaredImagePath()`
 * et al.) calls any of these - if one ever throws in practice, that is a signal a future change
 * wired up a codepath that still expects real Electron-main file I/O.
 */

function unavailable(name: string): never {
  throw new Error(
    `node:fs/promises.${name}() is not available in the browser studio - this mirrored ` +
      'Electron-main-process function must never run client-side.',
  )
}

export function access(): Promise<void> {
  unavailable('access')
}

export function mkdir(): Promise<string | undefined> {
  unavailable('mkdir')
}

export function readdir(): Promise<unknown[]> {
  unavailable('readdir')
}

export function realpath(): Promise<string> {
  unavailable('realpath')
}

export function rename(): Promise<void> {
  unavailable('rename')
}

export function stat(): Promise<unknown> {
  unavailable('stat')
}

export function writeFile(): Promise<void> {
  unavailable('writeFile')
}

export function unlink(): Promise<void> {
  unavailable('unlink')
}
