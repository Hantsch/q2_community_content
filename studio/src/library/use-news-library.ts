/**
 * Story 016 D4: the library's data hook — turns a `news` content-type descriptor into a
 * `LibraryModel` plus resolved thumbnail URLs, so `LibraryView` (D3) never touches a descriptor,
 * a reader or the bridge directly.
 *
 * Takes the descriptor itself, never a module-level singleton or registry — the same
 * injected-argument discipline story 014's `createContentTypeRegistry({ source })` established,
 * carried one level further down (Decisions (Sprint), Plan step 4). A caller building the `news`
 * descriptor is free to pass a fixture registry in tests and the real one in the app; this hook
 * neither knows nor cares which.
 *
 * Mirrors `NewsBridgeSummary.tsx`'s effect shape: a cancelled flag guards a `setState` after
 * unmount, and there is no `.catch` because `descriptor.reader()` never throws by contract
 * (`descriptor.ts`) — a failed read comes back as a well-formed `ContentSourceRead` with error
 * findings, which `buildLibraryModel` already turns into the `unreadable` state.
 */
import { useEffect, useState } from 'react'
import type { ContentTypeDescriptor } from '../content-types/descriptor'
import { newsImageUrl } from '../mirror-runtime/newsImageUrl'
import { buildLibraryModel } from './library-model'
import type { LibraryModel, LibraryRow } from './library-types'

export interface UseNewsLibraryResult {
  readonly loading: boolean
  readonly model: LibraryModel | null
  /** Resolves `row.image` to a bridge URL, or `undefined` when the row declares no image. D3
   * deliberately leaves this resolution to the caller (`LibraryEntryRow.tsx`'s header comment) so
   * the model (D1) stays pure and this browser-URL concern lives in exactly one place. */
  readonly thumbnailUrlFor: (row: LibraryRow) => string | undefined
}

/** `row.image` is the declared reference exactly as authored (e.g. `img/picture.png`, per
 * `LibraryRow.image`'s doc comment) — `newsImageUrl()` only accepts a bare file name, so this
 * strips any declared path down to its final segment before resolving it. */
function bareFileName(image: string): string {
  const segments = image.split('/')
  return segments[segments.length - 1] ?? image
}

function thumbnailUrlFor(row: LibraryRow): string | undefined {
  if (!row.image) return undefined
  const name = bareFileName(row.image)
  // `newsImageUrl()` throws for a name it cannot serve (empty, a path separator, or a leading
  // dot — e.g. a declared `image: img/.cover.png`). A row like that is exactly the "missing or
  // refused image" case the Decisions section already promises a labelled placeholder for, never
  // a crash: this function must resolve to `undefined` instead of letting the throw propagate
  // into `LibraryView`'s render.
  try {
    return newsImageUrl(name)
  } catch {
    return undefined
  }
}

/**
 * Reads `descriptor` once on mount and again whenever the descriptor reference changes, builds
 * the library model from the result, and exposes it alongside a `loading` flag and the thumbnail
 * resolver above. `now` defaults to `() => new Date()`, matching `ContentTypeValidators.buildReport`
 * always taking the caller's clock rather than reading it itself.
 */
export function useNewsLibrary(
  descriptor: ContentTypeDescriptor,
  now: () => Date = () => new Date(),
): UseNewsLibraryResult {
  // `descriptor` is tracked alongside the result so a changed descriptor can reset `loading`/`model`
  // during render (React's documented "adjusting state while rendering" pattern) rather than with a
  // synchronous `setState` at the top of the effect below, which would trigger a second, avoidable
  // render on every descriptor change.
  const [state, setState] = useState<{
    descriptor: ContentTypeDescriptor
    loading: boolean
    model: LibraryModel | null
  }>({ descriptor, loading: true, model: null })

  if (state.descriptor !== descriptor) {
    setState({ descriptor, loading: true, model: null })
  }

  useEffect(() => {
    let cancelled = false

    const { reader, validators } = descriptor

    // No reader/validators bound (a content type that is not yet `implemented`) is the same
    // "nothing reliable to list" signal `buildLibraryModel` already gives an absent read. Resolved
    // through a microtask, like the real read below, so `setState` never runs synchronously inside
    // the effect body itself.
    const result: Promise<LibraryModel> =
      !reader || !validators
        ? Promise.resolve(
            buildLibraryModel({ read: undefined, report: undefined, repositoryFindings: undefined }),
          )
        : reader().then((read) => {
            const report = validators.buildReport(read, now())
            const repositoryFindings = validators.collectFindings(read)
            return buildLibraryModel({ read, report, repositoryFindings })
          })

    void result.then((model) => {
      if (cancelled) return
      setState({ descriptor, loading: false, model })
    })

    return () => {
      cancelled = true
    }
    // `now` is a clock factory the caller may pass inline; it is read once per descriptor read, not
    // tracked as a dependency, matching `ContentTypeValidators.buildReport`'s own "caller's now" but
    // never-reactive contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descriptor])

  return { loading: state.loading, model: state.model, thumbnailUrlFor }
}
