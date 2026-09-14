/**
 * Story 014 D1: the registry factory — `createContentTypeRegistry({ source })` hands back the six
 * descriptors with their file source already bound, the injected-argument pattern
 * `content-repo/read-content-repo.ts` established for `repoRoot`.
 *
 * The default source exists so this story ships standalone: story 015's file-bridge client is not
 * written yet, and until it is, a caller that passes no source gets a source that reads nothing and
 * says so in a finding rather than throwing. Swapping the real client in later changes this default
 * and nothing else.
 */
import type { ContentTypeDescriptor, ContentTypeSource } from './descriptor'
import { createContentTypeDescriptors } from './descriptors'

/**
 * Stands in for story 015's file bridge until it exists. Reads nothing, never throws: every call
 * resolves to a well-formed empty read whose single finding names the missing bridge, so a caller
 * renders "not available" instead of crashing.
 */
export const unavailableFileBridgeSource: ContentTypeSource = {
  read: (directory) =>
    Promise.resolve({
      repoRoot: '',
      index: { text: '', value: undefined, parsed: false },
      documents: {},
      drafts: [],
      images: [],
      findings: [
        {
          code: 'file-bridge-unavailable',
          severity: 'error',
          message: `${directory}/ was not read: no file bridge is bound to this registry.`,
          path: directory,
        },
      ],
    }),
}

export interface CreateContentTypeRegistryOptions {
  /** Defaults to `unavailableFileBridgeSource`; tests bind a fixture source, the app the real one. */
  readonly source?: ContentTypeSource
}

/** The six content types, in their fixed order, bound to `source`. */
export function createContentTypeRegistry(
  options: CreateContentTypeRegistryOptions = {},
): readonly ContentTypeDescriptor[] {
  return createContentTypeDescriptors(options.source ?? unavailableFileBridgeSource)
}
