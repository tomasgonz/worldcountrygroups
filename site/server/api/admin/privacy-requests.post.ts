import { requireAdmin } from '~/server/utils/auth'
import { updateRequest } from '~/server/utils/privacy-requests'

/** { id, action: 'done' | 'reopen' | 'delete', note? } */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const b = await readBody(event)
  if (!['done', 'reopen', 'delete'].includes(b?.action)) throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  try { updateRequest(String(b.id), b.action, b.note) } catch { throw createError({ statusCode: 404, statusMessage: 'Not found' }) }
  return { ok: true }
})
