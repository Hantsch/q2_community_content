/**
 * Shared finding vocabulary for the content-repo reader (story 010). Kept minimal and generic
 * here — later stories (011, 013) extend it with concrete `code`s and richer callers; this
 * deliverable only introduces the shape itself.
 */

export type ReaderFindingSeverity = 'error' | 'warning' | 'info'

export interface ReaderFinding {
  code: string
  severity: ReaderFindingSeverity
  message: string
  path?: string
}
