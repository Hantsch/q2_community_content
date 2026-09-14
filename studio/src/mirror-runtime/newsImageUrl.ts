/**
 * `/news-img/` is the URL prefix `newsImgMiddlewarePlugin` (`newsImgMiddleware.ts`) serves
 * `news/img/` under, and the prefix the slide fixtures (`slideFixtures.ts`) already author their
 * `imageUrl` values with. This helper is the one place that prefix is spelled out, so the
 * middleware and any future caller agree on it without repeating the string literal.
 */
export const NEWS_IMAGE_URL_PREFIX = '/news-img/'

/** Turns a bare file name (e.g. `cover-community-welcome.png`) into the URL the middleware serves
 * it under. Rejects a name that would escape the prefix (a path separator or a leading `.`),
 * since a caller passing one of those almost certainly holds a full path or URL by mistake. */
export function newsImageUrl(fileName: string): string {
  if (
    fileName.length === 0 ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.startsWith('.')
  ) {
    throw new Error(`newsImageUrl: "${fileName}" is not a bare file name`)
  }
  return `${NEWS_IMAGE_URL_PREFIX}${fileName}`
}
