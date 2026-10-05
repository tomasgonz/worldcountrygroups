import { findByToken, linkStatus, recordView, SHARE_COOKIE } from '~/server/utils/share-links'

/** Opening a share link: remember it in a cookie and go to the shared page. */
export default defineEventHandler((event) => {
  const token = String(getRouterParam(event, 'token') || '')
  const link = findByToken(token)
  const status = link ? linkStatus(link) : 'missing'
  if (!link || status !== 'active') {
    return sendRedirect(event, `/shared?reason=${encodeURIComponent(status)}`, 302)
  }
  recordView(link.id)
  const maxAge = link.expiresAt ? Math.max(60, Math.floor((new Date(link.expiresAt).getTime() - Date.now()) / 1000)) : 60 * 60 * 24 * 90
  setCookie(event, SHARE_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge })
  return sendRedirect(event, link.path, 302)
})
