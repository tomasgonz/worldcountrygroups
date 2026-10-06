import { requireInternal } from '~/server/utils/internal-token'
import { runDueSchedules } from '~/server/utils/briefing-schedules'
import { runAlerts } from '~/server/utils/alerts'

/** Scheduler entry point (scripts/refresh_site_data.py briefings|alerts): ?task=briefings|alerts */
export default defineEventHandler(async (event) => {
  requireInternal(event)
  const task = String(getQuery(event).task || '')
  if (task === 'briefings') return { ok: true, ...(await runDueSchedules()) }
  if (task === 'alerts') return { ok: true, ...(await runAlerts()) }
  throw createError({ statusCode: 400, statusMessage: 'Unknown task' })
})
