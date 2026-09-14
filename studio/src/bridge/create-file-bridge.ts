/**
 * Story 015, D2/D3: the local file bridge's server-side middleware. It is the one place that
 * turns a browser-supplied HTTP request into a read of the working tree, and it only ever reads —
 * `resolveBridgePath` (D1) refuses anything that would escape the declared directories, and
 * `readContentRepo` (story 010) never writes.
 *
 * `repoRoot` and `directories` are constructor arguments only: nothing in a request (query
 * parameter or header) can ever override them, which is the story's sprint decision — the fixture
 * root a test points this at is wired once, at construction, never as a runtime toggle.
 *
 * Besides the `/__studio/fs/` routes it also answers `GET /news-img/<filename>` (D3), folding in
 * what used to be the standalone `mirror-runtime/newsImgMiddleware.ts` so there is exactly one
 * guarded file-access path in the dev server, not two. That route keeps `newsImageUrl.ts`'s
 * existing URL prefix rather than moving under `BRIDGE_PREFIX` — see that module's doc comment.
 *
 * A plain `(req, res, next)` function, GET/HEAD only, path-confined via `resolveBridgePath`, so
 * D3's Vite plugin can register it with `server.middlewares.use(...)`.
 */
import { createReadStream, readFileSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname } from 'node:path'
import { URL } from 'node:url'

import { readContentRepo } from '../content-repo/read-content-repo'
import { readMirrorProvenance } from '../mirror/read-provenance'
import { NEWS_IMAGE_URL_PREFIX } from '../mirror-runtime/newsImageUrl'
import { BRIDGE_PREFIX, type BridgeErrorResponse, type BridgeFileResponse } from './bridge-protocol'
import { resolveBridgePath } from './resolve-bridge-path'

/**
 * The image route (`GET /news-img/<filename>`, story 015 D3) deliberately keeps the URL prefix
 * `newsImageUrl.ts` already defines rather than moving under `BRIDGE_PREFIX` - see that module's
 * doc comment and the story's Decisions. It is folded into this same middleware, guarded by the
 * same method/host/origin checks above and the same `resolveBridgePath` (D1) containment check as
 * every other route, so it is not a second, independently guarded file-access path.
 *
 * Only raster formats are served; `.svg` (and anything else) is refused even if the file exists,
 * because an SVG served same-origin can carry a `<script>` and nothing in the studio needs one.
 */
const RASTER_CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export interface CreateFileBridgeOptions {
  /** Absolute path to the repository checkout root — the only root this bridge will ever read. */
  readonly repoRoot: string
  /** Repository-relative directory names declared reachable, e.g. `['news']`. */
  readonly directories: readonly string[]
}

export type FileBridgeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void

/** Loopback hostnames the origin/host guard accepts, with or without a port suffix. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function isLoopbackHost(hostHeaderValue: string): boolean {
  // Strip a trailing `:<port>` — but not the brackets/colon that belong to an IPv6 literal.
  const withoutPort = hostHeaderValue.startsWith('[')
    ? hostHeaderValue.replace(/^(\[[^\]]+\])(:\d+)?$/, '$1')
    : hostHeaderValue.replace(/:\d+$/, '')
  return LOOPBACK_HOSTS.has(withoutPort)
}

function sendJson(res: ServerResponse, status: number, body: unknown, method: string): void {
  const text = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(text))
  // HEAD reports the same status/headers a GET would, with no body — the same contract
  // `newsImgMiddleware.ts` follows for its own GET/HEAD route.
  res.end(method === 'HEAD' ? undefined : text)
}

function sendError(res: ServerResponse, status: number, error: string, method = 'GET'): void {
  const body: BridgeErrorResponse = { error }
  sendJson(res, status, body, method)
}

/** Same JSON error shape as `sendError`, plus the `nosniff` header the image route sets on every
 * response it sends, refusals included. */
function sendImageError(res: ServerResponse, status: number, error: string, method: string): void {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  sendError(res, status, error, method)
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

/**
 * Creates the file bridge's connect-style middleware. `repoRoot`/`directories` are bound once at
 * construction time; a `repoRoot`/`root` query parameter on any request is deliberately never
 * read, so it cannot override them.
 */
export function createFileBridge({
  repoRoot,
  directories,
}: CreateFileBridgeOptions): FileBridgeMiddleware {
  return function fileBridgeMiddleware(req, res, next) {
    const rawUrl = req.url
    const isBridgeRoute = rawUrl !== undefined && rawUrl.startsWith(BRIDGE_PREFIX)
    const isImageRoute = rawUrl !== undefined && rawUrl.startsWith(NEWS_IMAGE_URL_PREFIX)
    if (rawUrl === undefined || (!isBridgeRoute && !isImageRoute)) {
      next()
      return
    }

    // Read-only, checked before any routing: no bridge route ever accepts a write method.
    const method = req.method ?? 'GET'
    if (method !== 'GET' && method !== 'HEAD') {
      sendError(res, 405, 'method not allowed')
      return
    }

    // Defence in depth alongside the loopback bind D3 sets: refuse a non-loopback Host, and a
    // cross-origin Origin, before any route runs. A missing Host header is refused too (default
    // deny, not default allow) - a real browser always sends one, but a raw HTTP client that omits
    // it entirely must not be treated as trusted just because there was nothing to check.
    const hostHeader = headerValue(req.headers.host)
    if (hostHeader === undefined || !isLoopbackHost(hostHeader)) {
      sendError(res, 403, 'non-loopback host', method)
      return
    }

    const originHeader = headerValue(req.headers.origin)
    if (originHeader !== undefined) {
      let originHostname: string | undefined
      try {
        originHostname = new URL(originHeader).hostname
      } catch {
        originHostname = undefined
      }
      const bracketed = originHostname !== undefined ? `[${originHostname}]` : undefined
      if (
        originHostname === undefined ||
        (!LOOPBACK_HOSTS.has(originHostname) &&
          (bracketed === undefined || !LOOPBACK_HOSTS.has(bracketed)))
      ) {
        sendError(res, 403, 'cross-origin request refused', method)
        return
      }
    }

    // A base is required for `URL` to parse a path-only `req.url`; the value never leaves this
    // function and is not used as an actual network origin.
    const url = new URL(rawUrl, 'http://bridge.local')

    if (isImageRoute) {
      const rawFileName = url.pathname.slice(NEWS_IMAGE_URL_PREFIX.length)
      let fileName: string
      try {
        fileName = decodeURIComponent(rawFileName)
      } catch {
        sendImageError(res, 400, `${rawFileName}: undecodable percent-escape`, method)
        return
      }

      const extension = extname(fileName).toLowerCase()
      const contentType = RASTER_CONTENT_TYPES[extension]
      if (contentType === undefined) {
        sendImageError(res, 403, `${fileName}: extension not allowed`, method)
        return
      }

      // `resolveBridgePath` resolves `requestPath` against `repoRoot` directly (`directories` is
      // only its containment check), so the path must be repo-root-relative - `news/img/<file>`,
      // not `img/<file>`. The declared directory is `news/img` itself, not `news`, so the
      // containment check confines this route to `news/img/` specifically - a `..` in `fileName`
      // cannot land anywhere else under `news/`.
      const resolved = resolveBridgePath({
        repoRoot,
        directories: ['news/img'],
        requestPath: `news/img/${fileName}`,
      })
      if (!resolved.ok) {
        sendImageError(res, 403, resolved.reason, method)
        return
      }

      let size: number
      try {
        size = statSync(resolved.absolutePath).size
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        sendImageError(res, 404, `${fileName}: ${message}`, method)
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Length', size)
      if (method === 'HEAD') {
        res.end()
        return
      }
      createReadStream(resolved.absolutePath).pipe(res)
      return
    }

    const route = url.pathname.slice(BRIDGE_PREFIX.length)

    if (route === 'read') {
      const type = url.searchParams.get('type')
      if (type === null || !directories.includes(type)) {
        sendError(res, 404, `${String(type)}: not a declared content-type directory`, method)
        return
      }
      // Only `news` has a real reader today (story 010's reader is news-specific). A declared
      // directory that isn't `news` must not silently fall through to the news read.
      if (type !== 'news') {
        sendError(res, 404, `${type}: no reader is implemented for this content type yet`, method)
        return
      }
      const repo = readContentRepo({ repoRoot })
      sendJson(res, 200, repo, method)
      return
    }

    if (route === 'file') {
      const requestPath = url.searchParams.get('path')
      if (requestPath === null || requestPath === '') {
        sendError(res, 400, 'path: missing query parameter', method)
        return
      }

      const resolved = resolveBridgePath({ repoRoot, directories, requestPath })
      if (!resolved.ok) {
        sendError(res, 403, resolved.reason, method)
        return
      }

      let text: string
      try {
        text = readFileSync(resolved.absolutePath, 'utf8')
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        sendError(res, 403, `${requestPath}: ${message}`, method)
        return
      }

      const body: BridgeFileResponse = { path: requestPath, text }
      sendJson(res, 200, body, method)
      return
    }

    if (route === 'provenance') {
      // No query parameter is ever read here — story 017 D4. Any `path`/`type`/other query string
      // present on the request is simply ignored, not rejected, so this route answers the same
      // `MirrorProvenance` for `repoRoot` on every request and reads no path from the request at
      // all, matching this file's own repoRoot/directories discipline (see the header comment).
      const provenance = readMirrorProvenance(repoRoot)
      sendJson(res, 200, provenance, method)
      return
    }

    sendError(res, 404, `${route}: not a bridge route`, method)
  }
}
