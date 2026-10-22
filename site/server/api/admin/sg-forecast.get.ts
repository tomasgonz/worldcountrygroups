import { requireAdmin } from '~/server/utils/auth'
import { listMyForecasts, scoreMyForecasts } from '~/server/utils/sg-my-forecast'

/** Your own forecasts on the Secretary-General race (latest first) and, once decided, the scores. */
export default defineEventHandler((event) => {
  const { userId } = requireAdmin(event)
  return { entries: listMyForecasts(userId), score: scoreMyForecasts(userId) }
})
