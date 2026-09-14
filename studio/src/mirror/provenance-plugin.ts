import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Plugin } from 'vite'

import { readMirrorProvenance } from './read-provenance'

/**
 * Serves mirror provenance (story 009, D4) as a build-time virtual module rather than a runtime
 * fetch (Decisions): `import provenance from 'virtual:mirror-provenance'` resolves to the plain
 * `MirrorProvenance` object `readMirrorProvenance` returns, computed once per dev-server boot /
 * build, not per-request.
 */

const VIRTUAL_MODULE_ID = 'virtual:mirror-provenance'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

const pluginDirectory = dirname(fileURLToPath(import.meta.url))

/** `studio/src/mirror/` sits three levels below the repo root (`studio/` is one of those). */
const DEFAULT_REPO_ROOT = resolve(pluginDirectory, '../../..')

export function mirrorProvenancePlugin(repoRoot: string = DEFAULT_REPO_ROOT): Plugin {
  let generatedSource: string | undefined

  return {
    name: 'studio:mirror-provenance',
    resolveId(id) {
      return id === VIRTUAL_MODULE_ID ? RESOLVED_VIRTUAL_MODULE_ID : null
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return null

      if (generatedSource === undefined) {
        const provenance = readMirrorProvenance(repoRoot)
        generatedSource = `export default ${JSON.stringify(provenance)};`
      }

      return generatedSource
    },
  }
}
