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

/** The body of every non-2xx response a bridge route returns. */
export interface BridgeErrorResponse {
  readonly error: string
}
