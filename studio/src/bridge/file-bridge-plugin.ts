import type { Plugin } from 'vite'

import { resolveRepoRoot } from '../content-repo/paths'
import { createFileBridge } from './create-file-bridge'

/**
 * The slice of `content-types/registry.ts`'s return shape this plugin actually reads. Spelled out
 * locally rather than `import type`-ed from the registry module itself: that module's own type
 * graph reaches, through `descriptors.ts` -> `report/repository-findings.ts` ->
 * `contract/launcher-safe-names.ts`, the same mirrored `launcher-core/` files whose relative
 * imports only resolve via this dev server's own plugins (see the note on `ssrLoadModule` below).
 * Pulling that graph into `tsc`'s check of *this* file - which is also a root file `vite.config.ts`
 * statically imports - reopens the same resolution failure `ssrLoadModule` exists to avoid at
 * runtime, just at typecheck time instead: this minimal local shape sidesteps it entirely, and
 * still fails loudly (a missing `.directory` on the real return value would be a type error at the
 * `.map()` call below) if the registry's shape ever changes underneath it.
 */
interface RegistryModule {
  createContentTypeRegistry: () => ReadonlyArray<{ readonly directory: string }>
}

/**
 * Story 015, D3: wires `createFileBridge` (D2) into the Vite dev server as `server.middlewares`,
 * the same way `mirror-runtime/newsImgMiddleware.ts` (now folded into the bridge and deleted) and
 * `mirror/provenance-plugin.ts` register their own middleware/virtual module.
 *
 * `apply: 'serve'` keeps this — and therefore every file-bridge route — out of a production
 * build entirely: nothing under `dist/` can ever expose repository-tree access, because the
 * plugin (and the middleware it wires) simply never runs outside `vite dev`.
 *
 * `directories` is derived from `createContentTypeRegistry()` (story 014) rather than hand-listed,
 * so the bridge names no content type in its own code — the registry stays the single source of
 * truth for which directories are part of the published surface. That registry's `news` descriptor
 * pulls in the mirrored `launcher-core/` tree (through `report/build-news-report` and
 * `contract/launcher-safe-names.ts`), whose relative imports only resolve through this same dev
 * server's plugins (`launcherBoundaryPlugin` redirects the two launcher files that cannot be
 * mirrored to studio-owned stubs). A plain `import`/`import()` of the registry from *this* file
 * would instead be resolved by Vite's own *config-file* loader, which bundles `vite.config.ts`
 * with a bare esbuild pass that runs no plugins at all, and fails before the server ever starts.
 * `server.ssrLoadModule` is Vite's own answer to exactly this: it loads a project module through
 * the *running* server's full transform pipeline - plugins included - from Node-side plugin code,
 * which is why it is used here instead of a static or dynamic `import`.
 */
export function fileBridgePlugin(): Plugin {
  return {
    name: 'studio:file-bridge',
    apply: 'serve',
    async configureServer(server) {
      const { createContentTypeRegistry } = (await server.ssrLoadModule(
        '/src/content-types/registry.ts',
      )) as RegistryModule
      const repoRoot = resolveRepoRoot(server.config.root)
      const directories = createContentTypeRegistry().map((descriptor) => descriptor.directory)
      server.middlewares.use(createFileBridge({ repoRoot, directories }))
    },
  }
}
