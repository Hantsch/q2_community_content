/**
 * Story 014 D3/D4: the studio's single screen. It owns the selected content type as plain
 * `useState` (no router — there is exactly one screen) and builds the registry itself;
 * `ContentTypeNav` only ever sees the descriptors and the current selection, never the registry
 * factory.
 *
 * The content region renders `ContentTypeStateNotice` for whichever descriptor is selected: it
 * carries the per-state rendering (implemented / launcher-reads / reserved) so this page stays
 * composition only. Story 016 D5 adds one exception: an `implemented` descriptor with a `reader`
 * (today only `news`) renders the real `LibraryView` instead, driven by `useNewsLibrary()` and
 * wrapped in a `CurrentEntryProvider` so selecting a row marks it as the current entry (AC6). This
 * replaces story 015 D4's interim `NewsBridgeSummary`, which is now deleted.
 *
 * Story 017 D5 adds the validation panel beside the library, both driven by the same
 * `useNewsLibrary()` read (never a second bridge fetch): `panelModel` is built with
 * `buildPanelModel()` from the hook's `report`/`repositoryFindings` and the current entry id from
 * `useCurrentEntry()`, `selectedRow` is looked up across `model.entries`/`model.drafts` so a
 * selected draft still shows as a draft (`panel-model.ts`'s own "a draft never reaches the report"
 * rule), and `onSelectEntry` is `selectEntry` itself — clicking a finding with an `entryId` moves
 * the current-entry selection exactly the way a library row click already does. Mirror provenance
 * is fetched once on mount and again whenever the re-check control fires, alongside a real re-read
 * through `useNewsLibrary()`'s own `refresh()`.
 */
import { useEffect, useState } from 'react'
import { createBridgeClient } from '../../bridge/client'
import type { ContentTypeDescriptor, ContentTypeSource } from '../../content-types/descriptor'
import { createContentTypeRegistry } from '../../content-types/registry'
import { CurrentEntryProvider, useCurrentEntry } from '../../context/current-entry-context'
import { useNewsLibrary } from '../../library/use-news-library'
import type { LibraryRow } from '../../library/library-types'
import { fetchMirrorProvenance } from '../../mirror-runtime/provenance-client'
import type { MirrorProvenance } from '../../mirror/provenance'
import { ContentTypeNav } from '../../organisms/ContentTypeNav'
import { ContentTypeStateNotice } from '../../organisms/ContentTypeStateNotice'
import { LibraryView } from '../../organisms/library/LibraryView'
import { ValidationPanel } from '../../organisms/ValidationPanel'
import { buildPanelModel, type ValidationPanelModel } from '../../validate/panel-model'

/** Story 017 D5's "nothing loaded yet" stand-in — used only while the library's own read is still
 * in flight, so `ValidationPanel` never has to special-case a `null` report/repositoryFindings. */
const EMPTY_PANEL_MODEL: ValidationPanelModel = {
  entry: undefined,
  repositoryFindings: [],
  allClear: true,
}

function findRow(
  model: { entries: readonly LibraryRow[]; drafts: readonly LibraryRow[] } | null,
  id: string | null,
): LibraryRow | undefined {
  if (!model || id === null) return undefined
  return model.entries.find((row) => row.id === id) ?? model.drafts.find((row) => row.id === id)
}

/** Bridges `useNewsLibrary(descriptor)` into `LibraryView` and `ValidationPanel`, reading the
 * current entry from context rather than page state (Decisions (Sprint)) — separated from
 * `StudioPage` only so it can sit beneath `CurrentEntryProvider` and call `useCurrentEntry()`. */
function NewsLibrary({ descriptor }: { descriptor: ContentTypeDescriptor }): React.JSX.Element {
  const { loading, model, report, repositoryFindings, thumbnailUrlFor, refresh } =
    useNewsLibrary(descriptor)
  const { currentEntryId, selectEntry } = useCurrentEntry()
  const [provenance, setProvenance] = useState<MirrorProvenance | undefined>(undefined)

  useEffect(() => {
    void fetchMirrorProvenance().then(setProvenance)
  }, [])

  const panelModel =
    report && repositoryFindings
      ? buildPanelModel({ report, repositoryFindings, selectedEntryId: currentEntryId })
      : EMPTY_PANEL_MODEL
  const selectedRow = findRow(model, currentEntryId)

  const handleRecheck = (): void => {
    refresh()
    void fetchMirrorProvenance().then(setProvenance)
  }

  return (
    <div className="flex gap-8">
      <LibraryView
        model={model}
        loading={loading}
        selectedId={currentEntryId}
        onSelect={selectEntry}
        thumbnailUrlFor={thumbnailUrlFor}
      />
      <div className="flex flex-col gap-4">
        <button type="button" onClick={handleRecheck} className="self-start">
          Re-check
        </button>
        <ValidationPanel
          panelModel={panelModel}
          selectedRow={selectedRow}
          onSelectEntry={selectEntry}
          provenance={provenance}
        />
      </div>
    </div>
  )
}

export interface StudioPageProps {
  /** Defaults to the real bridge client; a test binds a fixture `ContentTypeSource` instead, the
   * same injected-argument pattern `useNewsLibrary(descriptor)` and `createContentTypeRegistry`
   * already follow. */
  readonly source?: ContentTypeSource
}

export function StudioPage({ source }: StudioPageProps = {}): React.JSX.Element {
  const [descriptors] = useState<readonly ContentTypeDescriptor[]>(() =>
    createContentTypeRegistry({ source: source ?? createBridgeClient() }),
  )
  const [selectedId, setSelectedId] = useState<ContentTypeDescriptor['id']>(descriptors[0].id)
  const selected = descriptors.find((descriptor) => descriptor.id === selectedId)

  return (
    <main className="flex flex-col gap-2 p-8">
      <h1 className="text-2xl font-bold">Q2 Content Studio</h1>
      <p>Author and validate community content for the Q2 Launcher.</p>
      <div className="flex gap-8">
        <ContentTypeNav
          descriptors={descriptors}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        <div>
          {selected ? (
            selected.state === 'implemented' && selected.reader ? (
              <CurrentEntryProvider>
                <NewsLibrary descriptor={selected} />
              </CurrentEntryProvider>
            ) : (
              <ContentTypeStateNotice descriptor={selected} />
            )
          ) : null}
        </div>
      </div>
    </main>
  )
}
