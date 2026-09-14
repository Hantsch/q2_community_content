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
 */
import { useState } from 'react'
import { createBridgeClient } from '../../bridge/client'
import type { ContentTypeDescriptor } from '../../content-types/descriptor'
import { createContentTypeRegistry } from '../../content-types/registry'
import { CurrentEntryProvider, useCurrentEntry } from '../../context/current-entry-context'
import { useNewsLibrary } from '../../library/use-news-library'
import { ContentTypeNav } from '../../organisms/ContentTypeNav'
import { ContentTypeStateNotice } from '../../organisms/ContentTypeStateNotice'
import { LibraryView } from '../../organisms/library/LibraryView'

/** Bridges `useNewsLibrary(descriptor)` into `LibraryView`, reading the current entry from context
 * rather than page state (Decisions (Sprint)) — separated from `StudioPage` only so it can sit
 * beneath `CurrentEntryProvider` and call `useCurrentEntry()`. */
function NewsLibrary({ descriptor }: { descriptor: ContentTypeDescriptor }): React.JSX.Element {
  const { loading, model, thumbnailUrlFor } = useNewsLibrary(descriptor)
  const { currentEntryId, selectEntry } = useCurrentEntry()

  return (
    <LibraryView
      model={model}
      loading={loading}
      selectedId={currentEntryId}
      onSelect={selectEntry}
      thumbnailUrlFor={thumbnailUrlFor}
    />
  )
}

export function StudioPage(): React.JSX.Element {
  const [descriptors] = useState<readonly ContentTypeDescriptor[]>(() =>
    createContentTypeRegistry({ source: createBridgeClient() }),
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
