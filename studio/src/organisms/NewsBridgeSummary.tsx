/**
 * Story 015, D4: a minimal read summary for `news`, wired into the content region `StudioPage`
 * shows while `descriptor.state === 'implemented'`. Deliberately small — story 016 replaces this
 * region with the real library view; this organism only proves the bridge round-trips a read.
 *
 * On a successful read it shows the index file path plus the counts of index entries, documents
 * and drafts (AC1). On a read whose `findings` carries at least one `severity: 'error'` entry —
 * exactly what `createBridgeClient`'s own error fallback (D4) and `unavailableFileBridgeSource`
 * (story 014 D1) both produce on failure — it shows the finding's message instead of counts, so a
 * bridge failure reads as an explained failure rather than a suspiciously empty repository.
 */
import { useEffect, useState } from 'react'
import type { ContentSourceRead } from '../content-types/descriptor'

export interface NewsBridgeSummaryProps {
  readonly reader: () => Promise<ContentSourceRead>
}

const NEWS_INDEX_PATH = 'news/index.json'

type SummaryState = 'loading' | { readonly read: ContentSourceRead }

/** Defensive count of `read.index.value`'s `entries` array — 0 for anything malformed. */
function countEntries(indexValue: unknown): number {
  const entries = (indexValue as { entries?: unknown } | undefined)?.entries
  return Array.isArray(entries) ? entries.length : 0
}

export function NewsBridgeSummary({ reader }: NewsBridgeSummaryProps): React.JSX.Element {
  const [state, setState] = useState<SummaryState>('loading')

  useEffect(() => {
    let cancelled = false
    // `reader` (a `ContentTypeSource.read`) never throws by contract — see `descriptor.ts` and
    // `createBridgeClient` — so there is no `.catch` branch here; a failed bridge call comes back
    // as a resolved read with an error finding, handled below.
    void reader().then((read) => {
      if (!cancelled) setState({ read })
    })
    return () => {
      cancelled = true
    }
  }, [reader])

  if (state === 'loading') {
    return (
      <div aria-label="News content" className="flex flex-col gap-2">
        <p>Reading news/ through the file bridge…</p>
      </div>
    )
  }

  const { read } = state
  const errorFindings = read.findings.filter((finding) => finding.severity === 'error')

  if (errorFindings.length > 0) {
    return (
      <div aria-label="News content" className="flex flex-col gap-2">
        <p className="font-medium">News could not be read through the file bridge.</p>
        <p>{errorFindings.map((finding) => finding.message).join(' ')}</p>
      </div>
    )
  }

  return (
    <div aria-label="News content" className="flex flex-col gap-2">
      <p>Index: {NEWS_INDEX_PATH}</p>
      <p>Entries: {countEntries(read.index.value)}</p>
      <p>Documents: {Object.keys(read.documents).length}</p>
      <p>Drafts: {read.drafts.length}</p>
    </div>
  )
}
