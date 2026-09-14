/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Turns the repository's own `news/` tree into the `{ index, documents }` shape
 * `resolveFeed()`/`buildFeed()` expect (story 007 D2).
 *
 * IO only, no validation and no rule logic - the mirrored pipeline validates its own input
 * (Decisions (Sprint): "reading `news/` from disk is studio code, not a contract rule"). `index`
 * is handed to the pipeline exactly as `JSON.parse` produced it, including fields the pipeline
 * does not use (e.g. the index's own `order`); `documents` only ever holds the `.md` files the
 * index's own entries name, keyed by their exact `file` value - `news/_templates/`,
 * `news/community_welcome/` and `news/img/` are never read as documents.
 */

// `studio/src/contract/` sits three directories below the repository root
// (contract -> src -> studio -> root).
const newsDir = fileURLToPath(new URL('../../../news/', import.meta.url))

interface RawNewsIndexEntry {
  file?: unknown
}

interface RawNewsIndex {
  entries?: RawNewsIndexEntry[]
}

/** The `{ index, documents }` shape `resolveFeed()`/`buildFeed()` expect - mirrors
 * `ResolveFeedInput` (`launcher-core/src/main/modules/home/news/feed-pipeline.ts`) without
 * importing it, since this IO-only module has no need to reach into the mirror at all. */
export interface NewsTree {
  index: unknown
  documents: Readonly<Record<string, string>>
}

/** Reads `news/index.json` and every `.md` document its entries name, from disk. */
export function readNewsTree(): NewsTree {
  const indexText = readFileSync(new URL('index.json', `file://${newsDir}`), 'utf8')
  const index = JSON.parse(indexText) as unknown

  const documents: Record<string, string> = {}
  const entries = (index as RawNewsIndex)?.entries
  if (Array.isArray(entries)) {
    for (const entry of entries) {
      const file = entry?.file
      if (typeof file === 'string' && file.trim() !== '') {
        documents[file] = readFileSync(new URL(file, `file://${newsDir}`), 'utf8')
      }
    }
  }

  return { index, documents }
}
