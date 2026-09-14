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
import { BRIDGE_PREFIX, type BridgeErrorResponse, type BridgeReadResponse } from './bridge-protocol'

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
 * Creates a `ContentTypeSource` backed by the local file bridge's `GET /__studio/fs/read` route.
 * `fetchImpl` defaults to the global `fetch` and is injectable for tests, the same style
 * `read-content-repo.ts` injects `repoRoot`.
 */
export function createBridgeClient(fetchImpl: typeof fetch = fetch): ContentTypeSource {
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
  }
}
