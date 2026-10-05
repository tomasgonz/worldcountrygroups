import { requireAdmin } from '~/server/utils/auth'
import { updateShareLink, linkStatus } from '~/server/utils/share-links'

/** { action: 'revoke' | 'restore' | 'delete' | 'extend', days? } */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const id = String(getRouterParam(event, 'id'))
  const b = await readBody(event)
  if (!['revoke', 'restore', 'delete', 'extend'].includes(b?.action)) throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  try {
    const l = updateShareLink(id, b.action, b.days == null ? undefined : Number(b.days))
    return { link: l ? { ...l, status: linkStatus(l) } : null }
  } catch (e: any) {
    throw createError({ statusCode: 404, statusMessage: e?.message || 'Not found' })
  }
})
