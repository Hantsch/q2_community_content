/**
 * Story 015, D2: the shared contract between the file bridge's server middleware and its future
 * browser client. Nothing in here does any work — it only names the route prefix and the JSON
 * shapes the routes exchange, so the server and the client (D3/D4) cannot drift apart on either.
 */
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { MirrorProvenance } from '../mirror/provenance'

/** Every bridge route lives under this prefix; nothing else in the dev server does. */
export const BRIDGE_PREFIX = '/__studio/fs/'

/**
 * `GET /__studio/fs/read?type=<directory>` — the repository-wide reader's result, sent back
 * verbatim as the response body (not wrapped under a key).
 */
export type BridgeReadResponse = ContentRepoRead

/** `GET /__studio/fs/file?path=<repo-relative>` — a single guarded text file. */
export interface BridgeFileResponse {
  /** The repo-relative path that was requested, echoed back. */
  readonly path: string
  readonly text: string
}

/**
 * `GET /__studio/fs/provenance` — story 017 D4. No query parameters at all: this route always
 * answers `readMirrorProvenance(repoRoot)` for the bridge's own constructor-bound `repoRoot`, so
 * (unlike `read`/`file`) it takes no path input and cannot widen story 015 AC3's confinement.
 */
export type BridgeProvenanceResponse = MirrorProvenance

/** One file to write. `expected` is the LF-normalised disk text the edit was based on; `null` means
 * the file must not exist yet. */
export interface BridgeWriteItem {
  readonly path: string
  readonly text: string
  readonly expected: string | null
}

/** `POST /__studio/fs/write` request body. */
export interface BridgeWriteRequest {
  readonly writes: readonly BridgeWriteItem[]
}

/** `200` answer: the repo-relative paths written, in request order. */
export interface BridgeWriteResponse {
  readonly written: readonly string[]
}

/** `409` answer: the disk text no longer matches `expected` for `path`; nothing was written. */
export interface BridgeWriteConflictResponse extends BridgeErrorResponse {
  readonly path: string
  /** The current LF-normalised disk text, or `null` when the file does not exist. */
  readonly current: string | null
}

/** `500` answer: an I/O failure part-way through; `written` succeeded before `failed` did. */
export interface BridgeWriteFailureResponse extends BridgeErrorResponse {
  readonly written: readonly string[]
  readonly failed: string
}

/** What `client.write()` resolves to; it never throws. */
export type BridgeWriteResult =
  | { readonly ok: true; readonly written: readonly string[] }
  | {
      readonly ok: false
      readonly status: number
      readonly error: string
      readonly path?: string
      readonly current?: string | null
      readonly written?: readonly string[]
      readonly failed?: string
    }

/** The body of every non-2xx response a bridge route returns. */
export interface BridgeErrorResponse {
  readonly error: string
}
