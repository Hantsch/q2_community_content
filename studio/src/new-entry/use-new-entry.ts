/**
 * Story 025 D3: the new-entry flow's data hook. Loads the kit's template guidance through the
 * bridge on first open, and creates an entry from the chosen kit template: template text in,
 * `buildNewEntryText`, create-only write, then a library re-read and selection of the new draft
 * through the caller's own (guarded) selection path.
 */
import { useCallback, useState } from 'react'
import type { BridgeClient } from '../bridge/client'
import { buildNewEntryText, newEntryFileName } from './new-entry'
import { parseTemplateGuidance, type TemplateGuidance } from './template-guidance'

const README_PATH = 'news/_templates/README.md'

export type GuidanceState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly guidance: readonly TemplateGuidance[] }
  | { readonly status: 'unavailable' }

export interface NewEntryInput {
  readonly template: string
  readonly title: string
  readonly slug: string
  readonly date: string
}

export type CreateNewEntryResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string }

export interface UseNewEntryResult {
  readonly open: boolean
  readonly guidance: GuidanceState
  readonly openDialog: () => void
  readonly closeDialog: () => void
  readonly create: (input: NewEntryInput) => Promise<CreateNewEntryResult>
}

export function useNewEntry(args: {
  readonly client: Pick<BridgeClient, 'readText' | 'createFile'>
  readonly refresh: () => void
  readonly selectEntry: (id: string) => void
}): UseNewEntryResult {
  const { client, refresh, selectEntry } = args
  const [open, setOpen] = useState(false)
  const [guidance, setGuidance] = useState<GuidanceState>({ status: 'loading' })

  const openDialog = useCallback(() => {
    setOpen(true)
    setGuidance({ status: 'loading' })
    void client.readText(README_PATH).then((text) => {
      const parsed = text === undefined ? [] : parseTemplateGuidance(text)
      setGuidance(
        parsed.length > 0 ? { status: 'ready', guidance: parsed } : { status: 'unavailable' },
      )
    })
  }, [client])

  const closeDialog = useCallback(() => setOpen(false), [])

  const create = useCallback(
    async ({ template, title, slug, date }: NewEntryInput): Promise<CreateNewEntryResult> => {
      const templatePath = `news/_templates/${template}/template.md`
      const templateText = await client.readText(templatePath)
      if (templateText === undefined) {
        return { ok: false, message: `${templatePath} could not be read.` }
      }
      const fileName = newEntryFileName(date, slug)
      const path = `news/${fileName}`
      const result = await client.createFile(path, buildNewEntryText(templateText, title))
      if (!result.ok) {
        return {
          ok: false,
          message:
            result.status === 409
              ? `${path} already exists; nothing was written.`
              : `${path} was not created: ${result.message}`,
        }
      }
      refresh()
      selectEntry(path)
      setOpen(false)
      return { ok: true }
    },
    [client, refresh, selectEntry],
  )

  return { open, guidance, openDialog, closeDialog, create }
}
