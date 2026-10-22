import { requireAdmin } from '~/server/utils/auth'
import { deleteMyForecast, listMyForecasts } from '~/server/utils/sg-my-forecast'

/** Remove one of your forecasts: ?at=<its timestamp>. */
export default defineEventHandler((event) => {
  const { userId } = requireAdmin(event)
  const at = String(getQuery(event).at || '')
  if (!deleteMyForecast(userId, at)) throw createError({ statusCode: 404, statusMessage: 'No such forecast' })
  return { entries: listMyForecasts(userId) }
})
