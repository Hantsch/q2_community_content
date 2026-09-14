/**
 * Story 014 D3 / AC1: the shell (`ContentTypeNav`, `StudioPage`) must show whatever the registry
 * hands it without knowing any content type by name. A source-level check, not a rendering one —
 * a literal id string anywhere in these files (even in a comment) would be one type's presence
 * hard-coded into files the other five also run through.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import type { ContentTypeId } from './descriptor'

const here = dirname(fileURLToPath(import.meta.url))

const SHELL_FILES = [
  resolve(here, '../organisms/ContentTypeNav.tsx'),
  resolve(here, '../pages/studio/StudioPage.tsx'),
]

const CONTENT_TYPE_IDS: readonly ContentTypeId[] = [
  'news',
  'engines',
  'gamedata',
  'packs',
  'mods',
  'config_templates',
]

test("no content-type identifier appears in the shell's own source", () => {
  for (const file of SHELL_FILES) {
    const text = readFileSync(file, 'utf-8')

    for (const id of CONTENT_TYPE_IDS) {
      expect(text.includes(`'${id}'`)).toBe(false)
      expect(text.includes(`"${id}"`)).toBe(false)
    }
  }
})
