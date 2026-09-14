/**
 * Story 014 D3/D4: the studio's single screen. It owns the selected content type as plain
 * `useState` (no router — there is exactly one screen) and builds the registry itself;
 * `ContentTypeNav` only ever sees the descriptors and the current selection, never the registry
 * factory.
 *
 * The content region renders `ContentTypeStateNotice` for whichever descriptor is selected: it
 * carries the per-state rendering (implemented / launcher-reads / reserved) so this page stays
 * composition only.
 */
import { useState } from 'react'
import type { ContentTypeDescriptor } from '../../content-types/descriptor'
import { createContentTypeRegistry } from '../../content-types/registry'
import { ContentTypeNav } from '../../organisms/ContentTypeNav'
import { ContentTypeStateNotice } from '../../organisms/ContentTypeStateNotice'

export function StudioPage(): React.JSX.Element {
  const [descriptors] = useState<readonly ContentTypeDescriptor[]>(() =>
    createContentTypeRegistry(),
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
        <div>{selected ? <ContentTypeStateNotice descriptor={selected} /> : null}</div>
      </div>
    </main>
  )
}
