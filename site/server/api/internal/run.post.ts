import { requireInternal } from '~/server/utils/internal-token'
import { runDueSchedules } from '~/server/utils/briefing-schedules'
import { runAlerts } from '~/server/utils/alerts'
import { fetchBilled, checkBudget } from '~/server/utils/ai-spend'
import { runSaid } from '~/server/utils/said'

/** Scheduler entry point (scripts/refresh_site_data.py briefings|alerts): ?task=briefings|alerts */
export default defineEventHandler(async (event) => {
  requireInternal(event)
  const task = String(getQuery(event).task || '')
  if (task === 'briefings') return { ok: true, ...(await runDueSchedules()) }
  if (task === 'alerts') return { ok: true, ...(await runAlerts()) }
  if (task === 'said') return { ok: true, sections: await runSaid() }
  if (task === 'ai-costs') {
    const f = await fetchBilled()
    const fired = await checkBudget()
    // a missing Admin key is not a failure: estimates are used instead
    return { ok: f.ok || f.error === 'No OpenAI Admin key set', billed: f, budgetAlerts: fired }
  }
  throw createError({ statusCode: 400, statusMessage: 'Unknown task' })
})
