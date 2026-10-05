import { requireAdmin } from '~/server/utils/auth'
import { listShareLinks } from '~/server/utils/share-links'
import { accessSummary, readAccess } from '~/server/utils/share-access'

export default defineEventHandler((event) => {
  requireAdmin(event)
  const sum = accessSummary()
  const empty = { opens: 0, previews: 0, refused: 0, visitors: 0, ips: 0, views: 0, lastOpen: null }
  const refusedUnknown = readAccess().filter(e => e.event === 'refused' && !e.linkId).length
  return { links: listShareLinks().map(l => ({ ...l, access: sum[l.id] || empty })), refusedUnknown }
})
