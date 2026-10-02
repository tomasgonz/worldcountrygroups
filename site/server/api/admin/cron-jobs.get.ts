import { requireAdmin } from '~/server/utils/auth'
import { getCronConfig } from '~/server/utils/cron-config'

export default defineEventHandler((event) => {
  requireAdmin(event)
  const cfg = getCronConfig()
  return { jobs: cfg.jobs, alertEmails: cfg.alertEmails || [] }
})
