import { requireAuth } from '~/server/utils/auth'
import { markRead } from '~/server/utils/notifications'

/** { ids: string[] } or { all: true } */
export default defineEventHandler(async (event) => {
  const { userId } = requireAuth(event)
  const b = await readBody(event)
  markRead(userId, b?.all ? 'all' : (Array.isArray(b?.ids) ? b.ids.map(String) : []))
  return { ok: true }
})
