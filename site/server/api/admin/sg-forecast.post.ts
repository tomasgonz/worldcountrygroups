import { requireAdmin } from '~/server/utils/auth'
import { addMyForecast, listMyForecasts } from '~/server/utils/sg-my-forecast'

/** Save a forecast: { percent: { candidateId: 0-100 }, note? }. The rest goes to "someone else". */
export default defineEventHandler(async (event) => {
  const { userId } = requireAdmin(event)
  const b = await readBody(event)
  try {
    const entry = addMyForecast(userId, b?.percent || {}, b?.note)
    return { entry, entries: listMyForecasts(userId) }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not save' })
  }
})
