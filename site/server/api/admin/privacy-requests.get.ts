import { requireAdmin } from '~/server/utils/auth'
import { listRequests } from '~/server/utils/privacy-requests'

export default defineEventHandler((event) => {
  requireAdmin(event)
  return { requests: listRequests() }
})
