import { existsSync, openSync, readSync, closeSync, statSync } from 'fs'
import { join } from 'path'
import { requireAdmin } from '~/server/utils/auth'
import { JOB_LOG_DIR } from '~/server/utils/cron-config'

/** The last ~64 KB of a job's log. */
export default defineEventHandler((event) => {
  requireAdmin(event)
  const id = String(getQuery(event).id || '')
  if (!/^[a-z0-9-]+$/.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad job id' })
  const p = join(JOB_LOG_DIR, `${id}.log`)
  if (!existsSync(p)) return { id, text: '' }
  const size = statSync(p).size
  const n = Math.min(size, 64 * 1024)
  const buf = Buffer.alloc(n)
  const fd = openSync(p, 'r')
  try { readSync(fd, buf, 0, n, size - n) } finally { closeSync(fd) }
  let text = buf.toString('utf-8')
  if (size > n) text = text.slice(text.indexOf('\n') + 1)
  return { id, text }
})
