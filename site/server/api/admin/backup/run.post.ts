import { requireAdmin } from '~/server/utils/auth'
import { startBackup } from '~/server/utils/backup'

export default defineEventHandler((event) => {
  requireAdmin(event)
  const r = startBackup()
  if (!r.started) throw createError({ statusCode: 409, statusMessage: r.message })
  return r
})
