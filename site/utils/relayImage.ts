/** Serve an external image through the site's own relay, so the visitor's browser doesn't contact the image host. */
export function relayImage(url?: string | null): string {
  if (!url) return ''
  if (url.startsWith('/')) return url
  return `/api/img?u=${encodeURIComponent(url)}`
}
