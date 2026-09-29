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
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { buildOrderSequence } from '../../publishing/order-plan'
import { usePublishing } from '../../publishing/use-publishing'
import { OrderList } from '../../organisms/library/OrderList'
import { createBridgeClient, type BridgeClient } from '../../bridge/client'
import type { ContentTypeDescriptor, ContentTypeSource } from '../../content-types/descriptor'
import { createContentTypeRegistry } from '../../content-types/registry'
import { CurrentEntryProvider, useCurrentEntry } from '../../context/current-entry-context'
import { EntryDraftProvider, useEntryDraft } from '../../context/entry-draft-context'
import { PreviewWidthProvider } from '../../context/preview-width-context'
import { useSaveEntry } from '../../authoring/use-save-entry'
import { documentFor } from '../../library/document-text'
import { useNewsLibrary } from '../../library/use-news-library'
import type { LibraryRow } from '../../library/library-types'
import { fetchMirrorProvenance } from '../../mirror-runtime/provenance-client'
import type { MirrorProvenance } from '../../mirror/provenance'
import { ContentTypeNav } from '../../organisms/ContentTypeNav'
import { ContentTypeStateNotice } from '../../organisms/ContentTypeStateNotice'
import { withBody } from '../../editor/body-document'
import { BodyEditor } from '../../organisms/editor/BodyEditor'
import { FrontmatterEditor } from '../../organisms/editor/FrontmatterEditor'
import { SaveEntryControls } from '../../organisms/editor/SaveEntryControls'
import { DraftPreviewNotice } from '../../organisms/preview/DraftPreviewNotice'
import { SlidePreview } from '../../organisms/preview/SlidePreview'
import { buildSlidePreviewModel } from '../../preview/preview-model'
import { useNewEntry } from '../../new-entry/use-new-entry'
import { NewEntryDialog } from '../../organisms/new-entry/NewEntryDialog'
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

/** Story 025 D3: today as `YYYY-MM-DD` in local time. */
function localToday(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Story 024 D6: the one path a save takes to disk. */
function writeThroughBridge(writes: Parameters<BridgeClient['write']>[0]) {
  return createBridgeClient().write(writes)
}

interface EditorSource {
  readonly file: string | null
  readonly text: string | undefined
}

const NO_SOURCE: EditorSource = { file: null, text: undefined }

function findRow(
  model: { entries: readonly LibraryRow[]; drafts: readonly LibraryRow[] } | null,
  id: string | null,
): LibraryRow | undefined {
  if (!model || id === null) return undefined
  return model.entries.find((row) => row.id === id) ?? model.drafts.find((row) => row.id === id)
}

/** The body of the selected entry, bound to the working copy; absent when nothing editable. */
function BodyPanel(): React.JSX.Element | null {
  const { draft, body, setBody } = useEntryDraft()
  if (draft === null || 'unreadable' in draft) return null
  return <BodyEditor value={body} onChange={setBody} />
}

/** Bridges `useNewsLibrary(descriptor)` into `LibraryView` and `ValidationPanel`, reading the
 * current entry from context rather than page state (Decisions (Sprint)) — separated from
 * `StudioPage` only so it can sit beneath `CurrentEntryProvider` and call `useCurrentEntry()`. */
function NewsLibrary({
  descriptor,
  onEditorSource,
}: {
  descriptor: ContentTypeDescriptor
  onEditorSource: (source: EditorSource) => void
}): React.JSX.Element {
  const {
    loading,
    model,
    read,
    report,
    repositoryFindings,
    thumbnailUrlFor,
    refresh,
    draftPreviewFor,
    workingPreviewFor,
  } = useNewsLibrary(descriptor)
  const { currentEntryId, selectEntry: selectEntryUnguarded } = useCurrentEntry()
  const { confirmDiscard, reset, body, bodyChanged, draft, isDirty, canSave } = useEntryDraft()
  // Story 024 D6: saving goes only through the bridge; a successful save re-reads the library,
  // whose new document text starts a clean draft.
  const saveEntry = useSaveEntry({
    read,
    draft,
    body,
    canSave,
    write: writeThroughBridge,
    onSaved: refresh,
  })
  const [bridge] = useState(() => createBridgeClient())
  const [provenance, setProvenance] = useState<MirrorProvenance | undefined>(undefined)

  useEffect(() => {
    void fetchMirrorProvenance().then(setProvenance)
  }, [])

  const panelModel =
    report && repositoryFindings
      ? buildPanelModel({ report, repositoryFindings, selectedEntryId: currentEntryId })
      : EMPTY_PANEL_MODEL
  const selectedRow = findRow(model, currentEntryId)
  const selectedDocument = documentFor(read, selectedRow)
  // Story 020 D2: a selected draft feeds the same preview the synthetic read/report it would have
  // as a published row; when that cannot be built the input stays the published one, which yields
  // 018's own "not in index" state for the draft's id.
  // Story 023 D3: a changed body is substituted into the on-disk document text, so the preview
  // follows the typing through the same pipeline. Frontmatter edits are not previewed yet.
  const workingText =
    bodyChanged && selectedDocument ? withBody(selectedDocument.text, body) : undefined
  const draftPreview =
    selectedRow?.status === 'draft' && currentEntryId !== null
      ? draftPreviewFor(currentEntryId, workingText)
      : undefined
  const workingPreview =
    selectedRow?.status !== 'draft' &&
    selectedDocument &&
    currentEntryId !== null &&
    workingText !== undefined
      ? workingPreviewFor(selectedDocument.file, currentEntryId, workingText)
      : undefined
  const previewModel = buildSlidePreviewModel(
    draftPreview ?? workingPreview ?? { read, report, entryId: currentEntryId },
  )
  const draftVerdict = draftPreview?.report?.entries.find(
    (entry) => entry.id === draftPreview.entryId,
  )
  const deliveredCount =
    draftPreview?.report?.entries.filter(
      (entry) => entry.delivered !== 'dropped' && entry.delivered.position !== undefined,
    ).length ?? 0

  const editorFile = selectedDocument?.file ?? null
  const editorText = selectedDocument?.text
  // The draft provider sits above the content-type nav, so the library reports what the editor
  // edits instead of hosting the provider; before paint, so the editor never shows a stale draft.
  useLayoutEffect(() => {
    onEditorSource({ file: editorFile, text: editorText })
    return () => onEditorSource(NO_SOURCE)
  }, [onEditorSource, editorFile, editorText])

  // Leaving an entry asks first when its draft is dirty; picking the current one is not leaving.
  const selectEntry = (id: string): void => {
    if (id === currentEntryId) return
    if (confirmDiscard()) selectEntryUnguarded(id)
  }

  const newEntry = useNewEntry({ client: bridge, refresh, selectEntry })
  const writeBatch = useCallback(
    (files: Parameters<BridgeClient['writeBatch']>[0]) => bridge.writeBatch(files),
    [bridge],
  )
  const publishing = usePublishing({ read, writeBatch, refresh })
  const orderItems = (read === null ? [] : buildOrderSequence(read)).map((item) => ({
    id: item.id,
    order: item.order,
    title:
      model?.entries.find((row) => row.id === item.id)?.title ??
      model?.entries.find((row) => row.id === item.id)?.file ??
      item.id,
  }))

  const handleRecheck = (): void => {
    if (!confirmDiscard()) return
    reset()
    refresh()
    void fetchMirrorProvenance().then(setProvenance)
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      {draftVerdict && (
        <DraftPreviewNotice verdict={draftVerdict} deliveredCount={deliveredCount} />
      )}
      <SlidePreview model={previewModel} />
      {/* Story 026: a stored image changes the repository, so the preview and verdicts re-read it;
          the draft survives because its document text is unchanged. */}
      <FrontmatterEditor onImageAdded={refresh} />
      <BodyPanel />
      {draft !== null && !('unreadable' in draft) && (
        <SaveEntryControls
          state={saveEntry.state}
          dirty={isDirty}
          canSave={canSave}
          onSave={saveEntry.save}
          onConfirmDrop={saveEntry.confirmDrop}
          onOverwrite={saveEntry.overwrite}
          onCancel={saveEntry.cancel}
        />
      )}
      {newEntry.open && (
        <NewEntryDialog
          guidance={newEntry.guidance}
          rows={model?.state === 'ready' ? [...model.entries, ...model.drafts] : []}
          today={localToday()}
          onCreate={newEntry.create}
          onCancel={newEntry.closeDialog}
        />
      )}
      <OrderList
        items={orderItems}
        busy={publishing.busy}
        pending={publishing.pending}
        result={publishing.result}
        onMove={publishing.move}
        onConfirm={publishing.confirm}
        onCancel={publishing.cancel}
      />
      <div className="flex gap-8">
        <LibraryView
          model={model}
          loading={loading}
          selectedId={currentEntryId}
          onSelect={selectEntry}
          thumbnailUrlFor={thumbnailUrlFor}
          onNewEntry={newEntry.openDialog}
          onPublish={publishing.publish}
          onUnpublish={publishing.unpublish}
          publishingBusy={publishing.busy}
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
    </div>
  )
}

export interface StudioPageProps {
  /** Defaults to the real bridge client; a test binds a fixture `ContentTypeSource` instead, the
   * same injected-argument pattern `useNewsLibrary(descriptor)` and `createContentTypeRegistry`
   * already follow. */
  readonly source?: ContentTypeSource
}

function StudioScreen({
  source,
  onEditorSource,
}: StudioPageProps & {
  onEditorSource: (source: EditorSource) => void
}): React.JSX.Element {
  const { confirmDiscard } = useEntryDraft()
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
          onSelect={(id) => {
            if (id !== selectedId && confirmDiscard()) setSelectedId(id)
          }}
        />
        <div className="min-w-0 flex-1">
          {selected ? (
            selected.state === 'implemented' && selected.reader ? (
              <CurrentEntryProvider>
                <PreviewWidthProvider>
                  <NewsLibrary descriptor={selected} onEditorSource={onEditorSource} />
                </PreviewWidthProvider>
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

export function StudioPage({ source }: StudioPageProps = {}): React.JSX.Element {
  const [editorSource, setEditorSource] = useState<EditorSource>(NO_SOURCE)
  return (
    <EntryDraftProvider file={editorSource.file} text={editorSource.text}>
      <StudioScreen source={source} onEditorSource={setEditorSource} />
    </EntryDraftProvider>
  )
}
