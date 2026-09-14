/**
 * Story 014 D1: the six content types of this repository, as descriptors, in the one fixed order
 * the studio shows them in — `news` first, then the two the launcher already reads, then the three
 * the contract reserves.
 *
 * Only `news` carries a reader and validators, and it owns no checking logic of its own: it binds
 * the existing pure functions `buildNewsReport()` (story 011) and `collectRepositoryFindings()`
 * (story 013) to a read, adapting it exactly the way `scripts/validate.ts` already does. A content
 * type graduating to `implemented` adds its reader and validators here and nowhere else.
 */
import { buildNewsReport } from '../report/build-news-report'
import { collectRepositoryFindings, toRepositoryScan } from '../report/repository-findings'
import type { ContentSourceRead, ContentTypeDescriptor, ContentTypeSource } from './descriptor'

const NEWS_DIRECTORY = 'news'

/** The same adaptation `scripts/validate.ts` performs: document texts by file, image sizes by name. */
function toNewsReportInput(read: ContentSourceRead, now: Date) {
  return {
    index: read.index.value,
    documents: Object.fromEntries(
      Object.entries(read.documents).map(([file, document]) => [file, document.text]),
    ),
    now,
    images: read.images.map((image) => ({ name: image.name, size: image.bytes })),
  }
}

/** Built per factory call so the bound `source` never outlives the registry it belongs to. */
function createNewsDescriptor(source: ContentTypeSource): ContentTypeDescriptor {
  return {
    id: 'news',
    label: 'News',
    state: 'implemented',
    directory: NEWS_DIRECTORY,
    indexFile: 'index.json',
    reader: () => source.read(NEWS_DIRECTORY),
    validators: {
      buildReport: (read, now) => buildNewsReport(toNewsReportInput(read, now)),
      collectFindings: (read) => collectRepositoryFindings(toRepositoryScan(read)),
    },
  }
}

/**
 * The six descriptors, in their fixed order. Fresh objects on every call: two registries built
 * from two different sources must never share a descriptor.
 */
export function createContentTypeDescriptors(
  source: ContentTypeSource,
): readonly ContentTypeDescriptor[] {
  return [
    createNewsDescriptor(source),
    {
      id: 'engines',
      label: 'Engines',
      state: 'launcher-reads',
      directory: 'engines',
      indexFile: 'manifest.json',
    },
    {
      id: 'gamedata',
      label: 'Game data',
      state: 'launcher-reads',
      directory: 'gamedata',
      indexFile: 'manifest.json',
    },
    {
      id: 'packs',
      label: 'Packs',
      state: 'reserved',
      directory: 'packs',
      conceptPath: 'docs/concepts/packs-content.md',
    },
    {
      id: 'mods',
      label: 'Mods',
      state: 'reserved',
      directory: 'mods',
      conceptPath: 'docs/concepts/mods-content.md',
    },
    {
      id: 'config_templates',
      label: 'Config templates',
      state: 'reserved',
      directory: 'config_templates',
      conceptPath: 'docs/concepts/config-templates-content.md',
    },
  ]
}
