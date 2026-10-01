import { execFile } from 'child_process'
import { join } from 'path'
import {
  getCronJobs,
  addCronJob,
  updateCronJob,
  removeCronJob,
  setCronJobEnabled,
  recordJobRun,
} from '~/server/utils/cron-config'

const PROJECT_ROOT = join(process.env.HOME || '/home/exedev', 'worldcountrygroups')

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { action } = body

  if (action === 'add') {
    const { job } = body
    if (!job?.id || !job?.script || !job?.schedule) {
      throw createError({ statusCode: 400, statusMessage: 'Missing required job fields (id, script, schedule)' })
    }
    addCronJob({
      id: job.id,
      label: job.label || job.id,
      script: job.script,
      schedule: job.schedule,
      enabled: job.enabled ?? false,
      lastRun: null,
      lastError: null,
      logFile: job.logFile || `/tmp/${job.id}.log`,
    })
    return { ok: true, jobs: getCronJobs() }
  }

  if (action === 'update') {
    const { id, ...fields } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing job id' })
    const { action: _a, ...update } = fields
    updateCronJob(id, update)
    return { ok: true, jobs: getCronJobs() }
  }

  if (action === 'toggle') {
    const { id, enabled } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing job id' })
    setCronJobEnabled(id, !!enabled)
    return { ok: true, jobs: getCronJobs() }
  }

  if (action === 'run-now') {
    const { id } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing job id' })
    const jobs = getCronJobs()
    const job = jobs.find(j => j.id === id)
    if (!job) throw createError({ statusCode: 404, statusMessage: `Job '${id}' not found` })

    const scriptPath = join(PROJECT_ROOT, job.script)

    return new Promise((resolve) => {
      execFile('/usr/bin/python3', [scriptPath], {
        cwd: PROJECT_ROOT,
        timeout: 300_000,
        env: { ...process.env, HOME: process.env.HOME || '/home/exedev' },
      }, (error, stdout, stderr) => {
        if (error) {
          const errMsg = stderr?.trim() || error.message
          recordJobRun(id, errMsg)
          resolve({ ok: false, error: errMsg, jobs: getCronJobs() })
        } else {
          recordJobRun(id)
          resolve({ ok: true, output: stdout?.trim()?.slice(0, 2000), jobs: getCronJobs() })
        }
      })
    })
  }

  if (action === 'remove') {
    const { id } = body
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing job id' })
    removeCronJob(id)
    return { ok: true, jobs: getCronJobs() }
  }

  throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
})
