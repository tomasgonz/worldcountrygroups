import { getSessionInsights } from '~/server/utils/speech-insights'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const session = q.session ? parseInt(String(q.session), 10) : undefined
  return getSessionInsights(Number.isFinite(session) ? session : undefined)
})
