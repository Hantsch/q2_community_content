/**
 * Story 016 D3: AC7's three distinct non-list explanations, mirroring `ContentTypeStateNotice`'s
 * shape. `'loading'` is not part of `LibraryState` (`library-types.ts`) — `LibraryModel` itself
 * carries no loading state, that arrives as a separate prop from D4's hook — so this component
 * accepts its own small union rather than reusing `LibraryState` verbatim.
 */
import type { ReaderFinding } from '../../content-repo/findings'

export type LibraryNoticeState = 'loading' | 'empty' | 'unreadable'

export interface LibraryStateNoticeProps {
  readonly state: LibraryNoticeState
  /** Only meaningful for `'unreadable'` — the reader's own findings, so the message says what went
   * wrong rather than just that something did. */
  readonly unreadableFindings?: readonly ReaderFinding[]
}

export function LibraryStateNotice({
  state,
  unreadableFindings = [],
}: LibraryStateNoticeProps): React.JSX.Element {
  switch (state) {
    case 'loading':
      return (
        <div aria-label="Library content" className="flex flex-col gap-2">
          <p>Reading news/…</p>
        </div>
      )
    case 'empty':
      return (
        <div aria-label="Library content" className="flex flex-col gap-2">
          <p className="font-medium">news/ has no entries or drafts.</p>
          <p>The directory was read successfully — there is genuinely nothing here yet.</p>
        </div>
      )
    case 'unreadable':
      return (
        <div aria-label="Library content" className="flex flex-col gap-2">
          <p className="font-medium">news/ could not be read.</p>
          {unreadableFindings.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {unreadableFindings.map((finding) => (
                <li key={`${finding.code}-${finding.path ?? ''}`}>{finding.message}</li>
              ))}
            </ul>
          ) : (
            <p>No further detail was reported.</p>
          )}
        </div>
      )
    default: {
      const exhaustive: never = state
      throw new Error(`Unhandled library notice state: ${String(exhaustive)}`)
    }
  }
}
