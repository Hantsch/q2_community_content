import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

import { fileBridgePlugin } from '../src/bridge/file-bridge-plugin'

/**
 * Story 015, D3, AC5: the file bridge must be unreachable outside `vite dev`. Two independent
 * proofs -
 *
 * - the plugin declares `apply: 'serve'`, so Vite itself excludes it from a production build;
 * - the browser entry point's own static import graph never reaches the bridge's server-side
 *   modules, and never reaches a Node built-in that would give the bundle server or raw-socket
 *   capability (`node:http`, `node:net`), so even a future edit that forgets to import the plugin
 *   correctly cannot smuggle one of those into the bundle.
 *
 * That second check does NOT assert "zero `node:` imports anywhere in the graph". Investigating
 * this test (2026-09-14) found that `src/contract/launcher-safe-names.ts` (story 013, pre-dating
 * the bridge) legitimately reaches `node:crypto`, `node:fs` and `node:fs/promises` through the
 * mirrored `launcher-core/` module graph (`images/paths.ts`'s content hash, `lib/fs-utils.ts` and
 * `images/image-cache.ts`'s cache housekeeping) - that module's own doc comment says as much, and
 * it is exempted in `eslint.config.js`. That chain is pre-existing and unrelated to this story, so
 * a blanket "no node: import" assertion is not actually true of this codebase and this test must
 * not assert it. What stays true, and is what AC5 actually claims, is that *no bridge server
 * module* is reachable, and that neither of the two built-ins that are distinctive of running an
 * HTTP server (rather than merely reading files, which the pre-existing chain above already does)
 * is reachable either.
 */

const FORBIDDEN_MODULES = ['src/bridge/create-file-bridge.ts', 'src/bridge/file-bridge-plugin.ts']

/**
 * The two Node built-ins that would mean the bundle can run a server or open a raw socket - the
 * capability that is actually new/risky about the bridge, as opposed to file reads, which a
 * pre-existing, documented, unrelated chain (see above) already reaches legitimately.
 */
const FORBIDDEN_NODE_BUILTINS = ['node:http', 'node:net']

const srcRoot = fileURLToPath(new URL('../src', import.meta.url))
const entryPoint = resolve(srcRoot, 'main.tsx')

// `import type { ... } from '...'` (and `export type { ... } from '...'`) is erased entirely by
// the bundler and never reaches the browser - so it is deliberately excluded here, the same way a
// real bundler's tree-shaking would exclude it. A mixed import (`import { type X, y } from '...'`)
// is NOT type-only and is still followed, since `y` does reach the bundle. `[\s\S]*?` (not `.*?`)
// spans the multi-line `import type {\n  ...\n} from '...'` shape this codebase's imports use.
const TYPE_ONLY_IMPORT_STATEMENT =
  /(?:^|\n)\s*(?:import|export)\s+type\s[\s\S]*?from\s+['"][^'"]*['"]/g
const RELATIVE_IMPORT_PATTERN = /from\s+['"](\.[^'"]*)['"]/g
const NODE_BUILTIN_IMPORT_PATTERN = /from\s+['"](node:[^'"]*)['"]/g

/** Strips every type-only import/export statement so only runtime-reaching specifiers remain. */
function withoutTypeOnlyImports(text: string): string {
  return text.replace(TYPE_ONLY_IMPORT_STATEMENT, '')
}

/** Candidate file extensions tried, in order, when a relative import specifier has none. */
const CANDIDATE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx']

function resolveRelativeImport(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier)
  for (const extension of CANDIDATE_EXTENSIONS) {
    const candidate = base + extension
    if (existsSync(candidate)) return candidate
  }
  // A directory import, e.g. `./foo` resolving to `./foo/index.ts`.
  for (const extension of ['.ts', '.tsx', '.js', '.jsx']) {
    const candidate = resolve(base, `index${extension}`)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

/**
 * Pragmatic text-based scan of relative imports, walked to a fixed point from `entry`. Not a
 * bundler: it only follows `./`/`../` specifiers, which is exactly the shape the story asks this
 * check to cover (`main.tsx` -> `App.tsx` -> whatever it renders) - but it walks the *whole* graph
 * (a `visited` set guards cycles, not a depth cap), because the real graph reaches seven hops deep
 * (`main.tsx -> App.tsx -> StudioPage.tsx -> registry.ts -> descriptors.ts ->
 * report/repository-findings.ts -> contract/launcher-safe-names.ts -> launcher-core/...`) and an
 * artificial cap would make the assertions below pass by not looking far enough, rather than by
 * being true.
 */
function collectReachableModules(entry: string): Set<string> {
  const visited = new Set<string>()
  const queue: string[] = [entry]

  while (queue.length > 0) {
    const file = queue.shift()!
    if (visited.has(file)) continue
    visited.add(file)

    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }

    const runtimeText = withoutTypeOnlyImports(text)
    for (const match of runtimeText.matchAll(RELATIVE_IMPORT_PATTERN)) {
      const resolved = resolveRelativeImport(file, match[1])
      if (resolved !== undefined && !visited.has(resolved)) {
        queue.push(resolved)
      }
    }
  }

  return visited
}

test('the bridge plugin is declared dev-server only', () => {
  const plugin = fileBridgePlugin()
  expect(plugin.apply).toBe('serve')
})

test('the browser entry point never statically imports the bridge server or a server/socket node: module', () => {
  const reachable = collectReachableModules(entryPoint)
  expect(reachable.size).toBeGreaterThan(1)

  for (const file of reachable) {
    for (const forbidden of FORBIDDEN_MODULES) {
      expect(file.replace(/\\/g, '/')).not.toContain(forbidden)
    }

    const runtimeText = withoutTypeOnlyImports(readFileSync(file, 'utf8'))
    for (const match of runtimeText.matchAll(NODE_BUILTIN_IMPORT_PATTERN)) {
      const builtin = match[1]
      expect(
        FORBIDDEN_NODE_BUILTINS.includes(builtin),
        `${file} imports ${builtin}, which would give the bundle server/socket capability`,
      ).toBe(false)
    }
  }
})
