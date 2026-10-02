import { requireAuth } from '~/server/utils/auth'
import { getAsk, getThread, staleDatasets, canView } from '~/server/utils/ask-runner'

/** One saved answer, with the whole conversation it belongs to. */
export default defineEventHandler((event) => {
  const { user } = requireAuth(event)
  const a = getAsk(String(getRouterParam(event, 'id')))
  if (!a || !canView(a, user)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const thread = getThread(a.threadId || a.id).filter(t => canView(t, user))
    .map(t => ({ ...t, mine: t.userId === user.id, stale: staleDatasets(t) }))
  return { ...a, mine: a.userId === user.id, stale: staleDatasets(a), thread }
})
