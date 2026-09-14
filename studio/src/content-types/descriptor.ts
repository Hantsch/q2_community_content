/**
 * Story 014 D1: the content-type descriptor — the single shape everything the studio shows about a
 * content type is read from, so that adding a content type means adding a descriptor and nothing
 * else.
 *
 * Types only, deliberately (the same discipline as `report/report-types.ts`): the descriptors
 * themselves live in `descriptors.ts` and the factory that binds them to a file source in
 * `registry.ts`.
 *
 * Two shape decisions carry the extension seam stories 015-017 build on:
 *
 * - **A descriptor's `reader` takes no arguments.** The file source is injected once, into the
 *   registry factory, and each descriptor closes over it — the same injected-root pattern
 *   `content-repo/read-content-repo.ts` uses for `repoRoot`. Tests bind a fixture source, the app
 *   binds the real one, and nothing needs a runtime toggle.
 * - **Reading is asynchronous.** Story 015's file bridge fetches over HTTP from a dev-server
 *   plugin, so the port is a `Promise` from the start; making it synchronous now would force every
 *   caller to change when the real source arrives.
 *
 * Nothing here knows about Node: `node:fs` must not reach this directory, because the studio runs
 * this code in the browser.
 */
import type { ContentRepoRead } from '../content-repo/read-content-repo'
import type { ContentReport } from '../report/report-types'
import type { RepositoryFinding } from '../report/repository-findings'

/** The six content types of the published surface, in this repository's own naming. */
export type ContentTypeId = 'news' | 'engines' | 'gamedata' | 'packs' | 'mods' | 'config_templates'

/**
 * How far a content type has come:
 * - `implemented` — the studio itself reads and validates it.
 * - `launcher-reads` — the launcher consumes the directory, the studio does not read it yet.
 * - `reserved` — the directory is claimed by the contract, its content is still a concept.
 */
export type ContentTypeState = 'implemented' | 'launcher-reads' | 'reserved'

/**
 * What one read of a content type's directory yields — deliberately the very same shape story
 * 010's reader already produces, so the validators below take it unchanged and a file-bridge
 * source can be swapped in without touching either side. `repoRoot` is whatever root the source
 * read against (a server-side path for a bridge, empty when nothing was read at all).
 */
export type ContentSourceRead = ContentRepoRead

/**
 * Where a descriptor's reader gets its files from. The one method a `news` read needs and nothing
 * more; `directory` is the descriptor's own `directory`, so a single source serves every content
 * type. Implementations never throw: a failure comes back as a `findings` entry on an otherwise
 * well-formed, empty read.
 */
export interface ContentTypeSource {
  read(directory: string): Promise<ContentSourceRead>
}

/**
 * The checks a content type can run on one read. Both are pure functions of the read — the studio
 * never re-derives what the launcher's own pipeline decides.
 */
export interface ContentTypeValidators {
  /** `now` is always the caller's: neither report ever reads the clock by itself. */
  readonly buildReport: (read: ContentSourceRead, now: Date) => ContentReport
  readonly collectFindings: (read: ContentSourceRead) => readonly RepositoryFinding[]
}

/**
 * Everything the studio knows about one content type. Minimal on purpose (v1): editor and preview
 * fields are added per content type, once that type is actually being edited.
 */
export interface ContentTypeDescriptor {
  readonly id: ContentTypeId
  /** English display name, e.g. `Game data`. */
  readonly label: string
  readonly state: ContentTypeState
  /** Repository-relative directory name, without a trailing slash, e.g. `news`. */
  readonly directory: string
  /** The file the launcher reads the directory through; absent while there is nothing to read. */
  readonly indexFile?: string
  /** Repository-relative path of the concept document; `reserved` types only. */
  readonly conceptPath?: string
  /** Reads this content type through the source the registry factory was given. */
  readonly reader?: () => Promise<ContentSourceRead>
  readonly validators?: ContentTypeValidators
}
