import { createReadStream, existsSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

import type { Plugin } from 'vite'

import { NEWS_IMAGE_URL_PREFIX } from './newsImageUrl'

/**
 * Dev-only middleware (AC6, story 008 D5): the cover slide fixture's `imageUrl` points at
 * `/news-img/cover-community-welcome.png`, a URL the mirrored `<img>` markup requests as-is - so
 * something has to answer it from `news/img/` at the repository root, without the launcher ever
 * fetching it (`news/` stays content-only per CLAUDE.md/AGENTS.md; this plugin only *reads* it).
 *
 * Read-only and path-confined, the same way `scripts/sync-launcher.ts`'s `isInside()` keeps writes
 * inside `studio/src/launcher-core/`: only GET/HEAD are handled, and the requested file name is
 * resolved against `news/img/` and checked to still be inside it before anything is served, so a
 * `..`-based traversal request is rejected rather than served.
 */

/** True when `candidate` lies strictly inside `root` - a path check, not a string prefix check. */
function isInside(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate)
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath)
}

export function newsImgMiddlewarePlugin(): Plugin {
  return {
    name: 'studio:news-img-middleware',
    configureServer(server) {
      const newsImgRoot = resolve(server.config.root, '..', 'news', 'img')

      server.middlewares.use((req, res, next) => {
        if (req.url === undefined || !req.url.startsWith(NEWS_IMAGE_URL_PREFIX)) {
          next()
          return
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.statusCode = 405
          res.end('Method Not Allowed')
          return
        }

        const requested = req.url.slice(NEWS_IMAGE_URL_PREFIX.length).split('?')[0].split('#')[0]
        let fileName: string
        try {
          fileName = decodeURIComponent(requested)
        } catch {
          res.statusCode = 400
          res.end('Bad Request')
          return
        }

        const resolvedPath = resolve(newsImgRoot, fileName)
        if (!isInside(newsImgRoot, resolvedPath) || !existsSync(resolvedPath)) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }

        const stat = statSync(resolvedPath)
        if (!stat.isFile()) {
          res.statusCode = 404
          res.end('Not Found')
          return
        }

        res.statusCode = 200
        res.setHeader('Content-Length', stat.size)
        if (req.method === 'HEAD') {
          res.end()
          return
        }
        createReadStream(resolvedPath).pipe(res)
      })
    },
  }
}
