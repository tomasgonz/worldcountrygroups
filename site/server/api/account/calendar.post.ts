import { requireAuth } from '~/server/utils/auth'
import { deleteFeed, regenerateFeedToken, updateFeedSettings, DEFAULT_INCLUDE } from '~/server/utils/calendar-feeds'
import { calendarResponse } from '~/server/utils/calendar-feeds-api'

/**
 * Update your calendar subscription.
 * Body: { include: {...} } saves options (creating the feed on first use);
 *       { action: 'regenerate' } issues a new secret link (the old URL stops working);
 *       { action: 'delete' } turns the subscription off.
 */
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  setHeader(event, 'cache-control', 'no-store')
  const body = (await readBody(event)) || {}
  if (body.action === 'regenerate') {
    return calendarResponse(event, userId, regenerateFeedToken(userId), DEFAULT_INCLUDE)
  }
  if (body.action === 'delete') {
    deleteFeed(userId)
    return calendarResponse(event, userId, null, DEFAULT_INCLUDE)
  }
  if (body.action && body.action !== 'save') {
    throw createError({ statusCode: 400, statusMessage: 'action must be save, regenerate or delete' })
  }
  if (body.include != null && typeof body.include !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'include must be an object' })
  }
  return calendarResponse(event, userId, updateFeedSettings(userId, body.include || {}), DEFAULT_INCLUDE)
})
