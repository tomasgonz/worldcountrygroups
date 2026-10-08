import { requireAdmin } from '~/server/utils/auth'
import {
  getCronJobs, getCronConfig, addCronJob, updateCronJob, removeCronJob, setCronJobEnabled, startJobNow, setAlertEmails,
} from '~/server/utils/cron-config'

export default defineEventHandler(async (event) => {
  requireAdmin(event)
  const body = await readBody(event)
  const { action, id } = body || {}
  const fail = (e: any) => { throw createError({ statusCode: 400, statusMessage: e?.message || String(e) }) }

  try {
    if (action === 'add') {
      const { job } = body
      if (!job?.id || !job?.script || !job?.schedule) throw new Error('Missing required job fields (id, script, schedule)')
      if (!/^scripts\/[\w.\-/]+\.py(\s+[\w.\-=]+)*$/.test(job.script) || job.script.includes('..')) throw new Error('Script must be a .py file under scripts/')
      if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(String(job.id))) throw new Error('Job id: lower-case letters, digits and dashes')
      if (!/^[\d*/,\- ]+$/.test(String(job.schedule)) || String(job.schedule).trim().split(/\s+/).length !== 5) throw new Error('Schedule must be a 5-field cron expression')
      job.schedule = String(job.schedule).trim()
      addCronJob({
        id: job.id, label: job.label || job.id, script: job.script, schedule: job.schedule, enabled: job.enabled ?? false,
        lastRun: null, lastError: null, logFile: '',
        maxAgeHours: job.maxAgeHours ? Number(job.maxAgeHours) : null,
        outputs: Array.isArray(job.outputs) ? job.outputs.filter((o: string) => /^[\w.\-]+\.json$/.test(o)) : [],
      })
      return { ok: true, jobs: getCronJobs() }
    }
    if (action === 'update') {
      if (!id) throw new Error('Missing job id')
      const { label, schedule, maxAgeHours, timeoutMin } = body
      const patch: any = {}
      if (label !== undefined) patch.label = String(label)
      if (schedule !== undefined) {
        if (!/^[\d*/,\- ]+$/.test(schedule) || schedule.trim().split(/\s+/).length !== 5) throw new Error('Schedule must be a 5-field cron expression')
        patch.schedule = schedule.trim()
      }
      if (maxAgeHours !== undefined) patch.maxAgeHours = maxAgeHours ? Number(maxAgeHours) : null
      if (timeoutMin !== undefined) patch.timeoutMin = Math.min(240, Math.max(1, Number(timeoutMin) || 30))
      updateCronJob(id, patch)
      return { ok: true, jobs: getCronJobs() }
    }
    if (action === 'toggle') {
      if (!id) throw new Error('Missing job id')
      setCronJobEnabled(id, !!body.enabled)
      return { ok: true, jobs: getCronJobs() }
    }
    if (action === 'run-now') {
      if (!id) throw new Error('Missing job id')
      startJobNow(id)
      return { ok: true, started: true, jobs: getCronJobs() }
    }
    if (action === 'remove') {
      if (!id) throw new Error('Missing job id')
      removeCronJob(id)
      return { ok: true, jobs: getCronJobs() }
    }
    if (action === 'alerts') {
      const emails = String(body.emails || '').split(/[,;\s]+/).filter(Boolean)
      return { ok: true, alertEmails: setAlertEmails(emails) }
    }
  } catch (e: any) {
    if (e?.statusCode) throw e
    fail(e)
  }
  throw createError({ statusCode: 400, statusMessage: `Unknown action: ${action}` })
})
