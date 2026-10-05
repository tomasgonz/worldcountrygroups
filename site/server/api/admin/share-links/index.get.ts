import { requireAdmin } from '~/server/utils/auth'
import { listShareLinks } from '~/server/utils/share-links'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return { links: listShareLinks() }
})
