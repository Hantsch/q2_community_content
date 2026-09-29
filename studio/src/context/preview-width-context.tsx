/**
 * Story 019 D1: the selected preview width, held in memory in a small React context (like the
 * current entry) so it survives switching entries and any consumer can read or change it.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import { DEFAULT_PREVIEW_WIDTH } from '../preview/preview-widths'

export interface PreviewWidthContextValue {
  readonly width: number
  readonly setWidth: (px: number) => void
}

const PreviewWidthContext = createContext<PreviewWidthContextValue | undefined>(undefined)

export interface PreviewWidthProviderProps {
  readonly children: React.ReactNode
}

export function PreviewWidthProvider({ children }: PreviewWidthProviderProps): React.JSX.Element {
  const [width, setWidth] = useState<number>(DEFAULT_PREVIEW_WIDTH)

  const value = useMemo<PreviewWidthContextValue>(() => ({ width, setWidth }), [width])

  return <PreviewWidthContext.Provider value={value}>{children}</PreviewWidthContext.Provider>
}

/** Throws outside `PreviewWidthProvider` - a missing provider is a wiring bug. */
export function usePreviewWidth(): PreviewWidthContextValue {
  const value = useContext(PreviewWidthContext)
  if (!value) {
    throw new Error('usePreviewWidth must be used within a PreviewWidthProvider')
  }
  return value
}
