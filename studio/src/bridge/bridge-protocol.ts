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
  /**
   * Story 025 D2: create-only mode. `writes` must then hold exactly one item with
   * `expected: null`; the file is created exclusively (an existing file answers `409`) and no
   * parent directory is created.
   */
  readonly createOnly?: true
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

/**
 * Story 026 D1: why `POST /__studio/fs/image?name=<file name>` refused an image. `unsafe-name`,
 * `extension`, `too-large`, `exists` and `confinement` are checked in that order before anything
 * touches disk; `origin` and `content-type` guard the request itself; `write-failed` is an I/O
 * failure on the one exclusive create.
 */
export type ImageRefusalRule =
  | 'origin'
  | 'content-type'
  | 'unsafe-name'
  | 'extension'
  | 'too-large'
  | 'exists'
  | 'confinement'
  | 'write-failed'

/** Non-2xx answer of the image route; `error` starts with the rule's name. */
export interface BridgeImageRefusalResponse extends BridgeErrorResponse {
  readonly rule: ImageRefusalRule
}

/** `201` answer of the image route. */
export interface BridgeImageWriteResponse {
  /** Repo-relative path written, e.g. `news/img/cover.png`. */
  readonly path: string
  /** The value an entry's `image` field takes, e.g. `img/cover.png`. */
  readonly image: string
}

/**
 * What `addNewsImage()` resolves to; it never throws. `network` means the request never got an
 * answer; `http` means an answer without an image-route rule (e.g. a Host guard refusal).
 */
export type AddNewsImageResult =
  | { readonly ok: true; readonly image: string }
  | {
      readonly ok: false
      readonly rule: ImageRefusalRule | 'network' | 'http'
      readonly error: string
    }

/** What `client.createFile()` resolves to; it never throws. */
export type BridgeCreateResult =
  { readonly ok: true } | { readonly ok: false; readonly status: number; readonly message: string }
