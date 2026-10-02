import { requireAuth } from '~/server/utils/auth'
import { getAsk, staleDatasets } from '~/server/utils/ask-runner'

export default defineEventHandler((event) => {
  const { user } = requireAuth(event)
  const a = getAsk(String(getRouterParam(event, 'id')))
  if (!a || (a.userId !== user.id && !a.shared && user.role !== 'admin')) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { ...a, mine: a.userId === user.id, stale: staleDatasets(a) }
})
