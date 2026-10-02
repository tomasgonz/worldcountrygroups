import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getAsk, updateAsk } from '~/server/utils/ask-runner'

/** Review (verified / incorrect + note), share, or delete a saved question. */
export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const id = String(getRouterParam(event, 'id'))
  const a = getAsk(id)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const owner = a.userId === user.id || user.role === 'admin'
  const body = await readBody(event)
  if (body?.action === 'review') {
    if (!owner && !a.shared) throw createError({ statusCode: 403, statusMessage: 'Not allowed' })
    const status = ['verified', 'incorrect'].includes(body.status) ? body.status : null
    return updateAsk(id, { review: { status, note: String(body.note || '').slice(0, 1000), by: user.displayName || user.username, at: new Date().toISOString() } })
  }
  if (!owner) throw createError({ statusCode: 403, statusMessage: 'Only the person who asked can change this' })
  if (body?.action === 'share') return updateAsk(id, { shared: !!body.shared })
  if (body?.action === 'delete') {
    const dir = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
    const p = join(dir, 'asks', `${id}.json`)
    if (existsSync(p)) unlinkSync(p)
    return { ok: true }
  }
  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})
