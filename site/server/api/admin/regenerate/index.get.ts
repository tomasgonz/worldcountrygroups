import { requireAdmin } from '~/server/utils/auth'
import { regenerateStatus } from '~/server/utils/regenerate'

/** ?ids=un-briefing,fetch-unsc → state of each job or task */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const ids = String(getQuery(event).ids || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)
  return { items: regenerateStatus(ids) }
})
