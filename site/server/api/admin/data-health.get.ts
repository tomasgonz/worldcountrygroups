import { join } from 'path'
import { requireAdmin } from '~/server/utils/auth'
import { runPython } from '~/server/utils/run-python'
import { getCronJobs } from '~/server/utils/cron-config'

/** Live data-health report: job status, dataset ages, and the UN voting-data gap. */
export default defineEventHandler(async (event) => {
  requireAdmin(event)
  getCronJobs() // make sure the stored config is migrated before the checker reads it
  const script = join(process.env.HOME || '/home/exedev', 'worldcountrygroups/scripts/check_data_health.py')
  const { stdout } = await runPython(script, ['--json'], { timeout: 60_000 })
  return JSON.parse(stdout)
})
