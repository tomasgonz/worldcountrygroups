import { getTopKeywords, getSpeechesMeta } from '~/server/utils/speeches'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const sessionParam = query.session as string | undefined
  const session = sessionParam ? parseInt(sessionParam, 10) : undefined

  const meta = getSpeechesMeta()
  const latestSession = meta.sessions.length > 0 ? Math.max(...meta.sessions) : undefined
  const effectiveSession = session ?? latestSession

  const topics = getTopKeywords(effectiveSession)

  return {
    session: effectiveSession ?? null,
    topics: topics.slice(0, 50),
  }
})
