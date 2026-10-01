import { getCronJobs } from '~/server/utils/cron-config'

export default defineEventHandler(() => {
  return { jobs: getCronJobs() }
})
