/**
 * Story 022 D1: the frontmatter draft model. A draft is the fields of one news document as
 * authored (all strings), read with the mirrored `parseFrontmatter()` - never a second parser.
 * The original text stays on the draft so a later patch step can leave unknown lines and comments
 * untouched.
 */
import { parseFrontmatter } from '../contract/launcher-contract'

export interface DraftButton {
  label: string
  url: string
}

export interface DraftFields {
  template: string
  title: string
  order: string
  image: string
  visibleFrom: string
  visibleUntil: string
  buttons: DraftButton[]
}

export interface EntryDraft {
  file: string
  /** The document text as read; the base for patching. */
  originalText: string
  fields: DraftFields
  /** The fields as first read, to compute dirtiness against. */
  initialFields: DraftFields
}

export type UnreadableDraft = { unreadable: true }

const KNOWN_TEMPLATES = ['text', 'split', 'banner', 'cover'] as const

export function isKnownTemplate(value: string): boolean {
  return (KNOWN_TEMPLATES as readonly string[]).includes(value)
}

export interface FieldSet {
  image: 'none' | 'optional' | 'required'
}

/** Which optional fields a template offers. Unknown values get the `text` set. */
export function fieldsFor(template: string): FieldSet {
  if (template === 'split' || template === 'cover') return { image: 'required' }
  if (template === 'banner') return { image: 'optional' }
  return { image: 'none' }
}

export function draftFromDocument(file: string, text: string): EntryDraft | UnreadableDraft {
  const parsed = parseFrontmatter(text)
  if (!parsed) return { unreadable: true }
  const { data } = parsed
  const fields: DraftFields = {
    template: data.template ?? '',
    title: data.title ?? '',
    order: data.order ?? '',
    image: data.image ?? '',
    visibleFrom: data.visibleFrom ?? '',
    visibleUntil: data.visibleUntil ?? '',
    buttons: (data.buttons ?? []).map((b) => ({ label: b.label, url: b.url })),
  }
  return { file, originalText: text, fields, initialFields: fields }
}

export function updateDraft(draft: EntryDraft, patch: Partial<DraftFields>): EntryDraft {
  return { ...draft, fields: { ...draft.fields, ...patch } }
}

function sameButtons(a: DraftButton[], b: DraftButton[]): boolean {
  return a.length === b.length && a.every((x, i) => x.label === b[i].label && x.url === b[i].url)
}

export function isDirty(draft: EntryDraft): boolean {
  const { fields: a, initialFields: b } = draft
  return (
    a.template !== b.template ||
    a.title !== b.title ||
    a.order !== b.order ||
    a.image !== b.image ||
    a.visibleFrom !== b.visibleFrom ||
    a.visibleUntil !== b.visibleUntil ||
    !sameButtons(a.buttons, b.buttons)
  )
}
