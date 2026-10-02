import { requireAdmin } from '~/server/utils/auth'
import { listSnapshots } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await listSnapshots()
})
