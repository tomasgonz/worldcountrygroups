import { NOSTATS_COOKIE } from '~/server/utils/share-access'

/** A visitor objects to shared-page statistics: remember the choice; nothing more is recorded about their visits. */
export default defineEventHandler(async (event) => {
  const b = await readBody(event).catch(() => ({}))
  if (b?.optOut === false) {
    deleteCookie(event, NOSTATS_COOKIE, { path: '/' })
    return { optedOut: false }
  }
  setCookie(event, NOSTATS_COOKIE, '1', { httpOnly: false, sameSite: 'lax', secure: true, path: '/', maxAge: 60 * 60 * 24 * 365 })
  return { optedOut: true }
})
