import { requireAdmin } from '~/server/utils/auth'
import { pageLinkFor, linkStatus } from '~/server/utils/share-links'

/** The standing link of a page: ?path=/elections */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const l = pageLinkFor(String(getQuery(event).path || ''))
  return { link: l ? { ...l, status: linkStatus(l) } : null }
})
