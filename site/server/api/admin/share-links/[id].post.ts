import { requireAdmin } from '~/server/utils/auth'
import { updateShareLink, linkStatus } from '~/server/utils/share-links'

/** { action: 'revoke' | 'restore' | 'delete' | 'extend' | 'replace', days? } */
export default defineEventHandler(async (event) => {
  const { user } = requireAdmin(event) as any
  const id = String(getRouterParam(event, 'id'))
  const b = await readBody(event)
  if (!['revoke', 'restore', 'delete', 'extend', 'replace'].includes(b?.action)) throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  try {
    const l = updateShareLink(id, b.action, b.days == null ? undefined : Number(b.days), user?.displayName || user?.username)
    return { link: l ? { ...l, status: linkStatus(l) } : null }
  } catch (e: any) {
    throw createError({ statusCode: /already has/.test(e?.message) ? 409 : 404, statusMessage: e?.message || 'Not found' })
  }
})
