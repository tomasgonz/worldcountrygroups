import { requireAdmin } from '~/server/utils/auth'
import { initRepository } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return await initRepository()
})
