import { requireAuth } from '~/server/utils/auth'
import { getFeed, DEFAULT_INCLUDE } from '~/server/utils/calendar-feeds'
import { calendarResponse } from '~/server/utils/calendar-feeds-api'

/** Your calendar subscription: options and the secret feed URL (null if not set up yet). */
export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  setHeader(event, 'cache-control', 'no-store')
  const feed = getFeed(userId)
  return calendarResponse(event, userId, feed, DEFAULT_INCLUDE)
})
