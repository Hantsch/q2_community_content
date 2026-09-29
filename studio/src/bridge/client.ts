/**
 * Story 015, D4: the browser-side file bridge client — the `ContentTypeSource` implementation that
 * `StudioPage` binds into the registry once D3's dev-server route exists to answer it. Browser-safe
 * on purpose (no `node:` import, checked by `tests/file-bridge-not-in-production.test.ts`'s reachable
 * -module scan): it only ever calls the injected `fetch` against a relative URL, so the browser
 * resolves it against the dev server's own origin.
 *
 * `read()` never throws. A network error, a non-2xx response or an unparseable JSON body all
 * collapse to the same well-formed, empty read `unavailableFileBridgeSource` (story 014 D1) already
 * establishes — one `severity: 'error'` finding naming what went wrong, so a caller never has to
 * special-case "the source itself failed" from "the read succeeded but found nothing".
 */
import type { ContentSourceRead, ContentTypeSource } from '../content-types/descriptor'
import {
  type AddNewsImageResult,
  BRIDGE_PREFIX,
  type BridgeCreateResult,
  type BridgeErrorResponse,
  type BridgeFileResponse,
  type BridgeImageRefusalResponse,
  type BridgeImageWriteResponse,
  type BridgeReadResponse,
  type BridgeWriteBatchConflictResponse,
  type BridgeWriteBatchRefusedResponse,
  type BridgeWriteBatchResult,
  type BridgeWriteFailureResponse,
  type BridgeWriteItem,
  type BridgeWriteResponse,
  type BridgeWriteResult,
} from './bridge-protocol'

export interface BridgeClient extends ContentTypeSource {
  /** `POST /__studio/fs/write`. Never throws: a failure resolves to `{ ok: false, ... }`. */
  write(writes: readonly BridgeWriteItem[]): Promise<BridgeWriteResult>
  /** `POST /__studio/fs/write-batch`: all files or none. Never throws. */
  writeBatch(files: readonly BridgeWriteItem[]): Promise<BridgeWriteBatchResult>
  /** Create-only `POST /__studio/fs/write`: never overwrites. Never throws. */
  createFile(path: string, text: string): Promise<BridgeCreateResult>
  /** `GET /__studio/fs/file`: one repository text file, or `undefined` when it cannot be read. */
  readText(path: string): Promise<string | undefined>
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Same shape `unavailableFileBridgeSource` returns — a well-formed, empty read plus one finding. */
function fallbackRead(directory: string, message: string): ContentSourceRead {
  return {
    repoRoot: '',
    index: { text: '', value: undefined, parsed: false },
    documents: {},
    drafts: [],
    images: [],
    findings: [
      {
        code: 'file-bridge-error',
        severity: 'error',
        message: `${directory}/ was not read: ${message}`,
        path: directory,
      },
    ],
  }
}

/** Best-effort extraction of a `BridgeErrorResponse`'s `error` string from a non-2xx response. */
async function errorBodyMessage(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Partial<BridgeErrorResponse>
    return typeof body.error === 'string' ? body.error : undefined
  } catch {
    return undefined
  }
}

/**
 * Story 026 D1: `POST /__studio/fs/image?name=<name>` with the raw image bytes. Never throws: a
 * refusal resolves to the route's `rule` and `error`, a request that got no answer to `network`,
 * and an answer without an image-route rule (e.g. a Host guard refusal) to `http`.
 */
export async function addNewsImage(
  name: string,
  bytes: Blob,
  fetchImpl: typeof fetch = fetch,
): Promise<AddNewsImageResult> {
  let response: Response
  try {
    response = await fetchImpl(`${BRIDGE_PREFIX}image?name=${encodeURIComponent(name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: bytes,
    })
  } catch (cause) {
    return { ok: false, rule: 'network', error: messageOf(cause) }
  }

  let body: Partial<BridgeImageWriteResponse & BridgeImageRefusalResponse>
  try {
    body = (await response.json()) as typeof body
  } catch {
    return { ok: false, rule: 'http', error: `HTTP ${response.status}` }
  }
  if (response.ok && typeof body.image === 'string') {
    return { ok: true, image: body.image }
  }
  return {
    ok: false,
    rule: typeof body.rule === 'string' ? body.rule : 'http',
    error: typeof body.error === 'string' ? body.error : `HTTP ${response.status}`,
  }
}

/**
 * Creates a `ContentTypeSource` backed by the local file bridge's `GET /__studio/fs/read` route.
 * `fetchImpl` defaults to the global `fetch` and is injectable for tests, the same style
 * `read-content-repo.ts` injects `repoRoot`.
 */
export function createBridgeClient(fetchImpl: typeof fetch = fetch): BridgeClient {
  return {
    async read(directory: string): Promise<ContentSourceRead> {
      let response: Response
      try {
        response = await fetchImpl(`${BRIDGE_PREFIX}read?type=${encodeURIComponent(directory)}`)
      } catch (cause) {
        return fallbackRead(directory, messageOf(cause))
      }

      if (!response.ok) {
        const detail = await errorBodyMessage(response)
        return fallbackRead(directory, detail ?? `HTTP ${response.status}`)
      }

      try {
        return (await response.json()) as BridgeReadResponse
      } catch (cause) {
        return fallbackRead(directory, messageOf(cause))
      }
    },

    async write(writes: readonly BridgeWriteItem[]): Promise<BridgeWriteResult> {
      let response: Response
      try {
        response = await fetchImpl(`${BRIDGE_PREFIX}write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ writes }),
        })
      } catch (cause) {
        return { ok: false, status: 0, error: messageOf(cause) }
      }

      let body: unknown
      try {
        body = await response.json()
      } catch (cause) {
        return {
          ok: false,
          status: response.status,
          error: response.ok ? messageOf(cause) : `HTTP ${response.status}`,
        }
      }

      if (response.ok) {
        return { ok: true, written: (body as BridgeWriteResponse).written }
      }
      const failure = body as Partial<Extract<BridgeWriteResult, { ok: false }>>
      return {
        ...failure,
        ok: false,
        status: response.status,
        error: typeof failure.error === 'string' ? failure.error : `HTTP ${response.status}`,
      }
    },

    async writeBatch(files: readonly BridgeWriteItem[]): Promise<BridgeWriteBatchResult> {
      let response: Response
      try {
        response = await fetchImpl(`${BRIDGE_PREFIX}write-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ files }),
        })
      } catch (cause) {
        return { ok: false, kind: 'failed', status: 0, error: messageOf(cause), written: [] }
      }

      let body: Partial<
        BridgeWriteResponse &
          BridgeWriteBatchRefusedResponse &
          BridgeWriteBatchConflictResponse &
          BridgeWriteFailureResponse
      >
      try {
        body = (await response.json()) as typeof body
      } catch (cause) {
        body = { error: response.ok ? messageOf(cause) : `HTTP ${response.status}` }
      }
      if (response.ok && Array.isArray(body.written)) {
        return { ok: true, written: body.written }
      }
      const status = response.status
      const error = typeof body.error === 'string' ? body.error : `HTTP ${status}`
      if (status === 409 && Array.isArray(body.conflicts)) {
        return { ok: false, kind: 'conflict', status, error, conflicts: body.conflicts }
      }
      if (status >= 400 && status < 500) {
        const refused = Array.isArray(body.refused) ? body.refused : []
        return { ok: false, kind: 'refused', status, error, refused }
      }
      return {
        ok: false,
        kind: 'failed',
        status,
        error,
        written: Array.isArray(body.written) ? body.written : [],
        ...(typeof body.failed === 'string' ? { failed: body.failed } : {}),
      }
    },

    async readText(path: string): Promise<string | undefined> {
      try {
        const response = await fetchImpl(`${BRIDGE_PREFIX}file?path=${encodeURIComponent(path)}`)
        if (!response.ok) return undefined
        const body = (await response.json()) as Partial<BridgeFileResponse>
        return typeof body.text === 'string' ? body.text : undefined
      } catch {
        return undefined
      }
    },

    async createFile(path: string, text: string): Promise<BridgeCreateResult> {
      let response: Response
      try {
        response = await fetchImpl(`${BRIDGE_PREFIX}write`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ writes: [{ path, text, expected: null }], createOnly: true }),
        })
      } catch (cause) {
        return { ok: false, status: 0, message: messageOf(cause) }
      }
      if (response.ok) {
        return { ok: true }
      }
      const detail = await errorBodyMessage(response)
      return { ok: false, status: response.status, message: detail ?? `HTTP ${response.status}` }
    },
  }
}
