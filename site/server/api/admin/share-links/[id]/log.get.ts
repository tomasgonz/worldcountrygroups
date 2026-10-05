import { requireAdmin } from '~/server/utils/auth'
import { readAccess } from '~/server/utils/share-access'

/** Access log for one link (?format=csv for a download). Use id "refused" for attempts with unknown links. */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const id = String(getRouterParam(event, 'id'))
  const entries = id === 'refused' ? readAccess().filter(e => e.event === 'refused' && !e.linkId) : readAccess(id)
  if (getQuery(event).format === 'csv') {
    const cols = ['t', 'event', 'reason', 'path', 'visitor', 'network', 'device', 'lang', 'referer'] as const
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    setHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setHeader(event, 'content-disposition', `attachment; filename="share-link-${id}-access.csv"`)
    return [cols.join(','), ...entries.map(e => cols.map(c => q((e as any)[c])).join(','))].join('\n')
  }
  return { entries: entries.slice(0, 2000) }
})
