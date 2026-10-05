import { findByToken, linkStatus, recordView, SHARE_COOKIE } from '~/server/utils/share-links'
import { logAccess, describeAgent } from '~/server/utils/share-access'

/** Opening a share link: log it, remember it in a cookie and go to the shared page. */
export default defineEventHandler((event) => {
  const token = String(getRouterParam(event, 'token') || '')
  const link = findByToken(token)
  const status = link ? linkStatus(link) : 'missing'
  const agent = describeAgent(String(getHeader(event, 'user-agent') || ''))

  // Messaging apps and mail scanners fetch links to build previews: log them, but don't
  // count them as opens (they'd use up limited links) and give them only a title card.
  if (agent.bot) {
    logAccess(event, { event: 'preview', linkId: link?.id || null, label: link?.label, visitor: null, device: agent.bot, path: link?.path })
    const title = link && status === 'active' ? `${link.label} — World Country Groups` : 'World Country Groups'
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="A page shared from World Country Groups."><meta name="robots" content="noindex"></head><body>${esc(title)}</body></html>`
  }

  if (!link || status !== 'active') {
    logAccess(event, { event: 'refused', linkId: link?.id || null, label: link?.label, reason: link ? status : 'unknown link' })
    return sendRedirect(event, `/shared?reason=${encodeURIComponent(status)}`, 302)
  }
  recordView(link.id)
  logAccess(event, { event: 'open', linkId: link.id, label: link.label, path: link.path })
  const maxAge = link.expiresAt ? Math.max(60, Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000)) : 60 * 60 * 24 * 90
  setCookie(event, SHARE_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge })
  setHeader(event, 'cache-control', 'no-store')
  return sendRedirect(event, link.path, 302)
})
