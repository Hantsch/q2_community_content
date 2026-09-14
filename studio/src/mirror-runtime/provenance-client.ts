/**
 * Story 017 D4: the browser-side client for the mirror provenance bridge route. Mirrors
 * `studio/src/bridge/client.ts`'s shape closely (injectable `fetchImpl`, never throws), but this
 * route takes no path input at all — `GET /__studio/fs/provenance` — so there is no directory
 * argument to pass, and no "well-formed empty read" to fall back to the way `read()` has one.
 *
 * On any failure (network error, non-2xx response, unparseable JSON) this falls back to the same
 * `verdict: 'unknown'` shape `read-provenance.ts`'s own `unknownProvenance()` helper returns for
 * its failure cases, with a `reason` naming what went wrong — so the panel can render an "unknown"
 * provenance the same way it would for a lock file that couldn't be read server-side.
 */
import {
  BRIDGE_PREFIX,
  type BridgeErrorResponse,
  type BridgeProvenanceResponse,
} from '../bridge/bridge-protocol'
import type { MirrorProvenance } from '../mirror/provenance'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Same `verdict: 'unknown'` shape `unknownProvenance()` (read-provenance.ts) returns. */
function unknownProvenance(reason: string): MirrorProvenance {
  return {
    verdict: 'unknown',
    launcherCommit: '',
    launcherCommitShort: '',
    syncedAt: '',
    ageInDays: 0,
    fileCount: 0,
    mismatchedFiles: [],
    reason,
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
 * Fetches mirror provenance from the local file bridge's `GET /__studio/fs/provenance` route.
 * `fetchImpl` defaults to the global `fetch` and is injectable for tests, the same style
 * `createBridgeClient` injects it.
 */
export async function fetchMirrorProvenance(
  fetchImpl: typeof fetch = fetch,
): Promise<MirrorProvenance> {
  let response: Response
  try {
    response = await fetchImpl(`${BRIDGE_PREFIX}provenance`)
  } catch (cause) {
    return unknownProvenance(messageOf(cause))
  }

  if (!response.ok) {
    const detail = await errorBodyMessage(response)
    return unknownProvenance(detail ?? `HTTP ${response.status}`)
  }

  try {
    return (await response.json()) as BridgeProvenanceResponse
  } catch (cause) {
    return unknownProvenance(messageOf(cause))
  }
}
