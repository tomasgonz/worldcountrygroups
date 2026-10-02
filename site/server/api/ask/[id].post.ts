import { unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { requireAuth } from '~/server/utils/auth'
import { getAsk, updateAsk, canView, getThread } from '~/server/utils/ask-runner'

/** Review (verified / incorrect + note), share, or delete a saved question. */
export default defineEventHandler(async (event) => {
  const { user } = requireAuth(event)
  const id = String(getRouterParam(event, 'id'))
  const a = getAsk(id)
  if (!a) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const owner = a.userId === user.id || user.role === 'admin'
  const body = await readBody(event)
  if (body?.action === 'review') {
    if (!owner && !canView(a, user)) throw createError({ statusCode: 403, statusMessage: 'Not allowed' })
    const status = ['verified', 'incorrect'].includes(body.status) ? body.status : null
    return updateAsk(id, { review: { status, note: String(body.note || '').slice(0, 1000), by: user.displayName || user.username, at: new Date().toISOString() } })
  }
  if (!owner) throw createError({ statusCode: 403, statusMessage: 'Only the person who asked can change this' })
  // sharing applies to the whole conversation, which is keyed by its first question
  if (body?.action === 'share') {
    const root = a.threadId ? getAsk(a.threadId) : a
    if (!root || (root.userId !== user.id && user.role !== 'admin')) throw createError({ statusCode: 403, statusMessage: 'Only the person who started the conversation can share it' })
    return updateAsk(root.id, { shared: !!body.shared })
  }
  if (body?.action === 'delete') {
    const dir = process.env.WCG_SITE_DATA || join(process.env.HOME || '/home/exedev', 'worldcountrygroups/site/server/data')
    // deleting the first question removes the whole conversation
    const ids = a.threadId ? [id] : getThread(id).filter(t => t.userId === a.userId || user.role === 'admin').map(t => t.id)
    for (const x of ids) {
      const p = join(dir, 'asks', `${x}.json`)
      if (existsSync(p)) unlinkSync(p)
    }
    return { ok: true }
  }
  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})
