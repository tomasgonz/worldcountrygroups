import { requireAuth, getSession } from '~/server/utils/auth'
import { shareFromEvent, sharedAskId } from '~/server/utils/share-links'
import { getAsk, getThread, staleDatasets, canView } from '~/server/utils/ask-runner'

/** One saved answer, with the whole conversation it belongs to. */
export default defineEventHandler((event) => {
  const id = String(getRouterParam(event, 'id'))
  const share = shareFromEvent(event)
  if (!getSession(event) && share && sharedAskId(share) === id) {
    // a visitor with a share link to this answer: the conversation it belongs to, read-only
    const a = getAsk(id)
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    const thread = getThread(a.threadId || a.id).map(t => ({ ...t, userId: undefined, mine: false, stale: staleDatasets(t) }))
    return { ...a, userId: undefined, mine: false, stale: staleDatasets(a), thread, sharedView: true }
  }
  const { user } = requireAuth(event)
  const a = getAsk(id)
  if (!a || !canView(a, user)) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const thread = getThread(a.threadId || a.id).filter(t => canView(t, user))
    .map(t => ({ ...t, mine: t.userId === user.id, stale: staleDatasets(t) }))
  return { ...a, mine: a.userId === user.id, stale: staleDatasets(a), thread }
})
