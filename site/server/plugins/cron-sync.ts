import { getCronJobs } from '~/server/utils/cron-config'

/** On startup, bring the stored job list up to date (new default jobs reach the crontab without visiting the admin). */
export default defineNitroPlugin(() => {
  try { getCronJobs() } catch (e) { console.error('cron sync failed', e) }
})
