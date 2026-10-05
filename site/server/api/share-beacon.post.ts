import { getSession } from '~/server/utils/auth'
import { shareFromEvent } from '~/server/utils/share-links'
import { logAccess, visitorId } from '~/server/utils/share-access'

/** Pages viewed by a visitor who came through a share link (sent by the browser on each navigation). */
export default defineEventHandler(async (event) => {
  if (getSession(event)) return { ok: true }
  const share = shareFromEvent(event)
  if (!share) return { ok: false }
  const b = await readBody(event).catch(() => ({}))
  const path = String(b?.path || '').slice(0, 300)
  if (!path.startsWith('/')) return { ok: false }
  logAccess(event, { event: 'view', linkId: share.id, label: share.label, path, visitor: visitorId(event, false) })
  return { ok: true }
})
