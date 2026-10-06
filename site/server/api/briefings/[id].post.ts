import { requireAuth } from '~/server/utils/auth'
import { listSchedules, updateSchedule, runSchedule, scheduleSummary } from '~/server/utils/briefing-schedules'

/** Update ({...fields}), pause/resume ({enabled}), delete ({action:'delete'}) or run now ({action:'run'}). */
export default defineEventHandler(async (event) => {
  const { userId, user } = requireAuth(event)
  const id = String(getRouterParam(event, 'id'))
  const b = (await readBody(event)) || {}
  try {
    if (b.action === 'run') {
      const s = listSchedules().find(x => x.id === id && (x.userId === userId || user.role === 'admin'))
      if (!s) throw new Error('Not found')
      const r = await runSchedule(s)
      return { ok: r.ok, askId: r.askId, error: r.error }
    }
    const s = updateSchedule(userId, id, b, user.role === 'admin')
    return { schedule: s ? { ...s, summary: scheduleSummary(s) } : null }
  } catch (e: any) {
    throw createError({ statusCode: 400, statusMessage: e?.message || 'Could not update' })
  }
})
