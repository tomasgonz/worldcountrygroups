import { requireAdmin } from '~/server/utils/auth'
import { getBackupStatus } from '~/server/utils/backup'

export default defineEventHandler((event) => {
  requireAdmin(event)
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return getBackupStatus()
})
