/**
 * Story 016 D4: the current entry, held in a small React context rather than page state
 * (Decisions (Sprint)) — story 017 selects an entry from a finding in a different part of the
 * page, and would otherwise have to reach up into `StudioPage`'s own state to do it. Anything the
 * studio shows a selected entry to (the library, story 017's detail panel, and whatever comes
 * after) reads and writes through this one seam instead.
 *
 * Deliberately not `news`-specific in naming or shape: `currentEntryId` is a plain `string`, the
 * same id `LibraryRow.id` already carries for either an entry or a draft, so a future content type
 * can share this context without a rename.
 */
import { createContext, useContext, useMemo, useState } from 'react'

export interface CurrentEntryContextValue {
  readonly currentEntryId: string | null
  readonly selectEntry: (id: string) => void
}

const CurrentEntryContext = createContext<CurrentEntryContextValue | undefined>(undefined)

export interface CurrentEntryProviderProps {
  readonly children: React.ReactNode
}

/** Holds `currentEntryId` for every consumer beneath it. One provider per studio session is the
 * expected shape; nothing here prevents nesting, but there is no story that needs it yet. */
export function CurrentEntryProvider({
  children,
}: CurrentEntryProviderProps): React.JSX.Element {
  const [currentEntryId, setCurrentEntryId] = useState<string | null>(null)

  const value = useMemo<CurrentEntryContextValue>(
    () => ({ currentEntryId, selectEntry: setCurrentEntryId }),
    [currentEntryId],
  )

  return <CurrentEntryContext.Provider value={value}>{children}</CurrentEntryContext.Provider>
}

/** Reads the current entry and its setter. Throws when called outside `CurrentEntryProvider` —
 * a consumer rendered without the provider is a wiring bug, not a state a caller should have to
 * guard against with an optional chain. */
export function useCurrentEntry(): CurrentEntryContextValue {
  const value = useContext(CurrentEntryContext)
  if (!value) {
    throw new Error('useCurrentEntry must be used within a CurrentEntryProvider')
  }
  return value
}
