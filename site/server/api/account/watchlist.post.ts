import { requireAuth } from '~/server/utils/auth'
import { setWatchExtras } from '~/server/utils/watchlist'

/** Followed UN offices and topics: { offices?: string[], topics?: string[] } (countries and groups are bookmarks) */
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const b = await readBody(event)
  return setWatchExtras(userId, { offices: b?.offices, topics: b?.topics })
})
