import { requireAdmin } from '~/server/utils/auth'
import { testConnection } from '~/server/utils/backup'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  return await testConnection()
})
