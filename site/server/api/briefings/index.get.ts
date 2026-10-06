import { requireAuth } from '~/server/utils/auth'
import { listSchedules, scheduleSummary, MAX_PER_USER } from '~/server/utils/briefing-schedules'

export default defineEventHandler((event) => {
  const { userId } = requireAuth(event)
  return { max: MAX_PER_USER, schedules: listSchedules(userId).map(s => ({ ...s, summary: scheduleSummary(s) })) }
})
