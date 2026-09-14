/**
 * Story 015, D2: the shared contract between the file bridge's server middleware and its future
 * browser client. Nothing in here does any work — it only names the route prefix and the JSON
 * shapes the routes exchange, so the server and the client (D3/D4) cannot drift apart on either.
 */
import type { ContentRepoRead } from '../content-repo/read-content-repo'

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

/** The body of every non-2xx response a bridge route returns. */
export interface BridgeErrorResponse {
  readonly error: string
}
