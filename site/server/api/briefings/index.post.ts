import { requireAuth } from '~/server/utils/auth'
import { createSchedule, scheduleSummary } from '~/server/utils/briefing-schedules'

/** Create a scheduled briefing: { title?, question, mode, template, language, frequency, weekday, day, hour, email } */
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  try {
    const s = createSchedule(userId, (await readBody(event)) || {})
    return { schedule: { ...s, summary: scheduleSummary(s) } }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not create the schedule' })
  }
})
