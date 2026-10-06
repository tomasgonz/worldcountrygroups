import { buildIcs, findFeedByToken } from '~/server/utils/calendar-feeds'
import { siteOrigin } from '~/server/utils/calendar-feeds-api'

/**
 * Public iCalendar feed: GET /calendar/<token>.ics
 * Calendar apps cannot log in, so the secret token in the URL is the authorisation.
 * Outside /api, so the API auth middleware does not apply. GET and HEAD (some calendar
 * services probe with HEAD first).
 */
export default defineEventHandler((event) => {
  if (event.method !== 'GET' && event.method !== 'HEAD') {
    setHeader(event, 'allow', 'GET, HEAD')
    throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
  }
  const file = String(getRouterParam(event, 'file') || '')
  const token = file.replace(/\.ics$/i, '')
  const hit = file.toLowerCase().endsWith('.ics') ? findFeedByToken(token) : null
  setHeader(event, 'x-robots-tag', 'noindex, nofollow')
  setHeader(event, 'referrer-policy', 'no-referrer')
  if (!hit) {
    setHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 404, statusMessage: 'Calendar not found' })
  }
  const ics = buildIcs(hit.userId, { baseUrl: siteOrigin(event) })
  setHeader(event, 'content-type', 'text/calendar; charset=utf-8')
  setHeader(event, 'content-disposition', 'inline; filename="world-country-groups.ics"')
  setHeader(event, 'cache-control', 'private, max-age=300')
  return ics
})
