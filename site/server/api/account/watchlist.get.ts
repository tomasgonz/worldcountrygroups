import { requireAuth } from '~/server/utils/auth'
import { watchFeed } from '~/server/utils/watchlist'

/** What's new on the user's watchlist: ?days=1|7|30 */
export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  const days = [1, 7, 30].includes(Number(getQuery(event).days)) ? Number(getQuery(event).days) : 7
  return watchFeed(userId, days)
})
